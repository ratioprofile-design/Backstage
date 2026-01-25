
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BreakdownData } from '../../types';
import { generateBreakdown } from '../../services/gemini';
import { 
    ListChecks, Users, Package, Mic2, Shirt, Wand2, Flame, Map as MapIcon, 
    Search, LayoutGrid, List as ListIcon, Eye, 
    Sparkles, Loader2, StopCircle, Trash2, Clock, Hash,
    Lock, Unlock, Layers, Box, Tag, AlertCircle, Play, Download, Table2, FileSpreadsheet
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
    { id: 'location', label: 'Locations', icon: MapIcon, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
];

const BreakdownView: React.FC = () => {
    const { beats, updateBeat, geminiApiKey, breakdownLanguage, breakdownLockedOnly, setBreakdownLockedOnly, scriptConfig, scratchpadConfig } = useProject();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState<'by-category' | 'by-scene'>('by-scene');

    // --- ANALYSIS CONFIG ---
    const [startScene, setStartScene] = useState(1);
    const [endScene, setEndScene] = useState(beats.length || 1);
    const [delay, setDelay] = useState(2); 

    // Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentScene: '' });
    const abortRef = React.useRef(false);
    const isMounted = React.useRef(true);

    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        isMounted.current = true;
        setIsAnalyzing(false);
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!isAnalyzing) {
            setEndScene(beats.length || 1);
        }
    }, [beats.length]);

    // --- AGGREGATION LOGIC ---
    const { itemsData, categoryCounts } = useMemo(() => {
        const itemsMap = new Map<string, { 
            name: string, 
            category: keyof BreakdownData, 
            scenes: { id: number, slug: string, source?: string, sceneNum: string }[] 
        }>();

        const counts: Record<string, number> = {};
        CATEGORIES.forEach(c => counts[c.id] = 0);

        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);

        sortedBeats.forEach((beat, idx) => {
            if (!beat.breakdown) return;
            const sceneNum = beat.sceneNumber || (idx + 1).toString();
            const slug = `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`;
            
            (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(cat => {
                const list = beat.breakdown![cat] || [];
                list.forEach(rawItem => {
                    const name = typeof rawItem === 'string' ? rawItem : rawItem.name;
                    const source = typeof rawItem === 'string' ? undefined : rawItem.source;
                    const cleanName = (name || '').trim();
                    const key = `${cat}:${cleanName.toLowerCase()}`;

                    if (!itemsMap.has(key)) {
                        itemsMap.set(key, { name: cleanName, category: cat, scenes: [] });
                        counts[cat] = (counts[cat] || 0) + 1;
                        counts['all'] = (counts['all'] || 0) + 1;
                    }
                    
                    const entry = itemsMap.get(key)!;
                    if (!entry.scenes.find(s => s.id === beat.id)) {
                        entry.scenes.push({ id: beat.id, slug, source, sceneNum });
                    }
                });
            });
        });

        const list = Array.from(itemsMap.values()).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        return { itemsData: list, categoryCounts: counts };
    }, [beats]);

    // --- FILTERING ---
    const filteredData = useMemo(() => {
        let result = itemsData;
        if (selectedCategory !== 'all') {
            result = result.filter((item: any) => item.category === selectedCategory);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter((item: any) => (item.name || '').toLowerCase().includes(lower));
        }
        return result;
    }, [itemsData, selectedCategory, searchTerm]);

    // --- SCENE-BASED DATA ---
    const sceneData = useMemo(() => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);
        return sortedBeats.map((beat, idx) => {
            const hasBreakdown = !!beat.breakdown;
            const totalItems = hasBreakdown 
                ? Object.values(beat.breakdown || {}).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0)
                : 0;
            return { beat, hasBreakdown, totalItems, sceneIndex: idx + 1 };
        });
    }, [beats]);

    const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.id === cat);

    // --- HANDLERS ---
    const handleAnalyze = async () => {
        if (!geminiApiKey) {
            alert("API KEY MISSING\n\nPlease go to Backstage > System Features > Generative AI Configuration and enter your Google Gemini API Key.");
            return;
        }

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
                : `No content found to analyze in range ${startScene}-${endScene}.`);
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
                    setProgress({ 
                        current: i + 1, 
                        total: validBeats.length,
                        currentScene: sceneName
                    });
                }

                const div = document.createElement('div');
                div.innerHTML = beat.content || '';
                const text = div.innerText || '';

                try {
                    const result = await generateBreakdown(text, 'gemini-3-flash-preview', geminiApiKey, breakdownLanguage);
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
            alert("Analysis stopped due to an unexpected error.");
        } finally {
            if (isMounted.current) setIsAnalyzing(false);
        }
    };

    const handleStopAnalysis = () => {
        abortRef.current = true;
        setIsAnalyzing(false);
    };

    // --- EXPORT FUNCTION ---
    const handleExport = async (format: 'csv' | 'excel') => {
        setIsExporting(true);
        try {
            const exportData = itemsData.map(item => ({
                Category: item.category.toUpperCase(),
                Item: item.name,
                Scenes: item.scenes.map(s => s.sceneNum).join(', '),
                Source_Text: item.scenes.map(s => s.source || '').filter(Boolean).join(' | '),
                Count: item.scenes.length
            }));

            if (exportData.length === 0) {
                alert("No breakdown data to export.");
                return;
            }

            const fileName = `Breakdown_Export_${new Date().toISOString().slice(0,10)}`;

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
            } 
            else if (format === 'excel') {
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdown");
                XLSX.writeFile(workbook, `${fileName}.xlsx`);
            }
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed. Check console for details.");
        } finally {
            setIsExporting(false);
        }
    };

    const fontStyle = {
        fontFamily: scriptConfig.noteFont,
        fontSize: `${scratchpadConfig.fontSize || 14}px`
    };

    return (
        <div className="flex w-full h-full bg-[#121212] overflow-hidden font-sans text-gray-300">
            <div className="w-72 bg-[#1a1a1a] border-r border-[#333] flex flex-col shrink-0 z-20 shadow-xl relative">
                <div className="p-6 border-b border-[#333] bg-[#1a1a1a]">
                    <h2 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2 mb-1">
                        <ListChecks size={16} className="text-[#f5a623]" /> Breakdown Manifest
                    </h2>
                    <p className="text-[10px] text-[#777] font-medium">Production Asset List</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {CATEGORIES.map(cat => {
                        const count = categoryCounts[cat.id] || 0;
                        const isActive = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`
                                    w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200 group
                                    ${isActive 
                                        ? 'bg-[#2a2a2a] shadow-inner text-white' 
                                        : 'hover:bg-[#222] text-[#888]'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${isActive ? cat.bg : 'bg-[#222] group-hover:bg-[#2a2a2a]'} transition-colors`}>
                                        <cat.icon size={16} className={isActive ? cat.color : 'text-gray-500'} />
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
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative bg-[#121212]">
                <div className="bg-[#111] h-14 border-b border-[#222] px-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-md px-2 py-1">
                           <span className="text-[10px] font-bold text-[#666] uppercase mr-1">SCENE</span>
                           <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={startScene} onChange={e => setStartScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                           <span className="text-gray-600 font-bold text-xs">-</span>
                           <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={endScene} onChange={e => setEndScene(Math.max(1, parseInt(e.target.value)))} min={1} disabled={isAnalyzing} />
                        </div>

                        <button 
                            onClick={() => setBreakdownLockedOnly(!breakdownLockedOnly)}
                            disabled={isAnalyzing}
                            className={`flex items-center justify-center w-8 h-8 rounded-md border border-[#333] transition-all ${breakdownLockedOnly ? 'bg-green-900/20 text-green-500 border-green-900/50' : 'bg-[#1a1a1a] text-gray-500 hover:text-white hover:bg-[#333]'}`}
                            title={breakdownLockedOnly ? "Only Analyze Locked Scenes" : "Analyze All Scenes"}
                        >
                            {breakdownLockedOnly ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>

                        <button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing || !geminiApiKey} 
                            className={`flex items-center gap-2 border border-[#333] px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all group ${
                                geminiApiKey 
                                ? 'bg-[#222] hover:bg-[#f5a623] hover:text-black text-gray-300' 
                                : 'bg-[#151515] text-gray-600 cursor-not-allowed opacity-50'
                            }`}
                            title={geminiApiKey ? "Start Analysis" : "API Key Missing"}
                        >
                          {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className={geminiApiKey ? "text-[#f5a623] group-hover:text-black" : "text-gray-600"} />} 
                          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        </button>

                        {isAnalyzing && (
                             <button onClick={handleStopAnalysis} className="h-8 w-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-md transition-all shadow-lg animate-pulse">
                                <StopCircle size={14} />
                             </button>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-[#222] rounded-full border border-[#333] p-1 gap-1">
                            <button 
                                onClick={() => handleExport('excel')} 
                                disabled={isExporting}
                                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase text-gray-400 hover:text-white hover:bg-[#333] transition-all flex items-center gap-2"
                                title="Export to Excel (.xlsx)"
                            >
                                <FileSpreadsheet size={12} className="text-green-400" /> Excel
                            </button>
                            <div className="w-px bg-[#333] my-1"></div>
                            <button 
                                onClick={() => handleExport('csv')} 
                                disabled={isExporting}
                                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase text-gray-400 hover:text-white hover:bg-[#333] transition-all flex items-center gap-2"
                                title="Download CSV"
                            >
                                <Download size={12} /> CSV
                            </button>
                        </div>

                        <div className="flex bg-[#000] rounded-md p-1 border border-[#333] gap-1">
                           <button onClick={() => setViewType('by-category')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewType === 'by-category' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} title="Category Grid"><LayoutGrid size={14} /></button>
                           <button onClick={() => setViewType('by-scene')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewType === 'by-scene' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} title="Scene List"><ListIcon size={14} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                         <div className="relative w-64 group">
                            <Search className="absolute left-2.5 top-2 text-[#555] group-focus-within:text-[#f5a623] transition-colors" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search assets..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#000] border border-[#333] rounded-md pl-8 pr-3 py-1.5 text-xs font-medium text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-all" 
                            />
                        </div>

                         <div className="flex items-center gap-2 bg-[#000] px-2 py-1 rounded-md border border-[#333]">
                             <Clock size={12} className="text-[#666]" />
                             <select value={delay} onChange={(e) => setDelay(parseInt(e.target.value))} disabled={isAnalyzing} className="bg-transparent text-white text-[10px] font-bold outline-none focus:text-[#f5a623] cursor-pointer">
                                 <option value={1}>1s DELAY</option>
                                 <option value={2}>2s DELAY</option>
                                 <option value={5}>5s DELAY</option>
                             </select>
                         </div>
                    </div>
                </div>

                <div className="h-12 bg-[#161616] border-b border-[#333] flex items-center px-8 gap-8 shadow-sm">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#666]">
                        <Layers size={14} />
                        <span>Total Assets: <span className="text-white ml-1 text-sm">{categoryCounts['all']}</span></span>
                    </div>
                    <div className="w-px h-4 bg-[#333]"></div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#666]">
                        <Wand2 size={14} className="text-green-500/80" />
                        <span>VFX Shots: <span className="text-white ml-1 text-sm">{categoryCounts['vfx'] || 0}</span></span>
                    </div>
                    <div className="w-px h-4 bg-[#333]"></div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#666]">
                        <Users size={14} className="text-yellow-500/80" />
                        <span>Cast: <span className="text-white ml-1 text-sm">{categoryCounts['cast'] || 0}</span></span>
                    </div>
                </div>

                {isAnalyzing && (
                    <div className="bg-[#1a1a1a] border-b border-[#f5a623]/30 px-8 py-3 flex items-center gap-4 shrink-0 shadow-lg z-20">
                        <div className="text-[10px] font-bold text-[#f5a623] uppercase animate-pulse flex items-center gap-2 shrink-0 min-w-[200px]">
                            <Loader2 size={14} className="animate-spin" />
                            Processing: <span className="text-white truncate max-w-[200px]">{progress.currentScene || `Scene ${startScene + progress.current - 1}`}</span>
                        </div>
                        <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                            <div className="h-full bg-[#f5a623] transition-all duration-300 ease-out" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono shrink-0">
                            {Math.round((progress.current / progress.total) * 100)}%
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {viewType === 'by-category' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {filteredData.map((item, idx) => {
                                const catMeta = getCategoryMeta(item.category);
                                return (
                                    <div key={idx} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 flex flex-col hover:border-[#555] transition-all group hover:-translate-y-1 hover:shadow-xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${catMeta?.bg} border ${catMeta?.border}`}>
                                                    {catMeta && <catMeta.icon size={18} className={catMeta.color} />}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors" style={fontStyle}>{item.name}</h3>
                                                    <div className="text-[10px] text-[#666] font-medium uppercase mt-0.5">{catMeta?.label}</div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold bg-[#252525] text-gray-400 px-2.5 py-1 rounded-full border border-[#333] group-hover:bg-[#333] group-hover:text-white transition-colors">
                                                {item.scenes.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-auto max-h-24 overflow-y-auto custom-scrollbar">
                                            {item.scenes.map((scene, sIdx) => (
                                                <div 
                                                    key={sIdx} 
                                                    className="text-[9px] font-bold bg-[#222] text-[#888] px-2 py-1 rounded-md border border-[#333] hover:bg-[#333] hover:text-white hover:border-[#555] cursor-help transition-colors"
                                                    title={`SCENE ${scene.sceneNum}: ${scene.slug}\n\nSOURCE: "${scene.source || 'N/A'}"`}
                                                >
                                                    SC {scene.sceneNum}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <div className="col-span-full h-96 flex flex-col items-center justify-center text-[#333] border-2 border-dashed border-[#222] rounded-2xl bg-[#161616]">
                                    <Sparkles size={48} className="mb-4 opacity-30" />
                                    <p className="text-sm font-bold uppercase tracking-widest text-[#555]">No Assets Found</p>
                                    <p className="text-xs text-[#444] mt-2 font-medium">Run analysis to populate the manifest.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in duration-300">
                            {sceneData.filter(s => searchTerm ? (s.beat.slug.location || '').toLowerCase().includes(searchTerm.toLowerCase()) : true).map((item) => (
                                <div key={item.beat.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden hover:border-[#555] transition-colors group shadow-sm">
                                    <div className="bg-[#222] px-6 py-4 border-b border-[#333] flex justify-between items-center group-hover:bg-[#252525] transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-[#151515] rounded-lg border border-[#333] shadow-inner">
                                                <span className="text-[9px] font-bold text-[#555] uppercase">SCENE</span>
                                                <span className="text-lg font-black text-white">{item.beat.sceneNumber || item.sceneIndex}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-base font-bold text-gray-200 group-hover:text-white transition-colors" style={fontStyle}>
                                                    {item.beat.slug.location || 'UNKNOWN LOCATION'}
                                                </h4>
                                                <div className="flex items-center gap-2 text-[10px] font-medium text-[#666] mt-1 bg-[#1a1a1a] px-2 py-0.5 rounded w-fit">
                                                    <span>{item.beat.slug.prefix}</span>
                                                    <span className="text-[#333]">|</span>
                                                    <span>{item.beat.slug.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {item.beat.status === 'ready' && <div className="px-2 py-1 bg-green-900/20 text-green-500 rounded border border-green-900/30 flex items-center gap-1.5"><Lock size={12} /><span className="text-[9px] font-bold uppercase">Locked</span></div>}
                                            {item.totalItems === 0 && <span className="text-[9px] font-bold text-red-400 bg-red-900/10 px-2 py-1 rounded border border-red-900/20 flex items-center gap-1.5"><AlertCircle size={12}/> No Data</span>}
                                        </div>
                                    </div>
                                    {item.totalItems > 0 ? (
                                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-8">
                                            {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                                                const items = item.beat.breakdown?.[cat.id as keyof BreakdownData] || [];
                                                if (items.length === 0) return null;
                                                return (
                                                    <div key={cat.id} className="space-y-3">
                                                        <div className={`text-[10px] font-bold uppercase flex items-center gap-2 pb-2 border-b border-[#333] ${cat.color}`}>
                                                            <cat.icon size={12} /> {cat.label}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            {items.map((i, idx) => {
                                                                const name = typeof i === 'string' ? i : i.name;
                                                                const src = typeof i === 'string' ? null : i.source;
                                                                return (
                                                                    <div key={idx} className="text-[11px] text-gray-400 pl-2 border-l-2 border-[#333] hover:border-[#f5a623] hover:text-white transition-all cursor-default py-0.5" title={src ? `Source: "${src}"` : undefined} style={fontStyle}>
                                                                        {name}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 flex justify-center bg-[#181818]">
                                            <p className="text-xs text-[#444] font-medium italic">Waiting for analysis...</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BreakdownView;
