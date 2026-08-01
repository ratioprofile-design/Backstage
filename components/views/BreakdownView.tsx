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
    { id: 'all', label: 'Total Manifest', icon: ListChecks, color: 'text-gray-300', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
    { id: 'cast', label: 'Cast & Extras', icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    { id: 'props', label: 'Props', icon: Package, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    { id: 'costume', label: 'Wardrobe', icon: Shirt, color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/30' },
    { id: 'vfx', label: 'Visual Effects', icon: Wand2, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
    { id: 'practical', label: 'Special Effects', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    { id: 'sound', label: 'Sound / SFX', icon: Mic2, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    { id: 'location', label: 'Locations', icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
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
        currentProjectId = null
    } = useProject();

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
        <div className="flex w-full h-full bg-[#121212] overflow-hidden font-sans text-gray-300">
            {/* Sidebar Manifest Categories */}
            <div className="w-72 bg-[#1a1a1a] border-r border-[#333] flex flex-col shrink-0 z-20 shadow-xl relative">
                <div className="p-5 border-b border-[#333] bg-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <ListChecks size={16} className="text-[#f5a623]" /> Breakdown Manifest
                        </h2>
                        <span className="text-[9px] font-mono bg-green-900/30 text-green-400 border border-green-700/30 px-1.5 py-0.5 rounded uppercase">
                            Live Sync
                        </span>
                    </div>
                    <p className="text-[10px] text-[#777] font-medium uppercase">Script & Storyboard Assets</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                    {CATEGORIES.map(cat => {
                        const count = categoryCounts[cat.id] || 0;
                        const isActive = selectedCategory === cat.id;
                        const CatIcon = cat.icon;
                        return (
                            <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategory(cat.id)} 
                                className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all duration-200 group ${isActive ? 'bg-[#2a2a2a] shadow-inner text-white' : 'hover:bg-[#222] text-[#888]'}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg ${isActive ? cat.bg : 'bg-[#222] group-hover:bg-[#2a2a2a]'} transition-colors`}>
                                        <CatIcon size={15} className={isActive ? cat.color : 'text-gray-500'} />
                                    </div>
                                    <span className="text-xs font-bold">{cat.label}</span>
                                </div>
                                {count > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#f5a623] text-black' : 'bg-[#333] text-gray-500'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Quick Summary Metrics Box */}
                <div className="p-4 border-t border-[#333] bg-[#141414] space-y-2">
                    <div className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Sync Overview</div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-[#1e1e1e] border border-[#333] rounded-lg p-2">
                            <div className="text-base font-black text-white">{beats.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase font-bold">Scenes</div>
                        </div>
                        <div className="bg-[#1e1e1e] border border-[#333] rounded-lg p-2">
                            <div className="text-base font-black text-[#f5a623]">{generatedShots.length}</div>
                            <div className="text-[9px] text-gray-500 uppercase font-bold">Storyboard Shots</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Workspace */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#121212]">
                {/* Control Header Bar */}
                <div className="bg-[#111] h-14 border-b border-[#222] px-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-md px-2 py-1">
                           <span className="text-[10px] font-bold text-[#666] uppercase mr-1">SCENE</span>
                           <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={startScene} onChange={e => setStartScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                           <span className="text-gray-600 font-bold text-xs">-</span>
                           <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={endScene} onChange={e => setEndScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                        </div>

                        <button 
                            onClick={() => setBreakdownLockedOnly(!breakdownLockedOnly)} 
                            disabled={isAnalyzing} 
                            title={breakdownLockedOnly ? "Analyzing Locked Scenes Only" : "Analyze All Scenes"}
                            className={`flex items-center justify-center h-8 px-2.5 gap-1.5 rounded-md border text-xs font-bold transition-all ${breakdownLockedOnly ? 'bg-green-900/20 text-green-400 border-green-800/50' : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white hover:bg-[#333]'}`}
                        >
                            {breakdownLockedOnly ? <Lock size={13} /> : <Unlock size={13} />}
                            <span className="text-[10px] uppercase">{breakdownLockedOnly ? "Locked Only" : "All Drafts"}</span>
                        </button>

                        <button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing} 
                            className="flex items-center gap-2 border border-[#333] px-3.5 py-1.5 rounded-md text-xs font-bold uppercase transition-all bg-[#222] hover:bg-[#f5a623] hover:text-black text-gray-300 disabled:opacity-50"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className="text-[#f5a623]" />} 
                            {isAnalyzing ? 'Analyzing Script...' : 'AI Analyze All'}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden lg:flex items-center gap-2 bg-[#1a1a1a] border border-[#333] px-3 py-1 rounded-md">
                            <FileText size={12} className="text-green-400" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Script & Storyboard Synced</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        </div>

                        <div className="flex bg-[#222] rounded-md border border-[#333] p-0.5 gap-1">
                            <button onClick={() => { setShareCategory(selectedCategory === 'all' ? 'props' : selectedCategory); setIsShareModalOpen(true); }} className="px-2.5 py-1 bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold rounded text-[10px] uppercase transition-all flex items-center gap-1.5 shadow-sm" title="Get formatted list to send to department person">
                                <Share2 size={12} /> Send / Copy List
                            </button>
                            <button onClick={() => handlePrintBreakdown(selectedCategory === 'all' ? 'props' : selectedCategory)} className="px-2.5 py-1 bg-[#28282e] hover:bg-[#383840] text-gray-200 font-bold rounded text-[10px] uppercase transition-all flex items-center gap-1.5" title="Print Breakdown Manifest">
                                <Printer size={12} className="text-amber-400" /> Print
                            </button>
                            <button onClick={() => handleExport('excel')} className="px-2.5 py-1 rounded text-[10px] font-bold uppercase text-gray-400 hover:text-white transition-all flex items-center gap-1.5"><FileSpreadsheet size={12} className="text-green-400" /> Excel</button>
                            <button onClick={() => handleExport('csv')} className="px-2.5 py-1 rounded text-[10px] font-bold uppercase text-gray-400 hover:text-white transition-all flex items-center gap-1.5"><Download size={12} /> CSV</button>
                        </div>

                        <div className="flex bg-[#000] rounded-md p-1 border border-[#333] gap-1">
                           <button onClick={() => setViewType('by-scene')} className={`p-1.5 rounded transition-colors ${viewType === 'by-scene' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Scene View with Storyboard"><ListIcon size={14} /></button>
                           <button onClick={() => setViewType('by-category')} className={`p-1.5 rounded transition-colors ${viewType === 'by-category' ? 'bg-[#333] text-white' : 'text-gray-500 hover:text-gray-300'}`} title="Manifest Asset View"><LayoutGrid size={14} /></button>
                           {viewType === 'by-scene' && (
                              <button 
                                 onClick={() => setShowEmptyCategories(!showEmptyCategories)} 
                                 className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
                                    showEmptyCategories 
                                       ? 'bg-amber-950/40 text-amber-400 border-amber-800/50' 
                                       : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white'
                                 }`}
                                 title={showEmptyCategories ? "Showing all categories (including empty)" : "Hiding empty categories to optimize screen space"}
                              >
                                 {showEmptyCategories ? "Full Grid" : "Compact"}
                              </button>
                           )}
                        </div>
                    </div>

                    <div className="relative w-56">
                        <Search className="absolute left-2.5 top-2.5 text-[#555]" size={13} />
                        <input 
                            type="text" 
                            placeholder="Search Breakdown..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full bg-[#000] border border-[#333] rounded-md pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-[#f5a623]" 
                        />
                    </div>
                </div>

                {/* Progress Bar during Batch AI Analysis */}
                {isAnalyzing && (
                    <div className="bg-[#1a1a1a] border-b border-[#f5a623]/30 px-8 py-3 flex items-center gap-4 shrink-0 shadow-lg z-20">
                        <div className="text-[10px] font-bold text-[#f5a623] uppercase animate-pulse flex items-center gap-2 shrink-0 min-w-[200px]">
                            <Loader2 size={14} className="animate-spin" /> Processing: <span className="text-white truncate max-w-[200px]">{progress.currentScene || `Scene ${startScene + progress.current - 1}`}</span>
                        </div>
                        <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div className="h-full bg-[#f5a623] transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                        </div>
                        <button onClick={() => { abortRef.current = true; }} className="text-[10px] font-bold uppercase text-red-400 hover:text-red-300 bg-red-950/40 border border-red-900/50 px-2.5 py-1 rounded">
                            Stop
                        </button>
                    </div>
                )}

                {/* Main View Area */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {selectedCategory !== 'all' && (
                            <div className="max-w-6xl mx-auto mb-4 bg-[#1c1c22] border border-[#f5a623]/30 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-md">
                                <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                                    <span className="text-gray-400 uppercase text-[10px] tracking-wider font-mono">Active Filter:</span>
                                    {(() => {
                                        const cat = CATEGORIES.find(c => c.id === selectedCategory);
                                        if (!cat) return null;
                                        const Icon = cat.icon;
                                        return (
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${cat.bg} ${cat.border} ${cat.color}`}>
                                                <Icon size={14} />
                                                {cat.label} ({categoryCounts[selectedCategory] || 0} items)
                                            </span>
                                        );
                                    })()}
                                </div>
                                <button 
                                    onClick={() => setSelectedCategory('all')} 
                                    className="text-[10px] font-bold uppercase text-gray-400 hover:text-white bg-[#282828] hover:bg-[#333] px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
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
                                        <div key={item.beat.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden hover:border-[#444] transition-all group shadow-md">
                                            {/* Scene Header Strip */}
                                            <div className="bg-[#222] px-5 py-3.5 border-b border-[#333] flex flex-wrap justify-between items-center gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-center justify-center min-w-[48px] h-12 bg-[#141414] rounded-lg border border-[#333] shadow-inner px-2">
                                                        <span className="text-[8px] font-bold text-[#666] uppercase tracking-wider">SCENE</span>
                                                        <span className="text-base font-black text-white">{item.beat.sceneNumber || item.sceneIndex}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors" style={fontStyle}>
                                                            {item.beat.slug.prefix || 'INT.'} {item.beat.slug.location || 'UNKNOWN LOCATION'} {item.beat.slug.time ? `- ${item.beat.slug.time}` : ''}
                                                        </h4>
                                                        {/* Department Summary Badges in Header */}
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                            {activeCatsForScene.map(cat => {
                                                                const count = item.beat.breakdown?.[cat.id as keyof BreakdownData]?.length || 0;
                                                                const CatIcon = cat.icon;
                                                                return (
                                                                    <span key={cat.id} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${cat.bg} ${cat.border} ${cat.color}`}>
                                                                        <CatIcon size={10} />
                                                                        <span>{cat.label.split(' ')[0]}: {count}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                            {activeCatsForScene.length === 0 && (
                                                                <span className="text-[10px] text-gray-500 font-mono italic">No breakdown items logged</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Copy Scene Breakdown */}
                                                    <button 
                                                        onClick={() => copySceneBreakdown(item.beat, (item.beat.sceneNumber || item.sceneIndex).toString())}
                                                        className="p-1.5 bg-[#181818] hover:bg-[#333] border border-[#333] text-gray-400 hover:text-white rounded transition-colors"
                                                        title="Copy Scene Breakdown List"
                                                    >
                                                        <Copy size={13} />
                                                    </button>

                                                    {/* Print Scene Breakdown */}
                                                    <button 
                                                        onClick={() => handlePrintScene(item.beat)}
                                                        className="p-1.5 bg-[#181818] hover:bg-[#333] border border-[#333] text-gray-400 hover:text-white rounded transition-colors"
                                                        title="Print Scene Breakdown Sheet"
                                                    >
                                                        <Printer size={13} className="text-amber-400" />
                                                    </button>
                                                    {/* Toggle Script Snippet */}
                                                    <button 
                                                        onClick={() => setExpandedScenes(prev => ({
                                                            ...prev,
                                                            [item.beat.id]: { ...prev[item.beat.id], script: !isScriptOpen }
                                                        }))}
                                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 transition-colors ${
                                                            isScriptOpen ? 'bg-blue-950/40 text-blue-400 border-blue-800/40' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white'
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
                                                            isShotsOpen ? 'bg-purple-950/40 text-purple-400 border-purple-800/40' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white'
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
                                                        className="px-2.5 py-1 bg-[#181818] hover:bg-[#f5a623] hover:text-black border border-[#333] text-gray-400 rounded text-[10px] font-bold uppercase flex items-center gap-1 transition-all disabled:opacity-50"
                                                    >
                                                        {isBeingAnalyzed ? <Loader2 size={12} className="animate-spin text-[#f5a623]" /> : <Wand2 size={12} className="text-[#f5a623]" />}
                                                        <span>{isBeingAnalyzed ? 'Analyzing...' : 'Re-Break'}</span>
                                                    </button>

                                                    {/* Inspect Drawer Toggle */}
                                                    <button 
                                                        onClick={() => setActiveInspectorBeatId(activeInspectorBeatId === item.beat.id ? null : item.beat.id)}
                                                        className={`p-1.5 rounded border transition-colors ${
                                                            activeInspectorBeatId === item.beat.id ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-[#181818] text-gray-400 border-[#333] hover:text-white'
                                                        }`}
                                                        title="Open Scene Inspector"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expandable Script Section */}
                                            {isScriptOpen && (
                                                <div className="bg-[#141414] p-4 border-b border-[#2a2a2a] text-xs font-mono text-gray-300 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar border-l-2 border-l-blue-500">
                                                    <div className="text-[9px] font-bold uppercase text-blue-400 mb-2 tracking-widest flex items-center gap-1">
                                                        <FileText size={10} /> Script Content (Scene {item.sceneNum})
                                                    </div>
                                                    <div 
                                                        className="prose prose-invert max-w-none text-xs text-gray-300"
                                                        dangerouslySetInnerHTML={{ __html: item.beat.content || '<em class="text-gray-600">No script content written for this scene.</em>' }}
                                                    />
                                                </div>
                                            )}

                                            {/* Expandable Storyboard Shots Section */}
                                            {isShotsOpen && (
                                                <div className="bg-[#111] p-4 border-b border-[#2a2a2a] border-l-2 border-l-purple-500">
                                                    <div className="text-[9px] font-bold uppercase text-purple-400 mb-3 tracking-widest flex items-center gap-1.5">
                                                        <Camera size={11} /> Storyboard Shot Division ({item.shots.length} Shots)
                                                    </div>
                                                    {item.shots.length > 0 ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                            {item.shots.map((shot, sIdx) => (
                                                                <div key={shot.id || sIdx} className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden flex flex-col group/shot hover:border-purple-500/50 transition-colors">
                                                                    <div className="h-20 bg-black relative flex items-center justify-center overflow-hidden">
                                                                        {shot.imageUrl ? (
                                                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <Film size={20} className="text-gray-700" />
                                                                        )}
                                                                        <div className="absolute top-1 left-1 bg-black/70 text-white font-mono text-[8px] font-bold px-1 rounded border border-white/20">
                                                                            SHOT #{sIdx + 1}
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-2 space-y-1">
                                                                        <div className="text-[10px] font-bold text-gray-200 truncate">{shot.shotSize || 'Wide'} • {shot.angle || 'Eye Level'}</div>
                                                                        {(shot.lens || shot.movement) && (
                                                                            <div className="text-[8px] font-mono text-[#f5a623] truncate">
                                                                                {shot.lens} {shot.movement ? `(${shot.movement})` : ''}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[9px] text-gray-400 line-clamp-2 leading-tight">{shot.subject || shot.description || 'No camera notes'}</div>
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
                                                        <div key={cat.id} className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 flex flex-col">
                                                            <div className={`text-[10px] font-bold uppercase flex items-center justify-between pb-2 mb-2 border-b border-[#282828] ${cat.color}`}>
                                                                <span className="flex items-center gap-1.5">{(() => { const CatIcon = cat.icon; return <CatIcon size={13} />; })()} {cat.label}</span>
                                                                <span className="text-[9px] text-gray-600 font-mono">({items.length})</span>
                                                            </div>

                                                            {/* Item Chips List */}
                                                            <div className="flex-1 space-y-1.5 mb-2 max-h-36 overflow-y-auto custom-scrollbar">
                                                                {items.map((i, idx) => {
                                                                    const name = typeof i === 'string' ? i : i.name;
                                                                    return (
                                                                        <div 
                                                                            key={idx} 
                                                                            className="text-[11px] text-gray-300 bg-[#1e1e1e] hover:bg-[#252525] border border-[#303030] rounded px-2 py-1 flex items-center justify-between group/item transition-colors" 
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
                                                                    <div className="text-[10px] text-gray-600 italic py-1">No items logged</div>
                                                                )}
                                                            </div>

                                                            {/* Quick In-line Item Input */}
                                                            <div className="mt-auto pt-2 border-t border-[#222] flex items-center gap-1">
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
                                                                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#f5a623]"
                                                                />
                                                                <button 
                                                                    onClick={() => handleAddItemToBeat(item.beat.id, cat.id as keyof BreakdownData, inputValue)}
                                                                    className="p-1 bg-[#252525] hover:bg-[#f5a623] hover:text-black rounded text-gray-400 transition-colors"
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
                                    <div className="h-96 flex flex-col items-center justify-center text-[#333] border-2 border-dashed border-[#222] rounded-2xl bg-[#161616]">
                                        <Sparkles size={48} className="mb-4 opacity-10 text-[#f5a623]" />
                                        <p className="text-sm font-bold uppercase tracking-widest text-[#555]">No Scenes Found</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {selectedCategory !== 'all' 
                                                ? `No scenes contain items logged under "${CATEGORIES.find(c => c.id === selectedCategory)?.label}".` 
                                                : 'No scenes match your current filter.'}
                                        </p>
                                        <button 
                                            onClick={() => { setSelectedCategory('all'); setSearchTerm(''); }}
                                            className="mt-4 px-3.5 py-1.5 bg-[#252525] hover:bg-[#333] text-gray-300 text-xs font-bold rounded-lg uppercase transition-colors"
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
                                    return (
                                        <div key={idx} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 flex flex-col hover:border-[#555] transition-all group shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${catMeta?.bg} border ${catMeta?.border}`}>
                                                        {catMeta && (() => { const CatMetaIcon = catMeta.icon; return <CatMetaIcon size={18} className={catMeta.color} />; })()}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors" style={fontStyle}>
                                                            {item.name}
                                                        </h3>
                                                        <div className="text-[10px] text-[#666] font-medium uppercase mt-0.5">{catMeta?.label}</div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold bg-[#252525] text-gray-400 px-2.5 py-1 rounded-full border border-[#333]">
                                                    {item.scenes.length} Scene{item.scenes.length === 1 ? '' : 's'}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5 mt-2">
                                                <div className="text-[9px] font-bold uppercase text-gray-500">Occurrences</div>
                                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                                                    {item.scenes.map((scene, sIdx) => (
                                                        <div key={sIdx} className="text-[9px] font-bold bg-[#222] text-gray-300 px-2 py-1 rounded border border-[#333] flex items-center gap-1" title={scene.slug}>
                                                            <span>SC {scene.sceneNum}</span>
                                                            {scene.shotCount > 0 && (
                                                                <span className="text-[8px] bg-purple-950 text-purple-300 px-1 rounded">
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
                                    <div className="col-span-full h-96 flex flex-col items-center justify-center text-[#333] border-2 border-dashed border-[#222] rounded-2xl bg-[#161616]">
                                        <Sparkles size={48} className="mb-4 opacity-10 text-[#f5a623]" />
                                        <p className="text-sm font-bold uppercase tracking-widest text-[#555]">Manifest Empty</p>
                                        <p className="text-xs text-gray-600 mt-1">Run AI Analyze or add breakdown items manually to scenes.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Inspector Drawer for Detailed Scene Syncing */}
                    {activeInspectorBeat && (
                        <div className="w-96 bg-[#161616] border-l border-[#333] flex flex-col shrink-0 z-30 shadow-2xl animate-in slide-in-from-right duration-200">
                            <div className="p-4 border-b border-[#333] bg-[#1d1d1d] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers size={16} className="text-[#f5a623]" />
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase">
                                            Scene {activeInspectorBeat.sceneNumber || (beats.indexOf(activeInspectorBeat) + 1)} Inspector
                                        </h3>
                                        <p className="text-[9px] text-gray-500 truncate max-w-[200px]">
                                            {activeInspectorBeat.slug.location || 'Location'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveInspectorBeatId(null)}
                                    className="p-1 text-gray-500 hover:text-white rounded hover:bg-[#333]"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                                {/* Storyboard Shots for Active Scene */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5"><Camera size={12} /> Storyboard Division</span>
                                        <span className="text-[9px] font-mono text-gray-500">{activeInspectorShots.length} Shots</span>
                                    </h4>
                                    {activeInspectorShots.length > 0 ? (
                                        <div className="space-y-2">
                                            {activeInspectorShots.map((shot, sIdx) => (
                                                <div key={shot.id || sIdx} className="bg-[#1e1e1e] border border-[#333] p-2.5 rounded-lg flex gap-3">
                                                    <div className="w-16 h-12 bg-black rounded border border-[#333] overflow-hidden shrink-0 relative flex items-center justify-center">
                                                        {shot.imageUrl ? (
                                                            <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Film size={14} className="text-gray-600" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-white truncate">Shot #{sIdx + 1}: {shot.shotSize || 'Wide'}</div>
                                                        <div className="text-[9px] text-[#f5a623] font-mono truncate">{shot.lens} • {shot.movement}</div>
                                                        <div className="text-[9px] text-gray-400 truncate">{shot.subject || shot.description}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-gray-500 italic bg-[#1e1e1e] p-3 rounded border border-[#333]">
                                            No storyboard shots assigned to this scene.
                                        </div>
                                    )}
                                </div>

                                {/* Formatted Script Text */}
                                <div>
                                    <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileText size={12} /> Full Script
                                    </h4>
                                    <div 
                                        className="bg-[#111] p-3 rounded-lg border border-[#333] text-xs font-mono text-gray-300 leading-relaxed max-h-72 overflow-y-auto custom-scrollbar prose prose-invert"
                                        dangerouslySetInnerHTML={{ __html: activeInspectorBeat.content || '<em>No script content.</em>' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Toast Feedback Notification */}
                    {toastMessage && (
                        <div className="fixed bottom-6 right-6 z-50 bg-[#1e1e24] border border-[#f5a623] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
                            <Check size={18} className="text-emerald-400" />
                            <span className="text-xs font-bold font-mono">{toastMessage}</span>
                        </div>
                    )}

                    {/* Department Quick List Share / Copy Modal */}
                    {isShareModalOpen && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-[#18181b] border border-[#333] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                                {/* Modal Header */}
                                <div className="bg-[#202024] p-4 border-b border-[#333] flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <Share2 size={18} className="text-[#f5a623]" />
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                                Send / Copy Department Manifest List
                                            </h3>
                                            <p className="text-[11px] text-gray-400">
                                                Copy formatted list to send directly to props master, costume designer, sound team, etc.
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsShareModalOpen(false)}
                                        className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-[#333] transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Project Metadata Header Customization Bar */}
                                <div className="px-4 py-2.5 bg-[#161619] border-b border-[#28282e] flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={includeProjectMetadata} 
                                                onChange={(e) => setIncludeProjectMetadata(e.target.checked)}
                                                className="rounded border-gray-700 accent-[#f5a623] cursor-pointer"
                                            />
                                            Header Metadata:
                                        </label>
                                    </div>

                                    {includeProjectMetadata && (
                                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                                            <div className="flex items-center gap-1.5 bg-[#0e0e11] border border-[#333] px-2 py-1 rounded-lg">
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Project:</span>
                                                <input 
                                                    type="text" 
                                                    value={customProjectName} 
                                                    onChange={(e) => setCustomProjectName(e.target.value)}
                                                    placeholder={activeProjectName}
                                                    className="bg-transparent text-xs text-white font-bold outline-none w-28 focus:w-36 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-[#0e0e11] border border-[#333] px-2 py-1 rounded-lg">
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Production:</span>
                                                <input 
                                                    type="text" 
                                                    value={productionCompany} 
                                                    onChange={(e) => setProductionCompany(e.target.value)}
                                                    placeholder="Apex Pictures"
                                                    className="bg-transparent text-xs text-white font-bold outline-none w-28 focus:w-36 transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-[#0e0e11] border border-[#333] px-2 py-1 rounded-lg">
                                                <span className="text-[9px] font-mono text-gray-500 uppercase">Director:</span>
                                                <input 
                                                    type="text" 
                                                    value={directorName} 
                                                    onChange={(e) => setDirectorName(e.target.value)}
                                                    placeholder="Director Name"
                                                    className="bg-transparent text-xs text-white font-bold outline-none w-24 focus:w-32 transition-all placeholder-gray-600"
                                                />
                                            </div>

                                            <div className="h-4 w-px bg-[#333] mx-1"></div>

                                            <label className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ml-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={includeHodSignoff} 
                                                    onChange={(e) => setIncludeHodSignoff(e.target.checked)}
                                                    className="rounded border-gray-700 accent-cyan-500 cursor-pointer"
                                                />
                                                HOD Sign-off:
                                            </label>

                                            {includeHodSignoff && (
                                                <>
                                                    <div className="flex items-center gap-1.5 bg-[#0e0e11] border border-[#333] px-2 py-1 rounded-lg">
                                                        <span className="text-[9px] font-mono text-gray-500 uppercase">HOD:</span>
                                                        <input 
                                                            type="text" 
                                                            value={hodName} 
                                                            onChange={(e) => setHodName(e.target.value)}
                                                            placeholder="Dept Head"
                                                            className="bg-transparent text-xs text-white font-bold outline-none w-24 focus:w-32 transition-all placeholder-gray-600"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-[#0e0e11] border border-[#333] px-2 py-1 rounded-lg">
                                                        <span className="text-[9px] font-mono text-gray-500 uppercase">Dept:</span>
                                                        <input 
                                                            type="text" 
                                                            value={hodDept} 
                                                            onChange={(e) => setHodDept(e.target.value)}
                                                            placeholder="Camera / Art"
                                                            className="bg-transparent text-xs text-white font-bold outline-none w-24 focus:w-32 transition-all placeholder-gray-600"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Category Picker */}
                                <div className="p-4 border-b border-[#28282e] bg-[#121214] flex items-center gap-2 overflow-x-auto custom-scrollbar">
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
                                                        : 'bg-[#222226] text-gray-400 hover:text-white hover:bg-[#2c2c32]'
                                                }`}
                                            >
                                                <CatIcon size={14} />
                                                <span>{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Text Area Preview */}
                                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[#0d0d0f]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-mono font-bold text-gray-500 uppercase">
                                            Formatted Plain Text (Ready to Copy/Send)
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-mono">
                                            Auto-Synced with Script Breakdown
                                        </span>
                                    </div>
                                    <textarea 
                                        readOnly
                                        value={generateCategoryTextList(shareCategory)}
                                        className="w-full h-64 bg-[#141417] border border-[#26262a] text-xs font-mono text-gray-200 p-3.5 rounded-xl outline-none select-all custom-scrollbar leading-relaxed"
                                    />
                                </div>

                                {/* Modal Actions */}
                                <div className="p-4 border-t border-[#333] bg-[#1a1a1e] flex items-center justify-between">
                                    <div className="text-[11px] text-gray-400 font-mono">
                                        Tip: Paste this list into WhatsApp, Email, or Slack
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handlePrintBreakdown(shareCategory)}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-200 bg-[#282830] hover:bg-[#383842] border border-[#444] transition-all flex items-center gap-1.5"
                                        >
                                            <Printer size={14} className="text-amber-400" />
                                            <span>Print List / PDF</span>
                                        </button>
                                        <button 
                                            onClick={() => setIsShareModalOpen(false)}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-[#26262a] hover:bg-[#333] transition-colors"
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
