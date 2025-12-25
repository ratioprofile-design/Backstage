
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BreakdownData, Beat, BreakdownItem } from '../../types';
import { generateBreakdown } from '../../services/gemini';
import { 
    ListChecks, Users, Package, Mic2, Shirt, Wand2, Flame, Map as MapIcon, 
    Filter, Search, ArrowRight, LayoutGrid, List as ListIcon, X, Eye, 
    Download, Printer, Sparkles, Loader2, StopCircle, Trash2, Clock
} from 'lucide-react';

const CATEGORIES = [
    { id: 'all', label: 'All Items', icon: ListChecks, color: 'text-gray-200' },
    { id: 'cast', label: 'Cast & Extras', icon: Users, color: 'text-yellow-400' },
    { id: 'props', label: 'Props', icon: Package, color: 'text-red-400' },
    { id: 'costume', label: 'Wardrobe', icon: Shirt, color: 'text-pink-400' },
    { id: 'vfx', label: 'Visual Effects', icon: Wand2, color: 'text-green-400' },
    { id: 'practical', label: 'Special Effects', icon: Flame, color: 'text-orange-500' },
    { id: 'sound', label: 'Sound / SFX', icon: Mic2, color: 'text-blue-400' },
    { id: 'location', label: 'Locations', icon: MapIcon, color: 'text-purple-400' },
];

