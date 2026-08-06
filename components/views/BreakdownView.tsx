import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BreakdownData, BreakdownItem, Beat, Shot } from '../../types';
import { generateBreakdown } from '../../services/gemini';
import { 
    ListChecks, Users, Package, Mic2, Shirt, Wand2, Flame, MapPin, 
    Search, LayoutGrid, List as ListIcon, Eye, 
    Sparkles, Loader2, Trash2, Hash,
    Lock, Unlock, Download, FileSpreadsheet,
    Plus, X, Film, Camera, Aperture, FileText, ChevronDown, ChevronRight,
    Check, ExternalLink, ArrowRight, Video, Layers, AlertCircle, Copy, Share2, Send, Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CATEGORIES = [
    { id: 'all', label: 'Total Manifest', icon: ListChecks, color: 'text-zinc-300', bg: 'bg-zinc-500/20', border: 'border-zinc-500/30', lightColor: 'text-slate-800', lightBg: 'bg-slate-100', lightBorder: 'border-slate-300' },
    { id: 'cast', label: 'Cast & Extras', icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', lightColor: 'text-amber-800', lightBg: 'bg-amber-50', lightBorder: 'border-amber-300' },
    { id: 'props', label: 'Props', icon: Package, color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', lightColor: 'text-rose-800', lightBg: 'bg-rose-50', lightBorder: 'border-rose-300' },
    { id: 'costume', label: 'Wardrobe', icon: Shirt, color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/30', lightColor: 'text-pink-800', lightBg: 'bg-pink-50', lightBorder: 'border-pink-300' },
    { id: 'vfx', label: 'Visual Effects', icon: Wand2, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', lightColor: 'text-emerald-800', lightBg: 'bg-emerald-50', lightBorder: 'border-emerald-300' },
    { id: 'practical', label: 'Special Effects', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', lightColor: 'text-orange-800', lightBg: 'bg-orange-50', lightBorder: 'border-orange-300' },
    { id: 'sound', label: 'Sound / SFX', icon: Mic2, color: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500/30', lightColor: 'text-sky-800', lightBg: 'bg-sky-50', lightBorder: 'border-sky-300' },
    { id: 'location', label: 'Locations', icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', lightColor: 'text-purple-800', lightBg: 'bg-purple-50', lightBorder: 'border-purple-300' },
];

const BreakdownView: React.FC = () => {
    const { 
        beats, 
        updateBeat, 
        breakdownLanguage, 
        breakdownLockedOnly, 
        setBreakdownLockedOnly, 
        scriptConfig, 
        scratchpadConfig,
        generatedShots,
        projectList = [],
        currentProjectId = null,
        appTheme
    } = useProject();

    const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState<'by-scene' | 'by-category'>('by-scene');

    const [startScene, setStartScene] = useState(1);
    const [endScene, setEndScene] = useState(beats.length || 1);
    const [delay, setDelay] = useState(2); 

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzingBeatId, setAnalyzingBeatId] = useState<number | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentScene: '' });
    const abortRef = useRef(false);
    const isMounted = useRef(true);

    const [isExporting, setIsExporting] = useState(false);

    // Inspector Drawer State
    const [activeInspectorBeatId, setActiveInspectorBeatId] = useState<number | null>(null);
    const [expandedScenes, setExpandedScenes] = useState<Record<number, { script: boolean; shots: boolean }>>({});

    // Inline New Item Inputs per beat & category
    const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});

    // Project Metadata for Print & Copy
    const activeProjectName = useMemo(() => {
        const proj = projectList.find(p => p.id === currentProjectId);
        return proj ? proj.name : 'SEQUENCER PROJECT';
    }, [projectList, currentProjectId]);

    const [customProjectName, setCustomProjectName] = useState<string>('');
    const [productionCompany, setProductionCompany] = useState<string>('Apex Pictures');
    const [directorName, setDirectorName] = useState<string>('Director Name');
    const [hodName, setHodName] = useState<string>('Dept Head');
    const [hodDept, setHodDept] = useState<string>('Production / Art Dept');
    const [includeProjectMetadata, setIncludeProjectMetadata] = useState<boolean>(true);
    const [includeHodSignoff, setIncludeHodSignoff] = useState<boolean>(true);

    // Screen Real Estate Optimization State (Hide empty category cards by default)
    const [showEmptyCategories, setShowEmptyCategories] = useState(false);

    // Department Quick List Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareCategory, setShareCategory] = useState<string>('props');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Print Manifest Document Generator
    const handlePrintBreakdown = (catId: string = shareCategory) => {
        const textList = generateCategoryTextList(catId);
        const catLabel = CATEGORIES.find(c => c.id === catId)?.label || 'Production Breakdown';
        const projTitle = (customProjectName.trim() || activeProjectName);
        
        const printWindow = window.open('', '_blank', 'width=850,height=950');
        if (!printWindow) {
            showToast('Please allow popups to open print document.');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${projTitle} - ${catLabel} Manifest</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        padding: 35px;
                        color: #111;
                        background: #fff;
                        line-height: 1.5;
                    }
                    .meta-header {
                        border-bottom: 2px solid #111;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .project-title {
                        font-size: 24px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .meta-grid {
                        display: flex;
                        gap: 20px;
                        margin-top: 6px;
                        font-size: 11px;
                        color: #444;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .header {
                        border-bottom: 3px solid #111;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                    }
                    .title {
                        font-size: 18px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .subtitle {
                        font-size: 11px;
                        color: #555;
                        font-family: monospace;
                        margin-top: 4px;
                    }
                    .content {
                        font-family: "Courier New", Courier, monospace;
                        font-size: 12px;
                        white-space: pre-wrap;
                        background: #fafafa;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 2px solid #222;
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        color: #444;
                        font-weight: bold;
                    }
                    .print-btn {
                        padding: 8px 16px;
                        background: #111;
                        color: #fff;
                        border: none;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: bold;
                        cursor: pointer;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none !important; }
                        .content { border: none; background: transparent; padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${includeProjectMetadata ? `
                <div class="meta-header">
                    <div class="project-title">🎬 ${projTitle.toUpperCase()}</div>
                    <div class="meta-grid">
                        ${productionCompany.trim() ? `<div>🏢 PRODUCTION: ${productionCompany.toUpperCase()}</div>` : ''}
                        ${directorName.trim() ? `<div>🎥 DIRECTOR: ${directorName.toUpperCase()}</div>` : ''}
                        <div>DATE: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                </div>
                ` : ''}
                <div class="header">
                    <div>
                        <div class="title">📋 ${catLabel.toUpperCase()} MANIFEST</div>
                        <div class="subtitle">BACKSTAGE STORY SEQUENCER • PRODUCTION BREAKDOWN LOG</div>
                    </div>
                    <div class="no-print">
                        <button onclick="window.print()" class="print-btn">
                            🖨️ Print / Save PDF
                        </button>
                    </div>
                </div>
                <div class="content">${textList}</div>
                ${includeHodSignoff ? `
                <div class="footer">
                    <div><strong>HOD SIGN-OFF:</strong> ${hodName.toUpperCase()} (${hodDept.toUpperCase()})</div>
                    <div><strong>SIGNATURE:</strong> ________________________</div>
                    <div><strong>DATE:</strong> ____________</div>
                    <div><strong>APPROVAL:</strong> [  ] PASS &nbsp;&nbsp; [  ] REV</div>
                </div>
                ` : ''}
                <script>
                    setTimeout(function() { window.print(); }, 400);
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintScene = (beat: Beat) => {
        const sceneNum = beat.sceneNumber || '1';
        const projTitle = (customProjectName.trim() || activeProjectName);
        let lines: string[] = [];
        if (includeProjectMetadata) {
            lines.push(`🎬 PROJECT: ${projTitle.toUpperCase()}`);
            if (productionCompany.trim()) lines.push(`🏢 PRODUCTION: ${productionCompany.trim().toUpperCase()}`);
            if (directorName.trim()) lines.push(`🎥 DIRECTOR: ${directorName.trim().toUpperCase()}`);
            lines.push(`==================================================`);
        }
        lines.push(`📍 SCENE ${sceneNum}: ${beat.slug.prefix || 'INT.'} ${beat.slug.location || 'LOCATION'} - ${beat.slug.time || 'DAY'}`);
        if (beat.title) lines.push(`Title: ${beat.title}`);
        lines.push(`--------------------------------------------------`);
        if (beat.breakdown) {
            (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(c => {
                const items = beat.breakdown![c] || [];
                if (items.length > 0) {
                    const label = CATEGORIES.find(cat => cat.id === c)?.label || c;
                    lines.push(`\n[${label.toUpperCase()}]`);
                    items.forEach(i => {
                        const name = typeof i === 'string' ? i : i.name;
                        lines.push(`  [ ] ${name}`);
                    });
                }
            });
        }
        
        const printWindow = window.open('', '_blank', 'width=800,height=800');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
            <head>
                <title>${projTitle} - Scene ${sceneNum} Breakdown</title>
                <style>
                    body { font-family: monospace; padding: 35px; font-size: 13px; line-height: 1.6; color: #111; }
                    .no-print { margin-bottom: 20px; }
                    button { padding: 8px 16px; background: #000; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="no-print"><button onclick="window.print()">🖨️ Print Scene Sheet</button></div>
                <pre>${lines.join('\n')}</pre>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Generate Shareable Text List for a Category across all scenes or a single scene
    const generateCategoryTextList = (catId: string) => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);
        const catLabel = CATEGORIES.find(c => c.id === catId)?.label || 'Breakdown';
        const projTitle = (customProjectName.trim() || activeProjectName).toUpperCase();
        let lines: string[] = [];

        if (includeProjectMetadata) {
            lines.push(`🎬 PROJECT: ${projTitle}`);
            if (productionCompany.trim()) lines.push(`🏢 PRODUCTION: ${productionCompany.trim().toUpperCase()}`);
            if (directorName.trim()) lines.push(`🎥 DIRECTOR: ${directorName.trim().toUpperCase()}`);
            lines.push(`----------------------------------------`);
        }

        lines.push(`📋 ${catLabel.toUpperCase()} MANIFEST — PRODUCTION BREAKDOWN`);
        lines.push(`Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
        lines.push(`========================================`);

        let itemCount = 0;
        if (catId === 'all') {
            sortedBeats.forEach((beat, idx) => {
                const sceneNum = beat.sceneNumber || (idx + 1).toString();
                const location = beat.slug.location || 'LOCATION';
                lines.push(`\n📍 SCENE ${sceneNum}: ${beat.slug.prefix || 'INT.'} ${location}`);
                if (beat.breakdown) {
                    (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(c => {
                        const items = beat.breakdown![c] || [];
                        if (items.length > 0) {
                            const cName = CATEGORIES.find(cat => cat.id === c)?.label || c;
                            lines.push(`  [${cName}]: ` + items.map(i => typeof i === 'string' ? i : i.name).join(', '));
                            itemCount += items.length;
                        }
                    });
                } else {
                    lines.push(`  (No breakdown items logged)`);
                }
            });
        } else {
            sortedBeats.forEach((beat, idx) => {
                const sceneNum = beat.sceneNumber || (idx + 1).toString();
                const location = beat.slug.location || 'LOCATION';
                const items = beat.breakdown?.[catId as keyof BreakdownData] || [];
                if (items.length > 0) {
                    lines.push(`\n📍 SCENE ${sceneNum} (${beat.slug.prefix || 'INT.'} ${location}):`);
                    items.forEach(i => {
                        const name = typeof i === 'string' ? i : i.name;
                        lines.push(`   • ${name}`);
                        itemCount++;
                    });
                }
            });
            if (itemCount === 0) {
                lines.push(`\nNo items currently logged under ${catLabel}.`);
            }
        }

        if (includeHodSignoff) {
            lines.push(`\n========================================`);
            lines.push(`HOD SIGN-OFF (${hodName.toUpperCase()} - ${hodDept.toUpperCase()}): ____________________`);
            lines.push(`DATE: ____________   STATUS: [  ] APPROVED   [  ] REVISION NEEDED`);
        }

        lines.push(`\n----------------------------------------`);
        lines.push(`Total Items Logged: ${itemCount}`);
        lines.push(`Generated by Backstage Story Sequencer`);
        return lines.join('\n');
    };

    // Copy Scene Specific List
    const copySceneBreakdown = (beat: Beat, sceneNum: string) => {
        let lines: string[] = [];
        const projTitle = (customProjectName.trim() || activeProjectName).toUpperCase();
        if (includeProjectMetadata) {
            lines.push(`🎬 PROJECT: ${projTitle}`);
            if (productionCompany.trim()) lines.push(`🏢 PRODUCTION: ${productionCompany.trim().toUpperCase()}`);
            if (directorName.trim()) lines.push(`🎥 DIRECTOR: ${directorName.trim().toUpperCase()}`);
            lines.push(`----------------------------------------`);
        }
        lines.push(`📍 SCENE ${sceneNum}: ${beat.slug.prefix || 'INT.'} ${beat.slug.location || 'LOCATION'} - ${beat.slug.time || 'DAY'}`);
        if (beat.title) lines.push(`Title: ${beat.title}`);
        lines.push(`----------------------------------------`);

        let count = 0;
        if (beat.breakdown) {
            (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(c => {
                const items = beat.breakdown![c] || [];
                if (items.length > 0) {
                    const label = CATEGORIES.find(cat => cat.id === c)?.label || c;
                    lines.push(`• ${label}: ` + items.map(i => typeof i === 'string' ? i : i.name).join(', '));
                    count += items.length;
                }
            });
        }
        if (count === 0) lines.push(`(No breakdown items logged for this scene)`);

        if (includeHodSignoff) {
            lines.push(`\n========================================`);
            lines.push(`HOD SIGN-OFF (${hodName.toUpperCase()} - ${hodDept.toUpperCase()}): ____________________`);
            lines.push(`DATE: ____________   STATUS: [  ] APPROVED   [  ] REVISION NEEDED`);
        }

        navigator.clipboard.writeText(lines.join('\n'));
        showToast(`Copied Scene ${sceneNum} breakdown list to clipboard!`);
    };

    useEffect(() => {
        isMounted.current = true;
        setIsAnalyzing(false);
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!isAnalyzing) {
            setEndScene(beats.length || 1);
        }
    }, [beats.length, isAnalyzing]);

    // Map shots to scenes
    const getShotsForScene = (sceneNum: string, beatIndex: number) => {
        return generatedShots.filter(s => {
            if (!s.scene) return false;
            const cleanShotScene = s.scene.trim().toLowerCase();
            const cleanBeatScene = (sceneNum || '').trim().toLowerCase();
            const fallbackBeatScene = (beatIndex + 1).toString();
            return cleanShotScene === cleanBeatScene || cleanShotScene === fallbackBeatScene;
        });
    };

    // Calculate aggregated Breakdown Data across all beats
    const { itemsData, categoryCounts } = useMemo(() => {
        const itemsMap = new Map<string, { 
            name: string;
            category: keyof BreakdownData; 
            scenes: { id: number; slug: string; source?: string; sceneNum: string; shotCount: number }[];
        }>();

        const counts: Record<string, number> = {};
        CATEGORIES.forEach(c => counts[c.id] = 0);

        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);

        sortedBeats.forEach((beat, idx) => {
            if (!beat.breakdown) return;
            const sceneNum = beat.sceneNumber || (idx + 1).toString();
            const slug = `${beat.slug.prefix || ''} ${beat.slug.location || ''} - ${beat.slug.time || ''}`.trim();
            const sceneShots = getShotsForScene(sceneNum, idx);
            
            (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(cat => {
                const list = beat.breakdown![cat] || [];
                list.forEach(rawItem => {
                    const name = typeof rawItem === 'string' ? rawItem : rawItem.name;
                    const source = typeof rawItem === 'string' ? undefined : rawItem.source;
                    const cleanName = (name || '').trim();
                    if (!cleanName) return;

                    const key = `${cat}:${cleanName.toLowerCase()}`;

                    if (!itemsMap.has(key)) {
                        itemsMap.set(key, { name: cleanName, category: cat, scenes: [] });
                        counts[cat] = (counts[cat] || 0) + 1;
                        counts['all'] = (counts['all'] || 0) + 1;
                    }
                    
                    const entry = itemsMap.get(key)!;
                    if (!entry.scenes.find(s => s.id === beat.id)) {
                        entry.scenes.push({ id: beat.id, slug, source, sceneNum, shotCount: sceneShots.length });
                    }
                });
            });
        });

        const list = Array.from(itemsMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return { itemsData: list, categoryCounts: counts };
    }, [beats, generatedShots]);

    const filteredData = useMemo(() => {
        let result = itemsData;
        if (selectedCategory !== 'all') {
            result = result.filter((item) => item.category === selectedCategory);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter((item) => (item.name || '').toLowerCase().includes(lower));
        }
        return result;
    }, [itemsData, selectedCategory, searchTerm]);

    const sceneData = useMemo(() => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);
        return sortedBeats.map((beat, idx) => {
            const sceneNum = beat.sceneNumber || (idx + 1).toString();
            const shots = getShotsForScene(sceneNum, idx);
            const hasBreakdown = !!beat.breakdown;
            const totalItems = hasBreakdown 
                ? Object.values(beat.breakdown || {}).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0)
                : 0;
            return { beat, hasBreakdown, totalItems, sceneIndex: idx + 1, sceneNum, shots };
        });
    }, [beats, generatedShots]);

    // Scenes filtered by active category selection and search term
    const displayedScenes = useMemo(() => {
        const totalItemsInSelectedCat = selectedCategory !== 'all' ? (categoryCounts[selectedCategory] || 0) : 0;

        return sceneData.filter(s => {
            // 1. Category Filter
            if (selectedCategory !== 'all' && totalItemsInSelectedCat > 0) {
                const catItems = s.beat.breakdown?.[selectedCategory as keyof BreakdownData] || [];
                if (catItems.length === 0) return false;
            }

            // 2. Search Filter
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                const locMatch = (s.beat.slug.location || '').toLowerCase().includes(lower);
                const contentMatch = (s.beat.content || '').toLowerCase().includes(lower);
                const titleMatch = (s.beat.title || '').toLowerCase().includes(lower);
                const breakdownMatch = s.beat.breakdown ? Object.values(s.beat.breakdown).some((items: any) => 
                    Array.isArray(items) && items.some(i => (typeof i === 'string' ? i : i.name).toLowerCase().includes(lower))
                ) : false;

                if (!locMatch && !contentMatch && !titleMatch && !breakdownMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [sceneData, selectedCategory, categoryCounts, searchTerm]);

    const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.id === cat);

    // Handle adding new item directly to a beat breakdown category
    const handleAddItemToBeat = (beatId: number, category: keyof BreakdownData, itemName: string) => {
        const cleanName = itemName.trim();
        if (!cleanName) return;

        const beat = beats.find(b => b.id === beatId);
        if (!beat) return;

        const currentBreakdown: BreakdownData = beat.breakdown ? { ...beat.breakdown } : {
            sound: [], props: [], costume: [], vfx: [], practical: [], cast: [], location: []
        };

        const catArray = [...(currentBreakdown[category] || [])];
        const exists = catArray.some(i => (typeof i === 'string' ? i : i.name).toLowerCase() === cleanName.toLowerCase());
        if (!exists) {
            catArray.push({ name: cleanName, source: 'Manual Entry' });
            currentBreakdown[category] = catArray;
            updateBeat(beatId, { breakdown: currentBreakdown });
        }

        setNewItemInputs(prev => ({ ...prev, [`${beatId}:${category}`]: '' }));
    };

    // Handle removing an item from a beat breakdown category
    const handleRemoveItemFromBeat = (beatId: number, category: keyof BreakdownData, itemIndex: number) => {
        const beat = beats.find(b => b.id === beatId);
        if (!beat || !beat.breakdown) return;

        const currentBreakdown: BreakdownData = { ...beat.breakdown };
        const catArray = [...(currentBreakdown[category] || [])];
        catArray.splice(itemIndex, 1);
        currentBreakdown[category] = catArray;
        updateBeat(beatId, { breakdown: currentBreakdown });
    };

    // Analyze Single Beat with AI
    const handleAnalyzeSingleBeat = async (beat: Beat) => {
        const div = document.createElement('div');
        div.innerHTML = beat.content || '';
        const text = div.innerText || '';
        if (!text.trim()) {
            alert("This scene has no script content to analyze.");
            return;
        }

        setAnalyzingBeatId(beat.id);
        try {
            const result = await generateBreakdown(text, 'gemini-3-flash-preview', breakdownLanguage);
            if (result && isMounted.current) {
                updateBeat(beat.id, { breakdown: result });
            }
        } catch (err) {
            console.error(`Failed to analyze beat ${beat.id}`, err);
        } finally {
            if (isMounted.current) setAnalyzingBeatId(null);
        }
    };

    // Analyze Batch of Scenes with AI
    const handleAnalyze = async () => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);
        const startIndex = Math.max(0, startScene - 1);
        const endIndex = Math.min(sortedBeats.length, endScene);
        let targetBeats = sortedBeats.slice(startIndex, endIndex);

        if (breakdownLockedOnly) {
            targetBeats = targetBeats.filter(b => b.status === 'ready');
        }

        const validBeats = targetBeats.filter(b => {
            const div = document.createElement('div');
            div.innerHTML = b.content || '';
            return (div.textContent || '').trim().length > 0;
        });

        if (validBeats.length === 0) {
            alert(breakdownLockedOnly 
                ? `No valid LOCKED scenes found in range ${startScene}-${endScene}.` 
                : `No script content found to analyze in range ${startScene}-${endScene}.`);
            return;
        }

        setIsAnalyzing(true);
        abortRef.current = false;
        setProgress({ current: 0, total: validBeats.length, currentScene: '' });

        try {
            for (let i = 0; i < validBeats.length; i++) {
                if (abortRef.current || !isMounted.current) break;
                const beat = validBeats[i];
                const sceneName = beat.slug.location || `Scene ${beat.sceneNumber || '?'}`;
                if (isMounted.current) {
                    setProgress({ current: i + 1, total: validBeats.length, currentScene: sceneName });
                }
                const div = document.createElement('div');
                div.innerHTML = beat.content || '';
                const text = div.innerText || '';
                try {
                    const result = await generateBreakdown(text, 'gemini-3-flash-preview', breakdownLanguage);
                    if (result && isMounted.current) {
                        updateBeat(beat.id, { breakdown: result });
                    }
                } catch (err) {
                    console.error(`Failed to analyze beat ${beat.id}`, err);
                }
                if (i < validBeats.length - 1) {
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
            }
        } catch (globalErr) {
            console.error(globalErr);
        } finally {
            if (isMounted.current) setIsAnalyzing(false);
        }
    };

    // Export Breakdown Manifest
    const handleExport = async (format: 'csv' | 'excel') => {
        setIsExporting(true);
        try {
            const exportData = itemsData.map(item => ({
                Category: item.category.toUpperCase(),
                Item: item.name,
                Scenes: item.scenes.map(s => s.sceneNum).join(', '),
                Source_Text: item.scenes.map(s => s.source || '').filter(Boolean).join(' | '),
                Total_Scenes: item.scenes.length
            }));
            if (exportData.length === 0) { alert("No breakdown data to export."); return; }
            const fileName = `Breakdown_Manifest_${new Date().toISOString().slice(0,10)}`;
            if (format === 'csv') {
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
                const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${fileName}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdown Manifest");
                XLSX.writeFile(workbook, `${fileName}.xlsx`);
            }
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setIsExporting(false);
        }
    };

    const fontStyle = {
        fontFamily: scriptConfig.noteFont || 'Courier New, monospace',
        fontSize: `${scratchpadConfig.fontSize || 14}px`
    };

    const activeInspectorBeat = activeInspectorBeatId !== null ? beats.find(b => b.id === activeInspectorBeatId) : null;
    const activeInspectorShots = activeInspectorBeat ? getShotsForScene(activeInspectorBeat.sceneNumber || '1', beats.indexOf(activeInspectorBeat)) : [];

    return (
        <div className={`flex w-full h-full overflow-hidden font-sans ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#121212] text-gray-300'}`}>
            {/* Sidebar Manifest Categories */}
            <div className={`w-72 border-r flex flex-col shrink-0 z-20 shadow-xl relative ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1a1a] border-[#333]'}`}>
                <div className={`p-5 border-b ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#333] bg-[#1a1a1a]'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <h2 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            <ListChecks size={16} className="text-[#f5a623]" /> Breakdown Manifest
                        </h2>
                        <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase ${isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-green-900/30 text-green-400 border-green-700/30'}`}>
                            Live Sync
                        </span>
                    </div>
                    <p className={`text-[10px] font-medium uppercase ${isLight ? 'text-slate-500' : 'text-[#777]'}`}>Script & Storyboard Assets</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                    {CATEGORIES.map(cat => {
                        const count = categoryCounts[cat.id] || 0;
                        const isActive = selectedCategory === cat.id;
                        const CatIcon = cat.icon;
                        const colorClass = isLight ? cat.lightColor : cat.color;
                        const bgClass = isLight ? cat.lightBg : cat.bg;
                        const borderClass = isLight ? cat.lightBorder : cat.border;
                        return (
                            <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategory(cat.id)} 
                                className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between transition-all duration-200 group ${
                                    isActive 
                                        ? (isLight ? `${bgClass} border ${borderClass} ${colorClass} font-bold shadow-xs` : `${bgClass} border ${borderClass} text-white font-bold shadow-inner`)
                                        : (isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#222] text-[#888]')
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-md ${isActive ? (isLight ? bgClass : cat.bg) : (isLight ? 'bg-slate-100 group-hover:bg-slate-200' : 'bg-[#222] group-hover:bg-[#2a2a2a]')} transition-colors`}>
                                        <CatIcon size={15} className={isActive ? colorClass : (isLight ? 'text-slate-600' : 'text-gray-500')} />
                                    </div>
                                    <span className="text-xs font-bold">{cat.label}</span>
                                </div>
                                {count > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#f5a623] text-black' : (isLight ? 'bg-slate-200 text-slate-700' : 'bg-[#333] text-gray-400')}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Quick Summary Metrics Box */}
                <div className={`p-4 border-t space-y-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#333] bg-[#141414]'}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Sync Overview</div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className={`border rounded-lg p-2 ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#1e1e1e] border-[#333]'}`}>
                            <div className={`text-base font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{beats.length}</div>
                            <div className={`text-[9px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Scenes</div>
                        </div>
                        <div className={`border rounded-lg p-2 ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#1e1e1e] border-[#333]'}`}>
                            <div className="text-base font-black text-[#f5a623]">{generatedShots.length}</div>
                            <div className={`text-[9px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Storyboard Shots</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Workspace */}
            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#121212] text-gray-300'}`}>
                {/* Control Header Bar */}
                <div className={`h-14 border-b px-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#111] border-[#222]'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 border rounded-md px-2 py-1 ${isLight ? 'bg-slate-50 border-slate-250' : 'bg-[#000] border-[#333]'}`}>
                           <span className={`text-[10px] font-bold uppercase mr-1 ${isLight ? 'text-slate-500' : 'text-[#666]'}`}>SCENE</span>
                           <input type="number" className={`w-8 bg-transparent text-center text-xs font-bold outline-none focus:text-[#f5a623] ${isLight ? 'text-slate-900' : 'text-white'}`} value={startScene} onChange={e => setStartScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                           <span className={`${isLight ? 'text-slate-400' : 'text-gray-600'} font-bold text-xs`}>-</span>
                           <input type="number" className={`w-8 bg-transparent text-center text-xs font-bold outline-none focus:text-[#f5a623] ${isLight ? 'text-slate-900' : 'text-white'}`} value={endScene} onChange={e => setEndScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                        </div>

                        <button 
                            onClick={() => setBreakdownLockedOnly(!breakdownLockedOnly)} 
                            disabled={isAnalyzing} 
                            title={breakdownLockedOnly ? "Analyzing Locked Scenes Only" : "Analyze All Scenes"}
                            className={`flex items-center justify-center h-8 px-2.5 gap-1.5 rounded-md border text-xs font-bold transition-all ${
                                breakdownLockedOnly 
                                    ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-green-900/20 text-green-400 border-green-800/50') 
                                    : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-950' : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white hover:bg-[#333]')
                            }`}
                        >
                            {breakdownLockedOnly ? <Lock size={13} /> : <Unlock size={13} />}
                            <span className="text-[10px] uppercase">{breakdownLockedOnly ? "Locked Only" : "All Drafts"}</span>
                        </button>

                        <button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing} 
                            className={`flex items-center gap-2 border px-3.5 py-1.5 rounded-md text-xs font-bold uppercase transition-all disabled:opacity-50 ${
                                isLight 
                                    ? 'bg-slate-100 hover:bg-[#f5a623] hover:text-black text-slate-700 border-slate-300' 
                                    : 'bg-[#222] hover:bg-[#f5a623] hover:text-black text-gray-300 border-[#333]'
                            }`}
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className="text-[#f5a623]" />} 
                            {isAnalyzing ? 'Analyzing Script...' : 'AI Analyze All'}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`hidden lg:flex items-center gap-2 border px-3 py-1 rounded-md ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1a1a] border-[#333]'}`}>
                            <FileText size={12} className="text-green-500" />
                            <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>Script & Storyboard Synced</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        </div>

                        <div className={`flex rounded-md border p-0.5 gap-1 ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#222] border-[#333]'}`}>
                            <button onClick={() => { setShareCategory(selectedCategory === 'all' ? 'props' : selectedCategory); setIsShareModalOpen(true); }} className="px-2.5 py-1 bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold rounded text-[10px] uppercase transition-all flex items-center gap-1.5 shadow-sm" title="Get formatted list to send to department person">
                                <Share2 size={12} /> Send / Copy List
                            </button>
                            <button onClick={() => handlePrintBreakdown(selectedCategory === 'all' ? 'props' : selectedCategory)} className={`px-2.5 py-1 font-bold rounded text-[10px] uppercase transition-all flex items-center gap-1.5 ${isLight ? 'bg-slate-200 hover:bg-slate-350 text-slate-800' : 'bg-[#28282e] hover:bg-[#383840] text-gray-200'}`} title="Print Breakdown Manifest">
                                <Printer size={12} className={isLight ? 'text-amber-600' : 'text-amber-400'} /> Print
                            </button>
                            <button onClick={() => handleExport('excel')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'}`}><FileSpreadsheet size={12} className="text-green-500" /> Excel</button>
                            <button onClick={() => handleExport('csv')} className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'}`}><Download size={12} /> CSV</button>
                        </div>

                        <div className={`flex rounded-md p-1 border gap-1 ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#000] border-[#333]'}`}>
                           <button onClick={() => setViewType('by-scene')} className={`p-1.5 rounded transition-colors ${viewType === 'by-scene' ? (isLight ? 'bg-slate-300 text-slate-900' : 'bg-[#333] text-white') : (isLight ? 'text-slate-500 hover:text-slate-800' : 'text-gray-500 hover:text-gray-300')}`} title="Scene View with Storyboard"><ListIcon size={14} /></button>
                           <button onClick={() => setViewType('by-category')} className={`p-1.5 rounded transition-colors ${viewType === 'by-category' ? (isLight ? 'bg-slate-300 text-slate-900' : 'bg-[#333] text-white') : (isLight ? 'text-slate-500 hover:text-slate-800' : 'text-gray-500 hover:text-gray-300')}`} title="Manifest Asset View"><LayoutGrid size={14} /></button>
                           {viewType === 'by-scene' && (
                              <button 
                                 onClick={() => setShowEmptyCategories(!showEmptyCategories)} 
                                 className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
                                    showEmptyCategories 
                                       ? (isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950/40 text-amber-400 border-amber-800/50') 
                                       : (isLight ? 'bg-white text-slate-600 border-slate-300 hover:text-slate-900' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white')
                                  }`}
                                 title={showEmptyCategories ? "Showing all categories (including empty)" : "Hiding empty categories to optimize screen space"}
                              >
                                  {showEmptyCategories ? "Full Grid" : "Compact"}
                              </button>
                           )}
                        </div>
                    </div>

                    <div className="relative w-56">
                        <Search className={`absolute left-2.5 top-2.5 ${isLight ? 'text-slate-400' : 'text-[#555]'}`} size={13} />
                        <input 
                            type="text" 
                            placeholder="Search Breakdown..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className={`w-full border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#f5a623] ${
                                isLight 
                                    ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' 
                                    : 'bg-[#000] border-[#333] text-white placeholder-gray-600'
                            }`} 
                        />
                    </div>
                </div>

                {/* Progress Bar during Batch AI Analysis */}
                {isAnalyzing && (
                    <div className={`px-8 py-3 flex items-center gap-4 shrink-0 shadow-lg z-20 border-b ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1a1a] border-[#f5a623]/30'}`}>
                        <div className="text-[10px] font-bold text-[#f5a623] uppercase animate-pulse flex items-center gap-2 shrink-0 min-w-[200px]">
                            <Loader2 size={14} className="animate-spin" /> Processing: <span className={`${isLight ? 'text-slate-900' : 'text-white'} truncate max-w-[200px]`}>{progress.currentScene || `Scene ${startScene + progress.current - 1}`}</span>
                        </div>
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-250' : 'bg-[#333]'}`}>
                            <div className="h-full bg-[#f5a623] transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                        </div>
                        <button onClick={() => { abortRef.current = true; }} className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded ${isLight ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100' : 'text-red-400 hover:text-red-300 bg-red-950/40 border border-red-900/50'}`}>
                            Stop
                        </button>
                    </div>
                )}

                {/* Main View Area */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {selectedCategory !== 'all' && (
                            <div className={`max-w-6xl mx-auto mb-4 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md border ${
                                isLight 
                                    ? 'bg-amber-50/50 border-amber-200 text-slate-800' 
                                    : 'bg-[#1c1c22] border-[#f5a623]/30 text-white'
                            }`}>
                                <div className="flex items-center gap-2.5 text-xs font-bold">
                                    <span className={`uppercase text-[10px] tracking-wider font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Active Filter:</span>
                                    {(() => {
                                        const cat = CATEGORIES.find(c => c.id === selectedCategory);
                                        if (!cat) return null;
                                        const Icon = cat.icon;
                                        const colorClass = isLight ? cat.lightColor : cat.color;
                                        const bgClass = isLight ? cat.lightBg : cat.bg;
                                        const borderClass = isLight ? cat.lightBorder : cat.border;
                                        return (
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${bgClass} ${borderClass} ${colorClass}`}>
                                                <Icon size={14} />
                                                {cat.label} ({categoryCounts[selectedCategory] || 0} items)
                                            </span>
                                        );
                                    })()}
                                </div>
                                <button 
                                    onClick={() => setSelectedCategory('all')} 
                                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                                        isLight 
                                            ? 'text-slate-650 hover:text-slate-900 bg-slate-200 hover:bg-slate-300' 
                                            : 'text-gray-400 hover:text-white bg-[#282828] hover:bg-[#333]'
                                    }`}
                                >
                                    <X size={12} /> Reset Category Filter
                                </button>
                            </div>
                        )}

                        {viewType === 'by-scene' ? (
                            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
                                {displayedScenes.map((item) => {
                                    const isScriptOpen = expandedScenes[item.beat.id]?.script;
                                    const isShotsOpen = expandedScenes[item.beat.id]?.shots;
                                    const isBeingAnalyzed = analyzingBeatId === item.beat.id;

                                    const activeCatsForScene = CATEGORIES.filter(c => c.id !== 'all' && (item.beat.breakdown?.[c.id as keyof BreakdownData]?.length || 0) > 0);

                                    const visibleCategories = selectedCategory === 'all'
                                        ? (showEmptyCategories 
                                            ? CATEGORIES.filter(c => c.id !== 'all')
                                            : (activeCatsForScene.length > 0 ? activeCatsForScene : CATEGORIES.filter(c => c.id !== 'all')))
                                        : CATEGORIES.filter(c => c.id === selectedCategory);

                                    return (
                                        <div key={item.beat.id} className={`border rounded-xl overflow-hidden hover:border-[#444] transition-all group shadow-md ${
                                            isLight ? 'bg-white border-slate-200 hover:border-slate-350' : 'bg-[#1a1a1a] border-[#333]'
                                        }`}>
                                            {/* Scene Header Strip */}
                                            <div className={`px-5 py-3.5 border-b flex flex-wrap justify-between items-center gap-4 ${
                                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#222] border-[#333]'
                                            }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`flex flex-col items-center justify-center min-w-[48px] h-12 rounded-lg border shadow-inner px-2 ${
                                                        isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#141414] border-[#333]'
                                                    }`}>
                                                        <span className={`text-[8px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-[#666]'}`}>SCENE</span>
                                                        <span className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.beat.sceneNumber || item.sceneIndex}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-sm font-bold transition-colors ${isLight ? 'text-slate-900 group-hover:text-slate-950' : 'text-gray-200 group-hover:text-white'}`} style={fontStyle}>
                                                            {item.beat.slug.prefix || 'INT.'} {item.beat.slug.location || 'UNKNOWN LOCATION'} {item.beat.slug.time ? `- ${item.beat.slug.time}` : ''}
                                                        </h4>
                                                        {/* Department Summary Badges in Header */}
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                            {activeCatsForScene.map(cat => {
                                                                const count = item.beat.breakdown?.[cat.id as keyof BreakdownData]?.length || 0;
                                                                const CatIcon = cat.icon;
                                                                const colorClass = isLight ? cat.lightColor : cat.color;
                                                                const bgClass = isLight ? cat.lightBg : cat.bg;
                                                                const borderClass = isLight ? cat.lightBorder : cat.border;
                                                                return (
                                                                    <span key={cat.id} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${bgClass} ${borderClass} ${colorClass}`}>
                                                                        <CatIcon size={10} />
                                                                        <span>{cat.label.split(' ')[0]}: {count}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                            {activeCatsForScene.length === 0 && (
                                                                <span className={`text-[10px] font-mono italic ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>No breakdown items logged</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Copy Scene Breakdown */}
                                                    <button 
                                                        onClick={() => copySceneBreakdown(item.beat, (item.beat.sceneNumber || item.sceneIndex).toString())}
                                                        className={`p-1.5 border rounded transition-colors ${
                                                            isLight 
                                                                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900' 
                                                                : 'bg-[#181818] hover:bg-[#333] border-[#333] text-gray-400 hover:text-white'
                                                        }`}
                                                        title="Copy Scene Breakdown List"
                                                    >
                                                        <Copy size={13} />
                                                    </button>

                                                    {/* Print Scene Breakdown */}
                                                    <button 
                                                        onClick={() => handlePrintScene(item.beat)}
                                                        className={`p-1.5 border rounded transition-colors ${
                                                            isLight 
                                                                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900' 
                                                                : 'bg-[#181818] hover:bg-[#333] border-[#333] text-gray-400 hover:text-white'
                                                        }`}
                                                        title="Print Scene Breakdown Sheet"
                                                    >
                                                        <Printer size={13} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
                                                    </button>
                                                    {/* Toggle Script Snippet */}
                                                    <button 
                                                        onClick={() => setExpandedScenes(prev => ({
                                                            ...prev,
                                                            [item.beat.id]: { ...prev[item.beat.id], script: !isScriptOpen }
                                                        }))}
                                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 transition-colors ${
                                                            isScriptOpen 
                                                                ? (isLight ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-blue-950/40 text-blue-400 border-blue-800/40') 
                                                                : (isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white')
                                                        }`}
                                                    >
                                                        <FileText size={12} />
                                                        <span>Script</span>
                                                        <ChevronDown size={12} className={`transition-transform ${isScriptOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {/* Toggle Storyboard Shots */}
                                                    <button 
                                                        onClick={() => setExpandedScenes(prev => ({
                                                            ...prev,
                                                            [item.beat.id]: { ...prev[item.beat.id], shots: !isShotsOpen }
                                                        }))}
                                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 transition-colors ${
                                                            isShotsOpen 
                                                                ? (isLight ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-purple-950/40 text-purple-400 border-purple-800/40') 
                                                                : (isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white')
                                                        }`}
                                                    >
                                                        <Camera size={12} />
                                                        <span>Storyboard ({item.shots.length})</span>
                                                        <ChevronDown size={12} className={`transition-transform ${isShotsOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {/* Single Scene AI Re-Analyze */}
                                                    <button 
                                                        onClick={() => handleAnalyzeSingleBeat(item.beat)}
                                                        disabled={isBeingAnalyzed || isAnalyzing}
                                                        title="Re-Analyze Breakdown for this scene"
                                                        className={`px-2.5 py-1 border rounded text-[10px] font-bold uppercase flex items-center gap-1 transition-all disabled:opacity-50 ${
                                                            isLight 
                                                                ? 'bg-slate-100 hover:bg-[#f5a623] hover:text-black border-slate-300 text-slate-600' 
                                                                : 'bg-[#181818] hover:bg-[#f5a623] hover:text-black border-[#333] text-gray-400'
                                                        }`}
                                                    >
                                                        {isBeingAnalyzed ? <Loader2 size={12} className="animate-spin text-[#f5a623]" /> : <Wand2 size={12} className="text-[#f5a623]" />}
                                                        <span>{isBeingAnalyzed ? 'Analyzing...' : 'Re-Break'}</span>
                                                    </button>

                                                    {/* Inspect Drawer Toggle */}
                                                    <button 
                                                        onClick={() => setActiveInspectorBeatId(activeInspectorBeatId === item.beat.id ? null : item.beat.id)}
                                                        className={`p-1.5 rounded border transition-colors ${
                                                            activeInspectorBeatId === item.beat.id 
                                                                ? 'bg-[#f5a623] text-black border-[#f5a623]' 
                                                                : (isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white')
                                                        }`}
                                                        title="Open Scene Inspector"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expandable Script Section */}
                                            {isScriptOpen && (
                                                <div className={`p-4 border-b text-xs font-mono leading-relaxed max-h-60 overflow-y-auto custom-scrollbar border-l-2 border-l-blue-500 ${
                                                    isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#141414] border-[#2a2a2a] text-gray-300'
                                                }`}>
                                                    <div className="text-[9px] font-bold uppercase text-blue-500 mb-2 tracking-widest flex items-center gap-1">
                                                        <FileText size={10} /> Script Content (Scene {item.sceneNum})
                                                    </div>
                                                    <div 
                                                        className={`prose max-w-none text-xs ${isLight ? 'prose-slate text-slate-800' : 'prose-invert text-gray-300'}`}
                                                        dangerouslySetInnerHTML={{ __html: item.beat.content || `<em class="${isLight ? 'text-slate-400' : 'text-gray-600'}">No script content written for this scene.</em>` }}
                                                    />
                                                </div>
                                            )}

                                            {/* Expandable Storyboard Shots Section */}
                                            {isShotsOpen && (
                                                <div className={`p-4 border-b border-l-2 border-l-purple-500 ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#111] border-[#2a2a2a]'}`}>
                                                    <div className="text-[9px] font-bold uppercase text-purple-400 mb-3 tracking-widest flex items-center gap-1.5">
                                                        <Camera size={11} /> Storyboard Shot Division ({item.shots.length} Shots)
                                                    </div>
                                                    {item.shots.length > 0 ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                            {item.shots.map((shot, sIdx) => (
                                                                <div key={shot.id || sIdx} className={`border rounded-lg overflow-hidden flex flex-col group/shot hover:border-purple-500/50 transition-colors ${isLight ? 'bg-white border-slate-250' : 'bg-[#1a1a1a] border-[#333]'}`}>
                                                                    <div className="h-20 bg-black relative flex items-center justify-center overflow-hidden">
                                                                        {shot.imageUrl ? (
                                                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <Film size={20} className={isLight ? 'text-slate-400' : 'text-gray-700'} />
                                                                        )}
                                                                        <div className="absolute top-1 left-1 bg-black/70 text-white font-mono text-[8px] font-bold px-1 rounded border border-white/20">
                                                                            SHOT #{sIdx + 1}
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-2 space-y-1">
                                                                        <div className={`text-[10px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-gray-200'}`}>{shot.shotSize || 'Wide'} • {shot.angle || 'Eye Level'}</div>
                                                                        {(shot.lens || shot.movement) && (
                                                                            <div className="text-[8px] font-mono text-[#f5a623] truncate">
                                                                                {shot.lens} {shot.movement ? `(${shot.movement})` : ''}
                                                                            </div>
                                                                        )}
                                                                        <div className={`text-[9px] line-clamp-2 leading-tight ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{shot.subject || shot.description || 'No camera notes'}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-gray-500 italic py-2">
                                                            No storyboard shots created for this scene yet. Go to Storyboard tab to divide shots.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Categories Breakdown Content */}
                                            <div className={`p-5 grid gap-5 ${selectedCategory === 'all' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                                                {visibleCategories.map(cat => {
                                                    const items = item.beat.breakdown?.[cat.id as keyof BreakdownData] || [];
                                                    const inputKey = `${item.beat.id}:${cat.id}`;
                                                    const inputValue = newItemInputs[inputKey] || '';

                                                    return (
                                                        <div key={cat.id} className={`rounded-lg p-3 flex flex-col border ${
                                                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151515] border-[#2a2a2a]'
                                                        }`}>
                                                            <div className={`text-[10px] font-bold uppercase flex items-center justify-between pb-2 mb-2 border-b ${
                                                                isLight ? `${cat.lightColor} border-slate-200` : `${cat.color} border-[#282828]`
                                                            }`}>
                                                                <span className="flex items-center gap-1.5">{(() => { const CatIcon = cat.icon; return <CatIcon size={13} className={isLight ? cat.lightColor : cat.color} />; })()} {cat.label}</span>
                                                                <span className={`text-[9px] font-mono ${isLight ? 'text-slate-500 font-bold' : 'text-gray-600'}`}>({items.length})</span>
                                                            </div>

                                                            {/* Item Chips List */}
                                                            <div className="flex-1 space-y-1.5 mb-2 max-h-36 overflow-y-auto custom-scrollbar">
                                                                {items.map((i, idx) => {
                                                                    const name = typeof i === 'string' ? i : i.name;
                                                                    return (
                                                                        <div 
                                                                            key={idx} 
                                                                            className={`text-[11px] px-2 py-1 flex items-center justify-between group/item transition-colors border rounded ${
                                                                                isLight 
                                                                                    ? 'text-slate-800 bg-white hover:bg-slate-100 border-slate-200' 
                                                                                    : 'text-gray-300 bg-[#1e1e1e] hover:bg-[#252525] border-[#303030]'
                                                                            }`} 
                                                                            style={fontStyle}
                                                                        >
                                                                            <span className="truncate pr-1">{name}</span>
                                                                            <button 
                                                                                onClick={() => handleRemoveItemFromBeat(item.beat.id, cat.id as keyof BreakdownData, idx)}
                                                                                className="opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 p-0.5 transition-opacity"
                                                                                title="Remove item"
                                                                            >
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {items.length === 0 && (
                                                                    <div className={`text-[10px] italic py-1 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>No items logged</div>
                                                                )}
                                                            </div>

                                                            {/* Quick In-line Item Input */}
                                                            <div className={`mt-auto pt-2 flex items-center gap-1 border-t ${isLight ? 'border-slate-200' : 'border-[#222]'}`}>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder={`+ Add ${cat.label.split(' ')[0]}...`}
                                                                    value={inputValue}
                                                                    onChange={(e) => setNewItemInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleAddItemToBeat(item.beat.id, cat.id as keyof BreakdownData, inputValue);
                                                                        }
                                                                    }}
                                                                    className={`w-full rounded px-2 py-1 text-[10px] outline-none focus:border-[#f5a623] border ${
                                                                        isLight 
                                                                            ? 'bg-white border-slate-350 text-slate-900 placeholder-slate-400' 
                                                                            : 'bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-gray-650'
                                                                    }`}
                                                                />
                                                                <button 
                                                                    onClick={() => handleAddItemToBeat(item.beat.id, cat.id as keyof BreakdownData, inputValue)}
                                                                    className={`p-1 rounded transition-colors ${
                                                                        isLight 
                                                                            ? 'bg-slate-200 hover:bg-[#f5a623] hover:text-black text-slate-600' 
                                                                            : 'bg-[#252525] hover:bg-[#f5a623] hover:text-black text-gray-400'
                                                                    }`}
                                                                    title="Add"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                                {displayedScenes.length === 0 && (
                                    <div className={`h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl ${
                                        isLight 
                                            ? 'bg-white border-slate-300 text-slate-400' 
                                            : 'bg-[#161616] border-[#222] text-[#333]'
                                    }`}>
                                        <Sparkles size={48} className="mb-4 opacity-10 text-[#f5a623]" />
                                        <p className={`text-sm font-bold uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-[#555]'}`}>No Scenes Found</p>
                                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-600'}`}>
                                            {selectedCategory !== 'all' 
                                                ? `No scenes contain items logged under "${CATEGORIES.find(c => c.id === selectedCategory)?.label}".` 
                                                : 'No scenes match your current filter.'}
                                        </p>
                                        <button 
                                            onClick={() => { setSelectedCategory('all'); setSearchTerm(''); }}
                                            className={`mt-4 px-3.5 py-1.5 text-xs font-bold rounded-lg uppercase transition-colors ${
                                                isLight 
                                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' 
                                                    : 'bg-[#252525] hover:bg-[#333] text-gray-300'
                                            }`}
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Category Manifest View */
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 animate-in fade-in duration-300 max-w-7xl mx-auto">
                                {filteredData.map((item, idx) => {
                                    const catMeta = getCategoryMeta(item.category);
                                    const colorClass = isLight ? (catMeta?.lightColor || 'text-slate-800') : (catMeta?.color || 'text-gray-200');
                                    const bgClass = isLight ? (catMeta?.lightBg || 'bg-slate-100') : (catMeta?.bg || 'bg-[#222]');
                                    const borderClass = isLight ? (catMeta?.lightBorder || 'border-slate-200') : (catMeta?.border || 'border-[#333]');
                                    return (
                                        <div key={idx} className={`border rounded-xl p-5 flex flex-col hover:border-amber-500/50 transition-all group shadow-sm ${
                                            isLight ? 'bg-white border-slate-200 hover:shadow-md' : 'bg-[#1a1a1a] border-[#333]'
                                        }`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${bgClass} border ${borderClass}`}>
                                                        {catMeta && (() => { const CatMetaIcon = catMeta.icon; return <CatMetaIcon size={18} className={colorClass} />; })()}
                                                    </div>
                                                    <div>
                                                        <h3 className={`text-sm font-bold transition-colors ${isLight ? 'text-slate-800 group-hover:text-slate-950' : 'text-gray-200 group-hover:text-white'}`} style={fontStyle}>
                                                            {item.name}
                                                        </h3>
                                                        <div className={`text-[10px] font-bold uppercase mt-0.5 ${colorClass}`}>{catMeta?.label}</div>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                                    isLight ? 'bg-slate-100 text-slate-650 border-slate-200' : 'bg-[#252525] text-gray-400 border-[#333]'
                                                }`}>
                                                    {item.scenes.length} Scene{item.scenes.length === 1 ? '' : 's'}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 mt-2">
                                                <div className={`text-[9px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Occurrences</div>
                                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                                                    {item.scenes.map((scene, sIdx) => (
                                                        <div key={sIdx} className={`text-[9px] font-bold px-2 py-1 rounded border flex items-center gap-1 ${
                                                            isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-[#222] text-gray-300 border-[#333]'
                                                        }`} title={scene.slug}>
                                                            <span>SC {scene.sceneNum}</span>
                                                            {scene.shotCount > 0 && (
                                                                <span className={`text-[8px] px-1 rounded ${
                                                                    isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-950 text-purple-300'
                                                                }`}>
                                                                    {scene.shotCount} shots
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredData.length === 0 && (
                                    <div className={`col-span-full h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl ${
                                        isLight 
                                            ? 'bg-white border-slate-300 text-slate-400' 
                                            : 'bg-[#161616] border-[#222] text-[#333]'
                                    }`}>
                                        <Sparkles size={48} className="mb-4 opacity-10 text-[#f5a623]" />
                                        <p className={`text-sm font-bold uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-[#555]'}`}>Manifest Empty</p>
                                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-600'}`}>Run AI Analyze or add breakdown items manually to scenes.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Inspector Drawer for Detailed Scene Syncing */}
                    {activeInspectorBeat && (
                        <div className={`w-96 border-l flex flex-col shrink-0 z-30 shadow-2xl animate-in slide-in-from-right duration-200 ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#161616] border-[#333]'
                        }`}>
                            <div className={`p-4 border-b flex items-center justify-between ${
                                isLight ? 'bg-white border-slate-200' : 'bg-[#1d1d1d] border-[#333]'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <Layers size={16} className="text-[#f5a623]" />
                                    <div>
                                        <h3 className={`text-xs font-black uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            Scene {activeInspectorBeat.sceneNumber || (beats.indexOf(activeInspectorBeat) + 1)} Inspector
                                        </h3>
                                        <p className={`text-[9px] truncate max-w-[200px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                            {activeInspectorBeat.slug.location || 'Location'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveInspectorBeatId(null)}
                                    className={`p-1 rounded hover:bg-[#333] transition-colors ${isLight ? 'text-slate-500 hover:text-slate-950 hover:bg-slate-200' : 'text-gray-500 hover:text-white'}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                                {/* Storyboard Shots for Active Scene */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5"><Camera size={12} /> Storyboard Division</span>
                                        <span className="text-[9px] font-mono text-gray-500">{activeInspectorShots.length} Shots</span>
                                    </h4>
                                    {activeInspectorShots.length > 0 ? (
                                        <div className="space-y-2">
                                            {activeInspectorShots.map((shot, sIdx) => (
                                                <div key={shot.id || sIdx} className={`p-2.5 rounded-lg flex gap-3 border ${
                                                    isLight ? 'bg-white border-slate-200' : 'bg-[#1e1e1e] border-[#333]'
                                                }`}>
                                                    <div className="w-16 h-12 bg-black rounded border border-[#333] overflow-hidden shrink-0 relative flex items-center justify-center">
                                                        {shot.imageUrl ? (
                                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Film size={14} className="text-gray-600" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-[10px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Shot #{sIdx + 1}: {shot.shotSize || 'Wide'}</div>
                                                        <div className="text-[9px] text-[#f5a623] font-mono truncate">{shot.lens} • {shot.movement}</div>
                                                        <div className={`text-[9px] truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{shot.subject || shot.description}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`text-[10px] italic p-3 rounded border ${
                                            isLight ? 'bg-white border-slate-200 text-slate-400' : 'bg-[#1e1e1e] border-[#333] text-gray-500'
                                        }`}>
                                            No storyboard shots assigned to this scene.
                                        </div>
                                    )}
                                </div>

                                {/* Formatted Script Text */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileText size={12} /> Full Script
                                    </h4>
                                    <div 
                                        className={`p-3 rounded-lg border text-xs font-mono leading-relaxed max-h-72 overflow-y-auto custom-scrollbar prose ${
                                            isLight ? 'bg-white border-slate-200 text-slate-800 prose-slate' : 'bg-[#111] border-[#333] text-gray-300 prose-invert'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: activeInspectorBeat.content || '<em>No script content.</em>' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Toast Feedback Notification */}
                    {toastMessage && (
                        <div className={`fixed bottom-6 right-6 z-50 border border-[#f5a623] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
                            isLight ? 'bg-white text-slate-900 shadow-slate-200/50' : 'bg-[#1e1e24] text-white shadow-black/50'
                        }`}>
                            <Check size={18} className="text-emerald-400" />
                            <span className="text-xs font-bold font-mono">{toastMessage}</span>
                        </div>
                    )}

                    {/* Department Quick List Share / Copy Modal */}
                    {isShareModalOpen && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className={`border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] ${
                                isLight ? 'bg-white border-slate-305 text-slate-800' : 'bg-[#18181b] border border-[#333]'
                            }`}>
                                {/* Modal Header */}
                                <div className={`p-4 border-b flex items-center justify-between ${
                                    isLight ? 'bg-slate-50 border-slate-205' : 'bg-[#202024] border-[#333]'
                                }`}>
                                    <div className="flex items-center gap-2.5">
                                        <Share2 size={18} className="text-[#f5a623]" />
                                        <div>
                                            <h3 className={`text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                Send / Copy Department Manifest List
                                            </h3>
                                            <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                Copy formatted list to send directly to props master, costume designer, sound team, etc.
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsShareModalOpen(false)}
                                        className={`p-1 rounded-lg transition-colors ${
                                            isLight ? 'text-slate-500 hover:text-slate-805 hover:bg-slate-205' : 'text-gray-400 hover:text-white hover:bg-[#333]'
                                        }`}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Project Metadata Header Customization Bar */}
                                <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-3 ${
                                    isLight ? 'bg-slate-100 border-slate-205' : 'bg-[#161619] border-[#28282e]'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={includeProjectMetadata} 
                                                onChange={(e) => setIncludeProjectMetadata(e.target.checked)}
                                                className={`rounded accent-[#f5a623] cursor-pointer ${isLight ? 'border-slate-350' : 'border-gray-700'}`}
                                            />
                                            Header Metadata:
                                        </label>
                                    </div>

                                    {includeProjectMetadata && (
                                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                                            <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg ${
                                                isLight ? 'bg-white border-slate-250' : 'bg-[#0e0e11] border-[#333]'
                                            }`}>
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Project:</span>
                                                <input 
                                                    type="text" 
                                                    value={customProjectName} 
                                                    onChange={(e) => setCustomProjectName(e.target.value)}
                                                    placeholder={activeProjectName}
                                                    className={`bg-transparent text-xs font-bold outline-none w-28 focus:w-36 transition-all ${
                                                        isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-600'
                                                    }`}
                                                />
                                            </div>
                                            <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg ${
                                                isLight ? 'bg-white border-slate-250' : 'bg-[#0e0e11] border-[#333]'
                                            }`}>
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Production:</span>
                                                <input 
                                                    type="text" 
                                                    value={productionCompany} 
                                                    onChange={(e) => setProductionCompany(e.target.value)}
                                                    placeholder="Apex Pictures"
                                                    className={`bg-transparent text-xs font-bold outline-none w-28 focus:w-36 transition-all ${
                                                        isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-600'
                                                    }`}
                                                />
                                            </div>
                                            <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg ${
                                                isLight ? 'bg-white border-slate-250' : 'bg-[#0e0e11] border-[#333]'
                                            }`}>
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Director:</span>
                                                <input 
                                                    type="text" 
                                                    value={directorName} 
                                                    onChange={(e) => setDirectorName(e.target.value)}
                                                    placeholder="Director Name"
                                                    className={`bg-transparent text-xs font-bold outline-none w-24 focus:w-32 transition-all ${
                                                        isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-600'
                                                    }`}
                                                />
                                            </div>

                                            <div className={`h-4 w-px mx-1 ${isLight ? 'bg-slate-300' : 'bg-[#333]'}`}></div>

                                            <label className="text-[10px] font-mono font-bold text-cyan-500 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ml-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={includeHodSignoff} 
                                                    onChange={(e) => setIncludeHodSignoff(e.target.checked)}
                                                    className={`rounded accent-cyan-500 cursor-pointer ${isLight ? 'border-slate-350' : 'border-gray-700'}`}
                                                />
                                                HOD Sign-off:
                                            </label>

                                            {includeHodSignoff && (
                                                <>
                                                    <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg ${
                                                        isLight ? 'bg-white border-slate-250' : 'bg-[#0e0e11] border-[#333]'
                                                    }`}>
                                                        <span className="text-[9px] font-mono text-gray-500 uppercase">HOD:</span>
                                                        <input 
                                                            type="text" 
                                                            value={hodName} 
                                                            onChange={(e) => setHodName(e.target.value)}
                                                            placeholder="Dept Head"
                                                            className={`bg-transparent text-xs font-bold outline-none w-24 focus:w-32 transition-all ${
                                                                isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-600'
                                                            }`}
                                                        />
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg ${
                                                        isLight ? 'bg-white border-slate-250' : 'bg-[#0e0e11] border-[#333]'
                                                    }`}>
                                                        <span className="text-[9px] font-mono text-gray-500 uppercase">Dept:</span>
                                                        <input 
                                                            type="text" 
                                                            value={hodDept} 
                                                            onChange={(e) => setHodDept(e.target.value)}
                                                            placeholder="Camera / Art"
                                                            className={`bg-transparent text-xs font-bold outline-none w-24 focus:w-32 transition-all ${
                                                                isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-600'
                                                            }`}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Category Picker */}
                                <div className={`p-4 border-b flex items-center gap-2 overflow-x-auto custom-scrollbar ${
                                    isLight ? 'bg-slate-50 border-slate-205' : 'bg-[#121214] border-[#28282e]'
                                }`}>
                                    {CATEGORIES.map(cat => {
                                        const CatIcon = cat.icon;
                                        const isSel = shareCategory === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setShareCategory(cat.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                                                    isSel 
                                                        ? 'bg-[#f5a623] text-black shadow' 
                                                        : (isLight ? 'bg-slate-200 text-slate-650 hover:text-slate-900 hover:bg-slate-250' : 'bg-[#222226] text-gray-400 hover:text-white hover:bg-[#2c2c32]')
                                                }`}
                                            >
                                                <CatIcon size={14} />
                                                <span>{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Text Area Preview */}
                                <div className={`p-4 flex-1 overflow-y-auto custom-scrollbar ${
                                    isLight ? 'bg-slate-100' : 'bg-[#0d0d0f]'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                            Formatted Plain Text (Ready to Copy/Send)
                                        </span>
                                        <span className="text-[10px] text-emerald-500 font-mono font-bold">
                                            Auto-Synced with Script Breakdown
                                        </span>
                                    </div>
                                    <textarea 
                                        readOnly
                                        value={generateCategoryTextList(shareCategory)}
                                        className={`w-full h-64 border text-xs font-mono p-3.5 rounded-xl outline-none select-all custom-scrollbar leading-relaxed ${
                                            isLight ? 'bg-white border-slate-350 text-slate-800' : 'bg-[#141417] border-[#26262a] text-gray-200'
                                        }`}
                                    />
                                </div>

                                {/* Modal Actions */}
                                <div className={`p-4 border-t flex items-center justify-between ${
                                    isLight ? 'bg-slate-50 border-slate-205 text-slate-650' : 'bg-[#1a1a1e] border-[#333] text-gray-400'
                                }`}>
                                    <div className="text-[11px] font-mono font-bold">
                                        Tip: Paste this list into WhatsApp, Email, or Slack
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handlePrintBreakdown(shareCategory)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                                isLight ? 'text-slate-700 bg-slate-200 hover:bg-slate-250 border-slate-300' : 'text-gray-200 bg-[#282830] hover:bg-[#383842] border-[#444]'
                                            }`}
                                        >
                                            <Printer size={14} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
                                            <span>Print List / PDF</span>
                                        </button>
                                        <button 
                                            onClick={() => setIsShareModalOpen(false)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                                                isLight ? 'text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200' : 'text-gray-400 hover:text-white bg-[#26262a] hover:bg-[#333]'
                                            }`}
                                        >
                                            Close
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const text = generateCategoryTextList(shareCategory);
                                                navigator.clipboard.writeText(text);
                                                showToast(`Copied ${CATEGORIES.find(c => c.id === shareCategory)?.label} list to clipboard!`);
                                                setIsShareModalOpen(false);
                                            }}
                                            className="px-5 py-2 rounded-xl text-xs font-black text-black bg-[#f5a623] hover:bg-[#e0951a] transition-all shadow-lg flex items-center gap-2"
                                        >
                                            <Copy size={14} />
                                            <span>Copy List to Clipboard</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BreakdownView;