const BreakdownView: React.FC = () => {
    const { beats, updateBeat, geminiApiKey, breakdownLanguage } = useProject();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState<'by-category' | 'by-scene'>('by-category');

    // Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [delay, setDelay] = useState(2); // Seconds delay between requests
    const abortRef = React.useRef(false);
    const isMounted = React.useRef(true);

    // Safety: Reset analyzing state on mount/unmount
    useEffect(() => {
        isMounted.current = true;
        setIsAnalyzing(false);
        return () => { isMounted.current = false; };
    }, []);

    // --- AGGREGATION LOGIC ---
    const data = useMemo(() => {
        const itemsMap = new Map<string, { 
            name: string, 
            category: keyof BreakdownData, 
            scenes: { id: number, slug: string, source?: string }[] 
        }>();

        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);

        sortedBeats.forEach(beat => {
            if (!beat.breakdown) return;
            const slug = `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`;
            
            (Object.keys(beat.breakdown) as Array<keyof BreakdownData>).forEach(cat => {
                const list = beat.breakdown![cat] || [];
                list.forEach(rawItem => {
                    const name = typeof rawItem === 'string' ? rawItem : rawItem.name;
                    const source = typeof rawItem === 'string' ? undefined : rawItem.source;
                    const cleanName = (name || '').trim();
                    const key = `${cat}:${cleanName.toLowerCase()}`; // Unique by category + name

                    if (!itemsMap.has(key)) {
                        itemsMap.set(key, { name: cleanName, category: cat, scenes: [] });
                    }
                    
                    const entry = itemsMap.get(key)!;
                    // Avoid duplicates if same item listed twice in scene (unlikely but safe)
                    if (!entry.scenes.find(s => s.id === beat.id)) {
                        entry.scenes.push({ id: beat.id, slug, source });
                    }
                });
            });
        });

        // Convert to Array & Sort
        return Array.from(itemsMap.values()).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }, [beats]);

    // --- FILTERING ---
    const filteredData = useMemo(() => {
        let result = data;
        if (selectedCategory !== 'all') {
            result = result.filter((item: any) => item.category === selectedCategory);
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter((item: any) => (item.name || '').toLowerCase().includes(lower));
        }
        return result;
    }, [data, selectedCategory, searchTerm]);

    // --- SCENE-BASED DATA (For "By Scene" View) ---
    const sceneData = useMemo(() => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);
        return sortedBeats.map(beat => {
            const hasBreakdown = !!beat.breakdown;
            const totalItems = hasBreakdown 
                ? Object.values(beat.breakdown || {}).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0)
                : 0;
            return { beat, hasBreakdown, totalItems };
        }).filter(item => {
            return true;
        });
    }, [beats]);

    const getCategoryIcon = (cat: string) => {
        const found = CATEGORIES.find(c => c.id === cat);
        return found ? <found.icon size={14} className={found.color} /> : null;
    };

    const getCategoryLabel = (cat: string) => {
        return CATEGORIES.find(c => c.id === cat)?.label || cat;
    };

    // --- BATCH ANALYSIS ---
    const handleAnalyzeAll = async () => {
        console.log("Analyze button clicked");
        
        if (!geminiApiKey) {
            alert("API KEY MISSING\nPlease go to Backstage > System Features > Generative AI Configuration and enter your Google Gemini API Key.");
            return;
        }

        // Filter valid beats that have content
        const validBeats = beats.filter(b => {
            const div = document.createElement('div');
            div.innerHTML = b.content || '';
            const text = div.textContent || div.innerText || '';
            return text.trim().length > 5;
        });

        if (validBeats.length === 0) {
            alert("No scenes with sufficient content found to analyze.");
            return;
        }

        if(!confirm(`Start AI Analysis for ${validBeats.length} scenes?\n\nThis process will:\n1. Send script text to Gemini AI\n2. Extract props, characters, effects, etc.\n3. Overwrite existing breakdown data for processed scenes.`)) return;

        setIsAnalyzing(true);
        abortRef.current = false;
        setProgress({ current: 0, total: validBeats.length });

        try {
            for (let i = 0; i < validBeats.length; i++) {
                if (abortRef.current || !isMounted.current) break;

                const beat = validBeats[i];
                
                // Extract raw text
                const div = document.createElement('div');
                div.innerHTML = beat.content || '';
                const text = div.textContent || div.innerText || '';

                try {
                    const result = await generateBreakdown(text, 'gemini-3-flash-preview', geminiApiKey, breakdownLanguage);
                    if (result && isMounted.current) {
                        updateBeat(beat.id, { breakdown: result });
                    }
                } catch (err) {
                    console.error(`Failed to analyze beat ${beat.id}`, err);
                }

                if (isMounted.current) {
                    setProgress(prev => ({ ...prev, current: i + 1 }));
                }
                
                // USER-DEFINED DELAY
                // Allows user to throttle requests to avoid 429 errors
                if (i < validBeats.length - 1) {
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
            }
        } catch (globalErr) {
            console.error("Critical Analysis Error", globalErr);
            alert("Analysis stopped due to an error.");
        } finally {
            if (isMounted.current) {
                setIsAnalyzing(false);
            }
        }
    };

    const handleClearData = () => {
        if(!confirm("Are you sure you want to delete ALL breakdown data from ALL scenes? This cannot be undone.")) return;
        beats.forEach(b => {
            if(b.breakdown) {
                updateBeat(b.id, { breakdown: undefined });
            }
        });
    };

    const handleStopAnalysis = () => {
        abortRef.current = true;
        setIsAnalyzing(false);
    };

    const isApiConnected = !!geminiApiKey;

    return (
        <div className="flex w-full h-full bg-[#0c0c0c] overflow-hidden font-sans text-gray-300">
            
            {/* SIDEBAR */}
            <div className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col shrink-0 z-20 shadow-2xl">
                <div className="p-6 border-b border-[#222]">
                    <h2 className="text-xs font-black text-[#f5a623] uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
                        <ListChecks size={14} /> Production Report
                    </h2>
                    <p className="text-[10px] text-[#555] font-mono">BREAKDOWN MASTER</p>
                </div>

                {/* Categories */}
                <div className="p-4 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${selectedCategory === cat.id ? 'bg-[#222] text-white border border-[#333]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#111] border border-transparent'}`}
                        >
                            <div className="flex items-center gap-3">
                                <cat.icon size={16} className={selectedCategory === cat.id ? cat.color : ""} />
                                <span className="text-xs font-bold uppercase tracking-wide">{cat.label}</span>
                            </div>
                            {selectedCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623]" />}
                        </button>
                    ))}
                </div>

                {/* Progress Indicator (Sidebar) */}
                {isAnalyzing && (
                    <div className="p-4 border-t border-[#222] bg-[#1a1a1a]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-bold text-[#f5a623] uppercase animate-pulse">Analyzing...</span>
                            <span className="text-[9px] font-mono text-[#555]">{progress.current}/{progress.total}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#333] rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-[#f5a623] transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                        <button 
                            onClick={handleStopAnalysis}
                            className="w-full py-1.5 bg-red-900/20 text-red-500 hover:bg-red-900/40 border border-red-900/50 rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-colors"
                        >
                            <StopCircle size={10} /> Stop
                        </button>
                    </div>
                )}

                {/* View Toggles */}
                <div className="p-4 border-t border-[#222]">
                    <div className="bg-[#111] rounded p-1 border border-[#222] flex">
                        <button 
                            onClick={() => setViewType('by-category')} 
                            className={`flex-1 py-2 text-[10px] font-bold uppercase rounded flex items-center justify-center gap-2 ${viewType === 'by-category' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                        >
                            <ListIcon size={12} /> By Item
                        </button>
                        <button 
                            onClick={() => setViewType('by-scene')} 
                            className={`flex-1 py-2 text-[10px] font-bold uppercase rounded flex items-center justify-center gap-2 ${viewType === 'by-scene' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                        >
                            <LayoutGrid size={12} /> By Scene
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header Toolbar - Elevated Z-Index */}
                <div className="h-16 border-b border-[#222] flex items-center justify-between px-8 bg-[#0c0c0c] shrink-0 relative z-40">
                    <div className="flex items-center gap-4 w-full max-w-lg">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-2.5 text-[#444]" size={14} />
                            <input 
                                type="text" 
                                placeholder="Filter items..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#151515] border border-[#222] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-all" 
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="text-[10px] font-mono text-[#555] uppercase font-bold mr-2">
                            {filteredData.length} ITEMS
                        </div>

                        <button 
                            onClick={handleClearData}
                            className="p-2 hover:bg-[#222] rounded-full text-gray-500 hover:text-red-500 transition-colors"
                            title="Clear All Breakdown Data"
                        >
                            <Trash2 size={16} />
                        </button>

                        <div className="h-4 w-[1px] bg-[#333] mx-2"></div>

                        {/* DELAY DROPDOWN */}
                        <div className="flex items-center gap-2 bg-[#151515] px-2 py-1.5 rounded-md border border-[#222] mr-2">
                             <Clock size={12} className="text-[#666]" />
                             <select 
                                value={delay} 
                                onChange={(e) => setDelay(parseInt(e.target.value))} 
                                disabled={isAnalyzing} 
                                className="bg-transparent text-white text-[10px] font-bold outline-none focus:text-[#f5a623] cursor-pointer"
                                title="Delay between API requests to avoid rate limits"
                             >
                                 <option value={1}>1s DELAY</option>
                                 <option value={2}>2s DELAY</option>
                                 <option value={5}>5s DELAY</option>
                                 <option value={10}>10s DELAY</option>
                             </select>
                        </div>

                        {/* ANALYZE BUTTON - Explicit z-index and type */}
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAnalyzeAll(); }}
                            disabled={isAnalyzing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all border relative z-50 ${
                                isApiConnected 
                                ? 'bg-[#f5a623] text-black border-[#f5a623] hover:bg-[#e09612] hover:border-[#e09612] shadow-lg hover:shadow-orange-500/20' 
                                : 'bg-[#222] text-gray-400 border-[#333] hover:bg-[#333] hover:text-white'
                            } ${isAnalyzing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            title={isApiConnected ? "Batch Analyze Screenplay" : "Click to setup API Key"}
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                            {isAnalyzing ? `Processing (${progress.current}/${progress.total})...` : (isApiConnected ? 'Analyze Screenplay' : 'Setup AI Analysis')}
                        </button>

                        <button className="p-2 hover:bg-[#222] rounded-full text-gray-500 hover:text-white transition-colors" title="Export CSV (Coming Soon)">
                            <Download size={16} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    
                    {viewType === 'by-category' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredData.map((item, idx) => (
                                <div key={idx} className="bg-[#111] border border-[#222] rounded-lg p-4 flex flex-col hover:border-[#333] transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[#1a1a1a] rounded border border-[#222]">
                                                {getCategoryIcon(item.category)}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">{item.name}</h3>
                                                <div className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">{getCategoryLabel(item.category)}</div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold bg-[#1a1a1a] px-2 py-1 rounded text-gray-400 border border-[#2a2a2a]">{item.scenes.length} Scenes</span>
                                    </div>
                                    
                                    <div className="space-y-1 mt-auto">
                                        {item.scenes.map((scene, sIdx) => (
                                            <div key={sIdx} className="flex items-center justify-between text-[10px] bg-[#151515] px-2 py-1.5 rounded text-gray-400 border border-transparent hover:border-[#333] group/scene">
                                                <span className="truncate font-mono">{scene.slug}</span>
                                                {scene.source && (
                                                    <span className="opacity-0 group-hover/scene:opacity-100 transition-opacity text-[#f5a623]" title={`Source: "${scene.source}"`}>
                                                        <Eye size={10} />
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {filteredData.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                                    <ListChecks size={48} className="mb-4 opacity-20" />
                                    <p className="text-sm font-bold uppercase tracking-widest">No items found</p>
                                    <p className="text-xs mt-2">Use the 'Analyze Screenplay' button above to populate.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // BY SCENE VIEW
                        <div className="space-y-6">
                            {sceneData.filter(s => searchTerm ? (s.beat.slug.location || '').toLowerCase().includes(searchTerm.toLowerCase()) : true).map((item) => (
                                <div key={item.beat.id} className="bg-[#111] border border-[#222] rounded-lg overflow-hidden">
                                    <div className="bg-[#151515] px-4 py-3 border-b border-[#222] flex justify-between items-center">
                                        <div>
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                                                {item.beat.slug.prefix} {item.beat.slug.location} - {item.beat.slug.time}
                                            </h4>
                                            {item.totalItems === 0 && <span className="text-[9px] text-red-500 font-mono uppercase mt-1 block">No Breakdown Data</span>}
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-500 bg-[#0a0a0a] px-2 py-1 rounded border border-[#222]">
                                            SCENE {item.beat.sceneNumber || '?'}
                                        </div>
                                    </div>
                                    
                                    {item.totalItems > 0 ? (
                                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                                                const items = item.beat.breakdown?.[cat.id as keyof BreakdownData] || [];
                                                if (items.length === 0) return null;
                                                return (
                                                    <div key={cat.id} className="space-y-2">
                                                        <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-1 border-b border-[#222] pb-1">
                                                            <cat.icon size={10} className={cat.color} /> {cat.label}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {items.map((i, idx) => {
                                                                const name = typeof i === 'string' ? i : i.name;
                                                                const src = typeof i === 'string' ? null : i.source;
                                                                return (
                                                                    <span key={idx} className="text-[10px] bg-[#1a1a1a] px-2 py-1 rounded text-gray-300 border border-[#222] flex items-center gap-1" title={src ? `Source: "${src}"` : undefined}>
                                                                        {name}
                                                                        {src && <div className="w-1 h-1 bg-[#f5a623] rounded-full" />}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center">
                                            <p className="text-[10px] text-gray-600 font-mono">Run analysis to populate.</p>
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
