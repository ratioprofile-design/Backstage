
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { generateShotList, generateImage } from '../../services/gemini';
import { 
    Wand2, Image as ImageIcon, Film, Loader2, Download, Camera,
    Plus, Trash2, RefreshCw, Play, Pause, Clock, 
    Grid3X3, LayoutGrid, Maximize, Columns, List, Table2,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, UserCheck, ChevronLeft, ChevronRight,
    Settings2, Aperture, Paintbrush, Users, Lightbulb, X, ChevronsRight,
    Scissors, Send, Layers, Check, Hash, FileSpreadsheet, Printer, Copy, Share2,
    Search, Filter, CheckSquare, Square, Sparkles, SlidersHorizontal, CheckCircle2,
    AlertCircle, RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { Shot, CharacterData, Annotation } from '../../types';
import { 
    SHOT_SIZES, SHOT_ANGLES, VISUAL_STYLES,
    SB_FRAMING, SB_HEADROOM, SB_LOOKING, SB_CAM_HEIGHT, SB_HORIZON, SB_DEPTH,
    SB_LIGHTING_STYLE, SB_KEY_LIGHT, SB_FILL_RATIO, SB_BACKLIGHT, SB_COLOR_TEMP, SB_SHADOWS,
    SB_MOVEMENT, SB_EYELINE
} from '../../constants';

// --- HELPER: Buffered Input to prevent History Spam ---
const BufferedInput = ({ value, onChange, className, placeholder, type = 'text', align }: any) => {
    const [localValue, setLocalValue] = useState(value || '');
    useEffect(() => { setLocalValue(value || ''); }, [value]);
    
    const commit = () => { if (localValue !== (value || '')) onChange(localValue); };
    
    return (
        <input 
            type={type}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={className}
            placeholder={placeholder}
            style={align ? { textAlign: align } : undefined}
        />
    );
};

const BufferedTextArea = ({ value, onChange, className, placeholder }: any) => {
    const [localValue, setLocalValue] = useState(value || '');
    useEffect(() => { setLocalValue(value || ''); }, [value]);
    
    const commit = () => { if (localValue !== (value || '')) onChange(localValue); };
    
    return (
        <textarea 
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            className={className}
            placeholder={placeholder}
        />
    );
};

const AdvancedShotInspector = ({ shot, onClose, onUpdate, characterData, isLight }: { 
    shot: Shot, 
    onClose: () => void, 
    onUpdate: (id: string, updates: Partial<Shot>) => void,
    characterData: Record<string, CharacterData>,
    isLight?: boolean
}) => {
    const [openSection, setOpenSection] = useState<'camera' | 'comp' | 'light' | 'art' | 'block'>('camera');

    const updateNested = (category: 'composition' | 'lighting' | 'art' | 'blocking', field: string, value: string) => {
        onUpdate(shot.id, {
            [category]: {
                ...shot[category],
                [field]: value
            }
        });
    };

    const AccordionHeader = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setOpenSection(openSection === id ? null : id as any)}
            className={`w-full flex items-center justify-between p-3 border-b transition-colors cursor-pointer ${
                openSection === id 
                    ? isLight ? 'bg-amber-100/80 text-amber-950 border-amber-300/80 font-bold' : 'bg-[#1f1f28] text-amber-400 border-[#2a2a38] font-bold' 
                    : isLight ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900' : 'bg-[#121216] text-zinc-400 border-[#22222a] hover:bg-[#181822] hover:text-zinc-100'
            }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={14} className={openSection === id ? (isLight ? 'text-amber-700' : 'text-amber-400') : (isLight ? 'text-slate-500' : 'text-zinc-500')} />
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <ChevronRight size={14} className={`transition-transform ${openSection === id ? 'rotate-90' : ''}`} />
        </button>
    );

    const SelectField = ({ label, value, options, onChange }: any) => (
        <div className="mb-3">
            <label className={`text-[9px] font-mono font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>{label}</label>
            <select 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)}
                className={`w-full border rounded-md px-2 py-1.5 text-[10px] outline-none cursor-pointer transition-colors ${
                    isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 shadow-2xs' 
                        : 'bg-[#09090c] border-[#262632] text-zinc-200 focus:border-amber-500'
                }`}
            >
                <option value="" className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>-- Default --</option>
                {options.map((opt: string) => <option key={opt} value={opt} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{opt}</option>)}
            </select>
        </div>
    );

    const InputField = ({ label, value, onChange, placeholder }: any) => (
        <div className="mb-3">
            <label className={`text-[9px] font-mono font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>{label}</label>
            <BufferedInput 
                value={value} 
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full border rounded-md px-2 py-1.5 text-[10px] outline-none transition-colors ${
                    isLight 
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400 shadow-2xs' 
                        : 'bg-[#09090c] border-[#262632] text-zinc-200 focus:border-amber-500 placeholder:text-zinc-600'
                }`}
            />
        </div>
    );

    return (
        <div className={`w-[320px] border-l h-full flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#141418] border-[#262632] text-zinc-100'
        }`}>
            <div className={`h-14 border-b flex items-center justify-between px-4 ${
                isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-[#101014] border-[#22222a]'
            }`}>
                <div className="flex items-center gap-2">
                    <Settings2 size={16} className="text-amber-500" />
                    <span className={`text-xs font-black uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>Shot Tuner</span>
                </div>
                <button onClick={onClose} className={`p-1 rounded cursor-pointer ${isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-[#262632] text-zinc-400 hover:text-white'}`}><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <AccordionHeader id="camera" label="Camera & Shot Division" icon={Camera} />
                {openSection === 'camera' && (
                    <div className={`p-4 ${isLight ? 'bg-slate-50/80' : 'bg-[#0f0f13]'}`}>
                        <SelectField label="Shot Size" value={shot.shotSize} options={SHOT_SIZES} onChange={(v: string) => onUpdate(shot.id, { shotSize: v })} />
                        <SelectField label="Angle" value={shot.angle} options={SHOT_ANGLES} onChange={(v: string) => onUpdate(shot.id, { angle: v })} />
                        <InputField label="Lens" value={shot.lens} onChange={(v: string) => onUpdate(shot.id, { lens: v })} placeholder="e.g. 35mm Prime" />
                        <InputField label="Camera Movement" value={shot.movement} onChange={(v: string) => onUpdate(shot.id, { movement: v })} placeholder="e.g. Dolly In, Static" />
                        <div className="grid grid-cols-2 gap-2">
                            <InputField label="Equipment" value={shot.equipment} onChange={(v: string) => onUpdate(shot.id, { equipment: v })} placeholder="Tripod / Steadicam" />
                            <InputField label="Duration (sec)" value={shot.durationSec ? String(shot.durationSec) : ''} onChange={(v: string) => onUpdate(shot.id, { durationSec: parseFloat(v) || undefined })} placeholder="3" />
                        </div>
                        <InputField label="Script Reference" value={shot.scriptReference} onChange={(v: string) => onUpdate(shot.id, { scriptReference: v })} placeholder="Script line or context..." />
                        <InputField label="Notes / Reasoning" value={shot.notes || shot.reasoning} onChange={(v: string) => onUpdate(shot.id, { notes: v })} placeholder="Director / DP notes..." />
                    </div>
                )}

                <AccordionHeader id="comp" label="Composition" icon={Aperture} />
                {openSection === 'comp' && (
                    <div className={`p-4 ${isLight ? 'bg-slate-50/80' : 'bg-[#0f0f13]'}`}>
                        <SelectField label="Framing" value={shot.composition?.framing} options={SB_FRAMING} onChange={(v: string) => updateNested('composition', 'framing', v)} />
                        <SelectField label="Camera Height" value={shot.composition?.cameraHeight} options={SB_CAM_HEIGHT} onChange={(v: string) => updateNested('composition', 'cameraHeight', v)} />
                        <div className="grid grid-cols-2 gap-2">
                            <SelectField label="Headroom" value={shot.composition?.headroom} options={SB_HEADROOM} onChange={(v: string) => updateNested('composition', 'headroom', v)} />
                            <SelectField label="Look Room" value={shot.composition?.lookingRoom} options={SB_LOOKING} onChange={(v: string) => updateNested('composition', 'lookingRoom', v)} />
                        </div>
                        <SelectField label="Horizon" value={shot.composition?.horizon} options={SB_HORIZON} onChange={(v: string) => updateNested('composition', 'horizon', v)} />
                        <SelectField label="Depth Layers" value={shot.composition?.depth} options={SB_DEPTH} onChange={(v: string) => updateNested('composition', 'depth', v)} />
                    </div>
                )}

                <AccordionHeader id="light" label="Lighting & Mood" icon={Lightbulb} />
                {openSection === 'light' && (
                    <div className={`p-4 ${isLight ? 'bg-slate-50/80' : 'bg-[#0f0f13]'}`}>
                        <SelectField label="Lighting Style" value={shot.lighting?.style} options={SB_LIGHTING_STYLE} onChange={(v: string) => updateNested('lighting', 'style', v)} />
                        <div className="grid grid-cols-2 gap-2">
                            <SelectField label="Key Light" value={shot.lighting?.keyLight} options={SB_KEY_LIGHT} onChange={(v: string) => updateNested('lighting', 'keyLight', v)} />
                            <SelectField label="Fill Ratio" value={shot.lighting?.fillRatio} options={SB_FILL_RATIO} onChange={(v: string) => updateNested('lighting', 'fillRatio', v)} />
                        </div>
                        <SelectField label="Backlight / Rim" value={shot.lighting?.backlight} options={SB_BACKLIGHT} onChange={(v: string) => updateNested('lighting', 'backlight', v)} />
                        <SelectField label="Color Temp" value={shot.lighting?.colorTemp} options={SB_COLOR_TEMP} onChange={(v: string) => updateNested('lighting', 'colorTemp', v)} />
                        <SelectField label="Shadows" value={shot.lighting?.shadows} options={SB_SHADOWS} onChange={(v: string) => updateNested('lighting', 'shadows', v)} />
                        <InputField label="Mood Keywords" value={shot.lighting?.mood} onChange={(v: string) => updateNested('lighting', 'mood', v)} placeholder="e.g. Threatening, Cold, Ethereal" />
                    </div>
                )}

                <AccordionHeader id="art" label="Art & Environment" icon={Paintbrush} />
                {openSection === 'art' && (
                    <div className={`p-4 ${isLight ? 'bg-slate-50/80' : 'bg-[#0f0f13]'}`}>
                        <InputField label="Set Dressing" value={shot.art?.setDressing} onChange={(v: string) => updateNested('art', 'setDressing', v)} placeholder="e.g. Divorce papers on table" />
                        <InputField label="Props" value={shot.art?.props} onChange={(v: string) => updateNested('art', 'props', v)} placeholder="e.g. Bloody knife, Ring" />
                        <InputField label="Costume" value={shot.art?.costume} onChange={(v: string) => updateNested('art', 'costume', v)} placeholder="e.g. Torn tuxedo, Hazmat suit" />
                        <InputField label="Color Palette" value={shot.art?.palette} onChange={(v: string) => updateNested('art', 'palette', v)} placeholder="e.g. Teal & Orange, Monochromatic Red" />
                        <div className="grid grid-cols-2 gap-2">
                            <InputField label="Texture" value={shot.art?.texture} onChange={(v: string) => updateNested('art', 'texture', v)} placeholder="e.g. Gritty" />
                            <InputField label="Weather" value={shot.art?.weather} onChange={(v: string) => updateNested('art', 'weather', v)} placeholder="e.g. Rain" />
                        </div>
                    </div>
                )}

                <AccordionHeader id="block" label="Blocking & Action" icon={Users} />
                {openSection === 'block' && (
                    <div className={`p-4 ${isLight ? 'bg-slate-50/80' : 'bg-[#0f0f13]'}`}>
                        <SelectField label="Character Focus" value={shot.blocking?.characterId} options={Object.keys(characterData)} onChange={(v: string) => updateNested('blocking', 'characterId', v)} />
                        <div className="grid grid-cols-2 gap-2">
                            <InputField label="Pos Start" value={shot.blocking?.startPos} onChange={(v: string) => updateNested('blocking', 'startPos', v)} placeholder="Left Frame" />
                            <InputField label="Pos End" value={shot.blocking?.endPos} onChange={(v: string) => updateNested('blocking', 'endPos', v)} placeholder="Center" />
                        </div>
                        <SelectField label="Movement" value={shot.blocking?.movement} options={SB_MOVEMENT} onChange={(v: string) => updateNested('blocking', 'movement', v)} />
                        <SelectField label="Eye Line" value={shot.blocking?.eyeLine} options={SB_EYELINE} onChange={(v: string) => updateNested('blocking', 'eyeLine', v)} />
                        <InputField label="Gesture" value={shot.blocking?.gesture} onChange={(v: string) => updateNested('blocking', 'gesture', v)} placeholder="e.g. Clenches fist" />
                        <InputField label="Subtext / Emotion" value={shot.blocking?.emotion} onChange={(v: string) => updateNested('blocking', 'emotion', v)} placeholder="e.g. Controlled rage" />
                    </div>
                )}
            </div>
        </div>
    );
};

const SceneDivider = ({ scene, onBundle, onToBoard, isLight }: { scene: string, onBundle: () => void, onToBoard: () => Promise<boolean>, isLight?: boolean }) => {
    const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const handleSend = async () => {
        if (sendState !== 'idle') return;
        setSendState('sending');
        const success = await onToBoard();
        if (success) { setSendState('sent'); setTimeout(() => setSendState('idle'), 2000); } else { setSendState('idle'); }
    };
    return (
        <div className="col-span-full py-6 flex items-center gap-4">
            <div className={`h-px flex-1 ${isLight ? 'bg-slate-300' : 'bg-[#2a2a36]'}`}></div>
            <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border shadow-sm ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181820] border-[#2a2a36] text-zinc-100'
            }`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>SCENE {scene}</span>
                <div className={`w-px h-3 ${isLight ? 'bg-slate-300' : 'bg-[#333342]'}`}></div>
                <button onClick={onBundle} className="text-[#f5a623] hover:text-amber-600 transition-colors cursor-pointer" title="Bundle Scene Images"><Layers size={14} /></button>
                <button onClick={handleSend} className={`${sendState === 'sent' ? 'text-emerald-600' : 'text-blue-600 hover:text-blue-700'} transition-colors w-4 h-4 flex items-center justify-center cursor-pointer`} title="Send to Board">
                    {sendState === 'sending' ? <Loader2 size={14} className="animate-spin" /> : sendState === 'sent' ? <Check size={14} /> : <Send size={14} />}
                </button>
            </div>
            <div className={`h-px flex-1 ${isLight ? 'bg-slate-300' : 'bg-[#2a2a36]'}`}></div>
        </div>
    );
};

const isValidImage = (url: string | null | undefined): boolean => {
    return !!url && (url.startsWith('data:image') || url.startsWith('http') || url.startsWith('blob:'));
};

const StoryCard = memo(({ shot, index, total, onUpdate, onAddNext, onDelete, onMove, onRender, onDownload, onOpenInspector, onToBoard, isRendering, isSelected, onToggleSelect, isLight, aiAvailable }: any) => {
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { setHistoryIndex(-1); }, [shot.imageUrl, shot.imageHistory]);
    useEffect(() => {
        if (confirmDelete) {
            const timer = setTimeout(() => setConfirmDelete(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmDelete]);

    const displayImage = historyIndex === -1 ? shot.imageUrl : (shot.imageHistory ? shot.imageHistory[historyIndex] : null);
    const hasHistory = shot.imageHistory && shot.imageHistory.length > 0;
    const handlePrevHistory = () => { if (historyIndex === -1 && hasHistory) setHistoryIndex(shot.imageHistory.length - 1); else if (historyIndex > 0) setHistoryIndex(historyIndex - 1); };
    const handleNextHistory = () => { if (historyIndex === -1) return; if (historyIndex < (shot.imageHistory.length - 1)) setHistoryIndex(historyIndex + 1); else setHistoryIndex(-1); };
    const handleSend = async () => { if (sendState !== 'idle') return; setSendState('sending'); const success = await onToBoard(shot.id, displayImage); if (success) { setSendState('sent'); setTimeout(() => setSendState('idle'), 2000); } else { setSendState('idle'); } };

    return (
        <div id={`story-card-${index}`} className={`rounded-xl overflow-hidden flex flex-col shadow-md group transition-all relative border ${
            isSelected 
                ? 'ring-2 ring-amber-500 border-amber-500 shadow-lg shadow-amber-500/10' 
                : isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#16161c] border-[#262632] hover:border-[#3a3a4c] hover:shadow-xl hover:shadow-black/60'
        }`}>
            <div className={`px-3 py-1.5 flex justify-between items-center border-b ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121216] border-[#22222a]'
            }`}>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onToggleSelect(shot.id)} 
                        className={`p-0.5 rounded cursor-pointer transition-colors ${
                            isSelected ? 'text-amber-500' : isLight ? 'text-slate-400 hover:text-slate-600' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title={isSelected ? "Deselect shot" : "Select shot"}
                    >
                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                    <span className={`text-[10px] font-black uppercase ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>Shot {index + 1}</span>
                    <div className={`flex rounded ml-1 opacity-70 group-hover:opacity-100 transition-opacity ${
                        isLight ? 'bg-slate-200' : 'bg-[#1e1e26] text-zinc-400'
                    }`}>
                        <button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="p-0.5 hover:text-amber-500 disabled:opacity-30 cursor-pointer"><ArrowLeft size={10} /></button>
                        <button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="p-0.5 hover:text-amber-500 disabled:opacity-30 cursor-pointer"><ArrowRight size={10} /></button>
                    </div>
                </div>
                <div className="flex gap-1 items-center">
                     <button onClick={() => onOpenInspector(shot.id)} className={`p-1 rounded flex items-center gap-1 cursor-pointer ${
                        isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-amber-600' : 'hover:bg-[#262632] text-zinc-400 hover:text-[#f5a623]'
                     }`} title="Shot Tuner"><Settings2 size={12} /></button>
                     <div className={`w-px h-3 mx-1 ${isLight ? 'bg-slate-200' : 'bg-[#282834]'}`}></div>
                     <button onClick={() => onAddNext(index)} className={`p-1 rounded cursor-pointer ${
                        isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-emerald-600' : 'hover:bg-[#262632] text-zinc-400 hover:text-green-400'
                     }`} title="Add Next Shot"><Plus size={12} /></button>
                     <button 
                        onClick={() => { if(confirmDelete) onDelete(shot.id); else setConfirmDelete(true); }} 
                        className={`p-1 rounded transition-colors cursor-pointer ${confirmDelete ? 'text-red-500 bg-red-900/20' : isLight ? 'text-slate-400 hover:text-red-600' : 'text-zinc-400 hover:text-red-400'}`}
                        title={confirmDelete ? "Click again to delete" : "Delete Shot"}
                     >
                        <Trash2 size={12} className={confirmDelete ? "animate-pulse" : ""} />
                     </button>
                </div>
            </div>

            <div className={`aspect-video relative flex items-center justify-center overflow-hidden border-b group-inner ${
                isLight ? 'bg-slate-200/90 border-slate-300' : 'bg-black border-black/20'
            }`}>
                {isValidImage(displayImage) ? (
                    <img src={displayImage} alt={`Shot ${index + 1}`} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                    <div className={`flex flex-col items-center gap-2 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}><Film size={32} /></div>
                )}
                {isRendering && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-amber-400 z-10">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Rendering...</span>
                    </div>
                )}
                {!isRendering && hasHistory && (
                    <div className="absolute inset-0 flex justify-between items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <button onClick={handlePrevHistory} className="bg-black/60 hover:bg-black/90 text-white p-1 rounded-full pointer-events-auto transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={handleNextHistory} className="bg-black/60 hover:bg-black/90 text-white p-1 rounded-full pointer-events-auto transition-colors"><ChevronRight size={16} /></button>
                    </div>
                )}

                {/* Refined Image Overlay Badges (Theme Adaptive & High Contrast) */}
                <div className={`absolute top-2 left-2 backdrop-blur-md text-[9.5px] font-mono font-black px-2 py-0.5 rounded-full border flex items-center gap-1.5 z-10 ${
                    isLight 
                        ? 'bg-white/95 text-amber-900 border-amber-400/80 shadow-xs' 
                        : 'bg-black/80 text-[#f5a623] border-amber-500/40 shadow-lg'
                }`}>
                    <span>SC {shot.scene || '?'}</span>
                    <span className={isLight ? 'text-slate-400' : 'text-zinc-500'}>·</span>
                    <span className={isLight ? 'text-slate-900 font-extrabold' : 'text-white'}>#{index + 1}</span>
                </div>

                {(() => {
                    const sType = shot.sourceType || 'manual';
                    let badgeStyles = '';
                    if (sType === 'ai-batch') {
                        badgeStyles = isLight 
                            ? 'bg-purple-100/95 text-purple-900 border-purple-300/90 shadow-xs' 
                            : 'bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-md';
                    } else if (sType === 'ai-modified') {
                        badgeStyles = isLight 
                            ? 'bg-blue-100/95 text-blue-900 border-blue-300/90 shadow-xs' 
                            : 'bg-blue-950/80 text-blue-300 border-blue-500/40 shadow-md';
                    } else {
                        badgeStyles = isLight 
                            ? 'bg-slate-100/95 text-slate-800 border-slate-300 shadow-xs' 
                            : 'bg-zinc-900/80 text-zinc-200 border-zinc-700 shadow-md';
                    }
                    return (
                        <div className={`absolute top-2 right-2 backdrop-blur-md text-[8.5px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 z-10 ${badgeStyles}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                            {sType === 'ai-batch' ? 'AI Division' : sType === 'ai-modified' ? 'AI Edit' : 'Manual'}
                        </div>
                    );
                })()}

                {historyIndex !== -1 && (<div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/20">V.{historyIndex + 1}</div>)}
            </div>

            <div className="p-3 flex-1 flex flex-col gap-2">
                <div className={`flex items-center justify-between gap-2 p-1.5 rounded-md border ${
                    isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#121216] border-[#22222c]'
                }`}>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded ${
                            isLight ? 'bg-amber-100 text-amber-900 border border-amber-300/60' : 'bg-[#22222b] text-amber-400'
                        }`}>SC.</span>
                        <BufferedInput 
                            className={`bg-transparent text-xs font-mono font-bold w-full outline-none transition-colors ${
                                isLight ? 'text-slate-900 focus:text-amber-600' : 'text-zinc-100 focus:text-[#f5a623]'
                            }`}
                            value={shot.scene || ''} 
                            onChange={(val: string) => onUpdate(shot.id, { scene: val })} 
                            placeholder="SCENE #" 
                        />
                    </div>
                    <div className={`text-[9px] font-mono font-bold uppercase shrink-0 px-2 py-0.5 rounded border ${
                        isLight ? 'bg-white text-slate-700 border-slate-300 shadow-2xs' : 'bg-[#181820] text-zinc-400 border-[#282834]'
                    }`}>
                        SHOT #{index + 1}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Size</label>
                        <select className={`w-full border rounded-md px-1.5 py-1 text-[10px] outline-none cursor-pointer transition-colors ${
                            isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500'
                        }`} value={shot.shotSize} onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}>
                            {SHOT_SIZES.map(s => <option key={s} value={s} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{s}</option>)}
                            {!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (<option value={shot.shotSize} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{shot.shotSize} (Custom)</option>)}
                        </select>
                    </div>
                    <div>
                         <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Angle</label>
                         <select className={`w-full border rounded-md px-1.5 py-1 text-[10px] outline-none cursor-pointer transition-colors ${
                            isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500'
                        }`} value={shot.angle} onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}>
                            {SHOT_ANGLES.map(a => <option key={a} value={a} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{a}</option>)}
                            {!SHOT_ANGLES.includes(shot.angle) && shot.angle && (<option value={shot.angle} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{shot.angle} (Custom)</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Lens</label>
                        <BufferedInput 
                            className={`w-full border rounded-md px-1.5 py-1 text-[10px] outline-none font-mono transition-colors ${
                                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500 placeholder:text-zinc-600'
                            }`}
                            value={shot.lens || ''} 
                            onChange={(val: string) => onUpdate(shot.id, { lens: val })} 
                            placeholder="35mm Prime"
                        />
                    </div>
                    <div>
                        <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Movement</label>
                        <BufferedInput 
                            className={`w-full border rounded-md px-1.5 py-1 text-[10px] outline-none font-mono transition-colors ${
                                isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500 placeholder:text-zinc-600'
                            }`}
                            value={shot.movement || ''} 
                            onChange={(val: string) => onUpdate(shot.id, { movement: val })} 
                            placeholder="Static / Dolly"
                        />
                    </div>
                </div>

                <div>
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Subject</label>
                    <BufferedInput 
                        className={`w-full border rounded-md px-1.5 py-1 text-[10px] outline-none transition-colors ${
                            isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500 placeholder:text-zinc-600'
                        }`} 
                        value={shot.subject} 
                        onChange={(val: string) => onUpdate(shot.id, { subject: val })} 
                    />
                </div>
                <div className="flex-1">
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Visual Action</label>
                    <BufferedTextArea 
                        className={`w-full h-16 border rounded-md px-1.5 py-1 text-[10px] outline-none resize-none leading-relaxed transition-colors ${
                            isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400 shadow-2xs' : 'bg-[#0f0f13] border-[#262634] text-zinc-200 focus:border-amber-500 focus:bg-[#14141a] placeholder:text-zinc-600'
                        }`} 
                        value={shot.description} 
                        onChange={(val: string) => onUpdate(shot.id, { description: val })} 
                    />
                </div>

                {shot.scriptReference && (
                    <div className={`p-1.5 rounded-md border text-[9px] font-mono truncate ${
                        isLight ? 'bg-amber-50/80 border-amber-200 text-amber-950' : 'bg-[#0e0e12] border-[#20202a] text-zinc-400'
                    }`} title={shot.scriptReference}>
                        <span className={isLight ? "text-amber-800 font-bold" : "text-amber-500 font-bold"}>Script Ref:</span> {shot.scriptReference}
                    </div>
                )}
            </div>
            <div className={`p-2 border-t flex gap-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121216] border-[#22222a]'
            }`}>
                <button onClick={() => onRender(index)} disabled={isRendering || !aiAvailable} title={aiAvailable ? undefined : "AI unavailable — no working API key"} className={`flex-1 border py-1.5 rounded-md text-[10px] font-extrabold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isLight 
                        ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-2xs' 
                        : 'bg-[#1e1e28] border-[#2c2c3a] text-zinc-200 hover:bg-[#282836] hover:text-white hover:border-amber-500/50'
                }`}>
                    <ImageIcon size={12} className={isLight ? 'text-amber-400' : ''} /> {shot.imageUrl ? 'Re-Draw' : 'Draw'}
                </button>
                <button 
                    onClick={() => onDownload(index, displayImage)} 
                    className={`w-8 rounded-md flex items-center justify-center transition-colors cursor-pointer border ${
                        isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400' : 'bg-[#1a3c28] border-[#2e7d32] text-[#81c784] hover:bg-[#2e7d32] hover:text-white'
                    }`} 
                    title="Download Card"
                >
                    <Download size={12} />
                </button>
                <button 
                    onClick={handleSend} 
                    disabled={sendState !== 'idle'} 
                    className={
                        sendState === 'sent' 
                            ? `w-8 border rounded-md flex items-center justify-center transition-all duration-300 cursor-pointer ${isLight ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-green-900 border-green-600 text-green-400'}`
                            : `w-8 border rounded-md flex items-center justify-center transition-all duration-300 cursor-pointer ${isLight ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400' : 'bg-blue-900 border-blue-600 text-blue-400 hover:bg-blue-800 hover:text-white'}`
                    } 
                    title="Send to Canvas Board"
                >
                    {sendState === 'sending' ? <Loader2 size={12} className="animate-spin" /> : sendState === 'sent' ? <Check size={12} /> : <Send size={12} />}
                </button>
            </div>
        </div>
    );
}, (prev, next) => prev.shot === next.shot && prev.index === next.index && prev.isRendering === next.isRendering && prev.total === next.total && prev.isSelected === next.isSelected && prev.isLight === next.isLight && prev.aiAvailable === next.aiAvailable);

const ShotRow = memo(({ shot, index, total, onUpdate, onAddNext, onDelete, onMove, onRender, isRendering, isSelected, onToggleSelect, isLight, aiAvailable }: any) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    useEffect(() => {
        if (confirmDelete) {
            const timer = setTimeout(() => setConfirmDelete(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmDelete]);

    return (
        <tr className={`border-b transition-colors group ${
            isSelected 
                ? isLight ? 'bg-amber-50/80 border-amber-200' : 'bg-amber-500/10 border-amber-500/30' 
                : isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-[#22222a] hover:bg-[#181820]'
        }`}>
            <td className={`p-2 text-center text-xs font-mono w-12 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <button 
                    onClick={() => onToggleSelect(shot.id)} 
                    className={`p-0.5 rounded cursor-pointer transition-colors ${
                        isSelected ? 'text-amber-500' : isLight ? 'text-slate-400 hover:text-slate-600' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
            </td>
            <td className={`p-2 text-center text-xs font-mono w-14 border-r ${isLight ? 'border-slate-200 text-slate-600' : 'border-[#22222a] text-zinc-400'}`}>
                <div className="flex flex-col items-center gap-1">
                    <span>{index + 1}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="hover:text-amber-500 disabled:opacity-30 cursor-pointer"><ArrowUp size={10} /></button>
                        <button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="hover:text-amber-500 disabled:opacity-30 cursor-pointer"><ArrowDown size={10} /></button>
                    </div>
                </div>
            </td>
            <td className={`p-2 w-32 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <div className={`w-28 h-16 bg-black rounded border overflow-hidden relative flex items-center justify-center ${aiAvailable ? 'cursor-pointer hover:border-amber-500 group/thumb' : 'cursor-not-allowed opacity-40 group/thumb'} ${isLight ? 'border-slate-300' : 'border-[#2a2a36]'}`} onClick={() => aiAvailable && onRender(index)} title={aiAvailable ? undefined : "AI unavailable — no working API key"}>
                    {isValidImage(shot.imageUrl) ? (<img src={shot.imageUrl} loading="lazy" className="w-full h-full object-cover" />) : (<Film size={16} className="text-zinc-600" />)}
                    {isRendering ? (<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-amber-400" /></div>) : (<div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity"><Wand2 size={16} className="text-white" /></div>)}
                </div>
            </td>
            <td className={`p-2 w-20 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <BufferedInput className={`w-full bg-transparent text-xs text-center border-b border-transparent focus:border-amber-500 outline-none ${
                    isLight ? 'text-slate-800 placeholder:text-slate-400' : 'text-zinc-200 placeholder:text-zinc-600'
                }`} value={shot.scene || ''} onChange={(val: string) => onUpdate(shot.id, { scene: val })} placeholder="SC#" />
            </td>
            <td className={`p-2 w-36 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <select className={`w-full bg-transparent text-xs outline-none border border-transparent rounded py-1 cursor-pointer ${
                    isLight ? 'text-slate-800 hover:border-slate-300 focus:border-amber-500' : 'text-zinc-200 hover:border-[#2a2a36] focus:border-[#f5a623]'
                }`} value={shot.shotSize} onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}>
                    {SHOT_SIZES.map(s => <option key={s} value={s} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{s}</option>)}
                    {!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (<option value={shot.shotSize} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{shot.shotSize}</option>)}
                </select>
            </td>
            <td className={`p-2 w-36 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <select className={`w-full bg-transparent text-xs outline-none border border-transparent rounded py-1 cursor-pointer ${
                    isLight ? 'text-slate-800 hover:border-slate-300 focus:border-amber-500' : 'text-zinc-200 hover:border-[#2a2a36] focus:border-[#f5a623]'
                }`} value={shot.angle} onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}>
                    {SHOT_ANGLES.map(a => <option key={a} value={a} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{a}</option>)}
                    {!SHOT_ANGLES.includes(shot.angle) && shot.angle && (<option value={shot.angle} className={isLight ? 'bg-white text-slate-800' : 'bg-[#181820] text-zinc-200'}>{shot.angle}</option>)}
                </select>
            </td>
            <td className={`p-2 w-36 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <BufferedInput className={`w-full bg-transparent text-[11px] font-mono outline-none border-b border-transparent focus:border-amber-500 py-0.5 ${
                    isLight ? 'text-slate-800' : 'text-zinc-200 placeholder:text-zinc-600'
                }`} value={shot.lens || ''} onChange={(val: string) => onUpdate(shot.id, { lens: val })} placeholder="Lens..." />
                <BufferedInput className="w-full bg-transparent text-[11px] font-mono text-amber-600 dark:text-[#f5a623] outline-none border-b border-transparent focus:border-amber-500 py-0.5" value={shot.movement || ''} onChange={(val: string) => onUpdate(shot.id, { movement: val })} placeholder="Movement..." />
            </td>
            <td className={`p-2 w-44 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <BufferedInput className={`w-full bg-transparent text-xs outline-none border-b border-transparent focus:border-amber-500 py-1 ${
                    isLight ? 'text-slate-800' : 'text-zinc-200 placeholder:text-zinc-600'
                }`} value={shot.subject} onChange={(val: string) => onUpdate(shot.id, { subject: val })} placeholder="Subject..." />
            </td>
            <td className={`p-2 border-r ${isLight ? 'border-slate-200' : 'border-[#22222a]'}`}>
                <BufferedTextArea className={`w-full bg-transparent text-xs resize-none outline-none rounded p-1 h-12 leading-relaxed ${
                    isLight ? 'text-slate-800 focus:bg-white' : 'text-zinc-200 focus:bg-[#181820]'
                }`} value={shot.description} onChange={(val: string) => onUpdate(shot.id, { description: val })} placeholder="Describe the action..." />
                {shot.scriptReference && (
                    <div className={`text-[10px] font-mono truncate px-1 italic ${isLight ? 'text-slate-500' : 'text-zinc-400'}`} title={shot.scriptReference}>
                        Ref: {shot.scriptReference}
                    </div>
                )}
            </td>
            <td className="p-2 text-center w-20">
                <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onAddNext(index)} className={`p-1.5 rounded transition-colors cursor-pointer ${
                        isLight ? 'text-slate-400 hover:text-emerald-600 hover:bg-slate-200' : 'text-zinc-400 hover:text-green-400 hover:bg-[#22222a]'
                    }`} title="Add Shot After"><Plus size={14} /></button>
                    <button 
                        onClick={() => { if(confirmDelete) onDelete(shot.id); else setConfirmDelete(true); }}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${confirmDelete ? 'text-red-500 bg-red-900/20' : isLight ? 'text-slate-400 hover:text-red-600 hover:bg-slate-200' : 'text-zinc-400 hover:text-red-400 hover:bg-[#22222a]'}`}
                        title={confirmDelete ? "Click again to confirm" : "Delete"}
                    >
                        <Trash2 size={14} className={confirmDelete ? "animate-pulse" : ""} />
                    </button>
                </div>
            </td>
        </tr>
    );
});

const StoryboardView: React.FC = () => {
  const { 
      beats, generatedShots, setGeneratedShots, updateGeneratedShot, 
      addGeneratedShot, removeGeneratedShot, moveGeneratedShot, storyboardConfig, setStoryboardConfig,
      characterData, setAnnotations, panX, panY, scale,
      projectList = [], currentProjectId = null, appTheme
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();
  
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  
  // Range Analysis State
  const [startScene, setStartScene] = useState(1);
  const [endScene, setEndScene] = useState(beats.length || 1);
  const [analyzing, setAnalyzing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScene, setFilterScene] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'rendered' | 'unrendered'>('all');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Render Queue State
  const [delay, setDelay] = useState(5); // Seconds
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [currentlyRenderingId, setCurrentlyRenderingId] = useState<string | null>(null);
  
  // Inspector State
  const [inspectorShotId, setInspectorShotId] = useState<string | null>(null);
  
  // View Customization
  const [viewMode, setViewType] = useState<'grid' | 'table'>('grid');
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [showSceneBreaks, setShowSceneBreaks] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Project Metadata for Print & Copy in Storyboard / Gallery View
  const activeProjectName = useMemo(() => {
      const proj = projectList.find(p => p.id === currentProjectId);
      return proj ? proj.name : 'SEQUENCER PROJECT';
  }, [projectList, currentProjectId]);

  const [customProjectName, setCustomProjectName] = useState<string>('');
  const [productionCompany, setProductionCompany] = useState<string>('Apex Pictures');
  const [directorName, setDirectorName] = useState<string>('Director Name');
  const [hodName, setHodName] = useState<string>('DP / HOD');
  const [hodDept, setHodDept] = useState<string>('Camera & Storyboard');
  const [includeProjectMetadata, setIncludeProjectMetadata] = useState<boolean>(true);
  const [includeHodSignoff, setIncludeHodSignoff] = useState<boolean>(true);

  // Batch Selection Handlers
  const handleToggleSelect = (id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleSelectAll = () => {
      if (selectedIds.size === filteredShots.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredShots.map(s => s.id)));
      }
  };

  const handleClearSelection = () => {
      setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      if (confirm(`Delete ${selectedIds.size} selected shots?`)) {
          selectedIds.forEach(id => removeGeneratedShot(id));
          setSelectedIds(new Set());
      }
  };

  const handleBulkRender = async () => {
      if (selectedIds.size === 0) return;
      const targetShots = generatedShots.filter(s => selectedIds.has(s.id));
      if (targetShots.length === 0) return;

      setIsQueueRunning(true);
      cancelQueueRef.current = false;
      setQueueProgress({ current: 0, total: targetShots.length });

      for (let i = 0; i < targetShots.length; i++) {
          if (cancelQueueRef.current) break;
          const shot = targetShots[i];
          setQueueProgress({ current: i + 1, total: targetShots.length });
          setCurrentlyRenderingId(shot.id);
          try {
               const prompt = buildEnhancedPrompt(shot);
               const url = await generateImage({
                   prompt, 
                   aspectRatio: storyboardConfig.aspectRatio || '16:9',
                   model: storyboardConfig.imageModel || 'gemini-2.5-flash-image'
               });
               if (url) {
                   const newHistory = shot.imageHistory ? [...shot.imageHistory] : [];
                   if (shot.imageUrl) newHistory.push(shot.imageUrl);
                   updateGeneratedShot(shot.id, { imageUrl: url, imageHistory: newHistory });
               }
          } catch (e: any) { 
              console.error(`Failed to render shot ${i + 1}`, e);
              alert(`Batch Queue Stopped at Shot ${i+1}:\n${e.message || 'Unknown Error'}`);
              break;
          }
          if (i < targetShots.length - 1 && !cancelQueueRef.current) {
               setCurrentlyRenderingId(null);
               await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
      }
      setCurrentlyRenderingId(null);
      setIsQueueRunning(false);
  };

  const handleBulkSetSize = (shotSize: string) => {
      if (selectedIds.size === 0 || !shotSize) return;
      selectedIds.forEach(id => updateGeneratedShot(id, { shotSize }));
  };

  // Scene Options for Filter
  const availableScenes = useMemo(() => {
      const scenesSet = new Set<string>();
      generatedShots.forEach(s => {
          if (s.scene) scenesSet.add(String(s.scene));
      });
      return Array.from(scenesSet).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
  }, [generatedShots]);

  // Filtered Shot List
  const filteredShots = useMemo(() => {
      return generatedShots.filter(shot => {
          // Search filter
          if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              const matchScene = String(shot.scene || '').toLowerCase().includes(q);
              const matchSubject = (shot.subject || '').toLowerCase().includes(q);
              const matchDesc = (shot.description || '').toLowerCase().includes(q);
              const matchSize = (shot.shotSize || '').toLowerCase().includes(q);
              const matchAngle = (shot.angle || '').toLowerCase().includes(q);
              const matchLens = (shot.lens || '').toLowerCase().includes(q);
              const matchMove = (shot.movement || '').toLowerCase().includes(q);
              if (!matchScene && !matchSubject && !matchDesc && !matchSize && !matchAngle && !matchLens && !matchMove) {
                  return false;
              }
          }

          // Scene filter
          if (filterScene !== 'all' && String(shot.scene) !== filterScene) {
              return false;
          }

          // Render status filter
          if (filterStatus === 'rendered' && !isValidImage(shot.imageUrl)) return false;
          if (filterStatus === 'unrendered' && isValidImage(shot.imageUrl)) return false;

          return true;
      });
  }, [generatedShots, searchQuery, filterScene, filterStatus]);

  // Metrics
  const metrics = useMemo(() => {
      const total = generatedShots.length;
      const rendered = generatedShots.filter(s => isValidImage(s.imageUrl)).length;
      const unrendered = total - rendered;
      const estTotalSec = generatedShots.reduce((acc, s) => acc + (s.durationSec || 3), 0);
      const estMin = Math.floor(estTotalSec / 60);
      const estSec = Math.round(estTotalSec % 60);
      const timeStr = `${estMin}m ${estSec}s`;
      return { total, rendered, unrendered, timeStr };
  }, [generatedShots]);

  const handlePrintGallery = () => {
      if (generatedShots.length === 0) { alert("No shots available to print."); return; }
      const projTitle = customProjectName.trim() || activeProjectName;
      const printWindow = window.open('', '_blank', 'width=1000,height=1200');
      if (!printWindow) return;

      const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>${projTitle} - Storyboard Gallery Lookbook</title>
              <style>
                  @page { size: A4 landscape; margin: 10mm; }
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #111; background: #fff; }
                  .header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                  .title { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
                  .meta { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; margin-top: 4px; }
                  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; page-break-inside: avoid; }
                  .card { border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #fcfcfc; display: flex; flex-direction: column; }
                  .img-box { width: 100%; aspect-ratio: 16/9; background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                  .img-box img { width: 100%; height: 100%; object-fit: cover; }
                  .no-img { color: #666; font-size: 11px; font-weight: bold; font-family: monospace; }
                  .card-body { padding: 10px; font-size: 11px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
                  .scene-badge { font-weight: 900; color: #d97706; text-transform: uppercase; font-size: 10px; }
                  .shot-size { font-weight: 800; font-size: 11px; color: #111; text-transform: uppercase; }
                  .desc { font-size: 10px; color: #333; margin-top: 4px; line-height: 1.3; }
                  .hod-signoff { margin-top: 30px; padding-top: 15px; border-top: 2px solid #111; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; font-size: 11px; }
                  .hod-col { display: flex; flex-direction: column; gap: 4px; }
                  .hod-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #666; }
                  .hod-line { border-bottom: 1.5px solid #111; width: 180px; height: 18px; }
                  .btn { padding: 8px 16px; background: #000; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer; border: none; font-size: 12px; }
                  @media print { .no-print { display: none !important; } }
              </style>
          </head>
          <body>
              <div class="header">
                  <div>
                      <div class="title">🎬 ${projTitle.toUpperCase()} — STORYBOARD GALLERY LOOKBOOK</div>
                      ${includeProjectMetadata ? `
                      <div class="meta">
                          ${productionCompany ? `PRODUCTION: ${productionCompany.toUpperCase()} • ` : ''}
                          ${directorName ? `DIRECTOR: ${directorName.toUpperCase()} • ` : ''}
                          DATE: ${new Date().toLocaleDateString()}
                      </div>
                      ` : ''}
                  </div>
                  <div class="no-print">
                      <button onclick="window.print()" class="btn">🖨️ Print Storyboard Lookbook</button>
                  </div>
              </div>
              <div class="grid">
                  ${filteredShots.map((shot, idx) => `
                      <div class="card">
                          <div class="img-box">
                              ${shot.imageUrl ? `<img src="${shot.imageUrl}" />` : `<div class="no-img">SHOT ${idx + 1} - NO VISUAL</div>`}
                          </div>
                          <div class="card-body">
                              <div style="display:flex; justify-content:space-between; align-items:center;">
                                  <span class="scene-badge">SCENE ${shot.scene || '?'}</span>
                                  <span class="shot-size">${shot.shotSize || 'WIDE'} / ${shot.angle || 'EYE LEVEL'}</span>
                              </div>
                              <div class="desc">${shot.description || 'No description provided'}</div>
                          </div>
                      </div>
                  `).join('')}
              </div>
              ${includeHodSignoff ? `
              <div class="hod-signoff">
                  <div class="hod-col">
                      <div class="hod-label">HOD / DEPARTMENT HEAD</div>
                      <div style="font-weight: 800; font-size: 11px;">${hodName.toUpperCase()} (${hodDept.toUpperCase()})</div>
                  </div>
                  <div class="hod-col">
                      <div class="hod-label">HOD SIGNATURE</div>
                      <div class="hod-line"></div>
                  </div>
                  <div class="hod-col">
                      <div class="hod-label">APPROVAL DATE</div>
                      <div class="hod-line"></div>
                  </div>
                  <div class="hod-col">
                      <div class="hod-label">VERIFICATION</div>
                      <div style="font-weight: 800; font-size: 11px;">[  ] APPROVED &nbsp;&nbsp;&nbsp; [  ] REVISED</div>
                  </div>
              </div>
              ` : ''}
              <script>setTimeout(function(){ window.print(); }, 500);</script>
          </body>
          </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  const handleCopyShotList = () => {
      if (filteredShots.length === 0) { alert("No shots to copy."); return; }
      const projTitle = customProjectName.trim() || activeProjectName;
      let lines: string[] = [];
      if (includeProjectMetadata) {
          lines.push(`🎬 PROJECT: ${projTitle.toUpperCase()}`);
          if (productionCompany.trim()) lines.push(`🏢 PRODUCTION: ${productionCompany.trim().toUpperCase()}`);
          if (directorName.trim()) lines.push(`🎥 DIRECTOR: ${directorName.trim().toUpperCase()}`);
          lines.push(`==================================================`);
      }
      lines.push(`STORYBOARD SHOT LIST MANIFEST (${filteredShots.length} SHOTS)`);
      lines.push(`--------------------------------------------------`);

      filteredShots.forEach((s, i) => {
          lines.push(`SHOT ${i + 1} [SCENE ${s.scene || '?'}] - ${s.shotSize} / ${s.angle}`);
          if (s.subject) lines.push(`  Subject: ${s.subject}`);
          if (s.description) lines.push(`  Action: ${s.description}`);
          lines.push(``);
      });

      if (includeHodSignoff) {
          lines.push(`==================================================`);
          lines.push(`HOD SIGN-OFF: ${hodName.toUpperCase()} (${hodDept.toUpperCase()})`);
          lines.push(`SIGNATURE: _______________________ DATE: _________ STATUS: [  ] APPROVED`);
      }

      navigator.clipboard.writeText(lines.join('\n'));
      alert(`Copied ${filteredShots.length} shots list to clipboard!`);
  };
  
  // Ref for cancellation
  const cancelQueueRef = useRef(false);

  // Helper: Get Script Text
  const getScriptSegment = () => {
    const sorted = [...beats].sort((a, b) => a.x - b.x);
    const validStart = Math.max(1, Math.min(startScene, sorted.length));
    const validEnd = Math.min(sorted.length, Math.max(validStart, endScene));
    
    return sorted.slice(validStart - 1, validEnd)
      .map((b, i) => `SCENE ${validStart + i}: ${b.slug.prefix} ${b.slug.location} - ${b.slug.time}\n${b.content.replace(/<[^>]+>/g, '')}`)
      .join('\n\n');
  };

  // --- 1. ANALYSIS (TEXT -> SHOTS) ---
  const handlePlanShots = async () => {
    setAnalyzing(true);
    try {
      const text = getScriptSegment();
      if (!text.trim()) { alert("No scenes found in that range."); return; }
      
      const rawShots = await generateShotList(text, storyboardConfig.textModel || 'gemini-2.5-flash');
      const shotsArray = Array.isArray(rawShots) 
        ? rawShots 
        : (rawShots && typeof rawShots === 'object' 
            ? ((rawShots as any).shots || (rawShots as any).shotList || (rawShots as any).scenes || []) 
            : []);
      const mappedShots: Shot[] = shotsArray.map((s: any, i: number) => ({
          id: `${Date.now()}-${i}`,
          shotSize: s.shotSize || s.size || 'WIDE',
          angle: s.angle || 'EYE LEVEL',
          description: s.description || s.action || '',
          subject: s.subject || '',
          scene: s.scene || '?',
          sourceType: 'ai-batch',
          imageUrl: null,
          imageHistory: []
      }));
      
      setGeneratedShots(mappedShots);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please check your connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- EXPORT FUNCTION ---
  const handleExport = async (format: 'csv' | 'excel') => {
      setIsExporting(true);
      try {
          if (filteredShots.length === 0) {
              alert("No shots to export.");
              return;
          }

          const exportData = filteredShots.map((shot, i) => ({
              Index: i + 1,
              Scene: shot.scene || '?',
              Size: shot.shotSize,
              Angle: shot.angle,
              Subject: shot.subject,
              Description: shot.description,
              Notes: ''
          }));

          const fileName = `Storyboard_Export_${new Date().toISOString().slice(0,10)}`;

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
              XLSX.utils.book_append_sheet(workbook, worksheet, "ShotList");
              XLSX.writeFile(workbook, `${fileName}.xlsx`);
          }
      } catch (e) {
          console.error("Export failed", e);
          alert("Export failed. Check console for details.");
      } finally {
          setIsExporting(false);
      }
  };

  // --- PROMPT BUILDER ---
  const buildEnhancedPrompt = (shot: Shot) => {
      let prompt = `Cinematic storyboard frame, style: ${storyboardConfig.style || "Charcoal Sketch"}. \n`;
      prompt += `Shot Type: ${shot.shotSize || 'WIDE'}. Angle: ${shot.angle || 'EYE LEVEL'}. \n`;
      prompt += `Action: ${shot.description || 'No action'}. \n`;
      prompt += `Subject: ${shot.subject || 'Scene'}. \n`;
      
      if (shot.composition) {
          if (shot.composition.framing) prompt += `Framing: ${shot.composition.framing}. `;
          if (shot.composition.headroom) prompt += `Headroom: ${shot.composition.headroom}. `;
      }
      
      const subj = shot.subject || '';
      const desc = shot.description || '';
      const blockingChar = shot.blocking?.characterId || '';
      const combinedText = (subj + ' ' + desc + ' ' + blockingChar).toLowerCase();
      const matchedChars: string[] = [];

      if (characterData) {
          Object.values(characterData).forEach((char: CharacterData) => {
              if (char && char.name && combinedText.includes(char.name.toLowerCase())) {
                  let visualProfile = `\n[CHARACTER REFERENCE: ${char.name}]`;
                  visualProfile += `\n- Age/Gender: ${char.age} ${char.gender}`;
                  if(char.hair) visualProfile += `\n- Hair: ${char.hair}`;
                  if(char.eyes) visualProfile += `\n- Eyes: ${char.eyes}`;
                  if(char.build) visualProfile += `\n- Build: ${char.build}`;
                  if(char.archetype) visualProfile += `\n- Vibe: ${char.archetype}`;
                  if(char.occupation) visualProfile += `\n- Role: ${char.occupation}`;
                  if(char.physiology) visualProfile += `\n- Visual Notes: ${char.physiology}`;
                  matchedChars.push(visualProfile);
              }
          });
      }

      if (matchedChars.length > 0) {
          prompt += "\n\n*** CHARACTER CONSISTENCY ENFORCED ***";
          prompt += matchedChars.join('\n');
      }

      return prompt;
  };

  // --- RENDER LOGIC (Single & Queue) ---
  const renderSingleShot = async (index: number) => {
    const shot = generatedShots[index];
    if (!shot) return;
    if (!aiAvailable) return;
    
    setCurrentlyRenderingId(shot.id);
    try {
      const prompt = buildEnhancedPrompt(shot);
      
      const url = await generateImage({
          prompt, 
          aspectRatio: storyboardConfig.aspectRatio || '16:9',
          model: storyboardConfig.imageModel || 'gemini-2.5-flash-image'
      });

      if (url) {
        const newHistory = shot.imageHistory ? [...shot.imageHistory] : [];
        if (shot.imageUrl) newHistory.push(shot.imageUrl);
        updateGeneratedShot(shot.id, { imageUrl: url, imageHistory: newHistory });
      }
    } catch (e: any) {
      console.error("Single render failed", e);
      alert(`Image Generation Failed:\n${e.message || 'Unknown error'}`);
    } finally {
      setCurrentlyRenderingId(null);
    }
  };

  const handleRenderAll = async () => {
    if (generatedShots.length === 0) return;
    setIsQueueRunning(true);
    cancelQueueRef.current = false;
    setQueueProgress({ current: 0, total: generatedShots.length });

    for (let i = 0; i < generatedShots.length; i++) {
        if (cancelQueueRef.current) break;
        const shot = generatedShots[i];
        setQueueProgress({ current: i + 1, total: generatedShots.length });
        setCurrentlyRenderingId(shot.id);
        try {
             const prompt = buildEnhancedPrompt(shot);
             const url = await generateImage({
                 prompt, 
                 aspectRatio: storyboardConfig.aspectRatio || '16:9',
                 model: storyboardConfig.imageModel || 'gemini-2.5-flash-image'
             });
             if (url) {
                 const newHistory = shot.imageHistory ? [...shot.imageHistory] : [];
                 if (shot.imageUrl) newHistory.push(shot.imageUrl);
                 updateGeneratedShot(shot.id, { imageUrl: url, imageHistory: newHistory });
             }
        } catch (e: any) { 
            console.error(`Failed to render shot ${i + 1}`, e);
            alert(`Queue Stopped at Shot ${i+1}:\n${e.message || 'Unknown Error'}`);
            break;
        }
        if (i < generatedShots.length - 1 && !cancelQueueRef.current) {
             setCurrentlyRenderingId(null);
             await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
    }
    setCurrentlyRenderingId(null);
    setIsQueueRunning(false);
  };

  const handleStopQueue = () => {
      cancelQueueRef.current = true;
      setIsQueueRunning(false);
      setCurrentlyRenderingId(null);
  };

  const generateCardDataUrl = async (shot: Shot, scale = 2): Promise<string | null> => {
      if(!shot) return null;
      const container = document.createElement('div');
      container.style.position = 'absolute'; container.style.top = '-10000px'; container.style.left = '0';
      document.body.appendChild(container);
      const card = document.createElement('div');
      card.style.width = '1200px'; card.style.backgroundColor = '#111'; card.style.color = '#eee'; card.style.fontFamily = 'Helvetica Neue, Arial, sans-serif'; card.style.padding = '0'; card.style.display = 'flex'; card.style.flexDirection = 'column';
      const imgContainer = document.createElement('div');
      imgContainer.style.width = '100%'; imgContainer.style.aspectRatio = '16/9'; imgContainer.style.backgroundColor = '#000'; imgContainer.style.display = 'flex'; imgContainer.style.alignItems = 'center'; imgContainer.style.justifyContent = 'center'; imgContainer.style.overflow = 'hidden';
      if (isValidImage(shot.imageUrl)) { const img = document.createElement('img'); img.src = shot.imageUrl!; img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; imgContainer.appendChild(img); } else { const placeholder = document.createElement('div'); placeholder.innerText = 'NO VISUAL'; placeholder.style.color = '#333'; placeholder.style.fontSize = '40px'; placeholder.style.fontWeight = 'bold'; imgContainer.appendChild(placeholder); }
      const info = document.createElement('div'); info.style.padding = '40px'; info.style.backgroundColor = '#1a1a1a'; info.style.borderTop = '2px solid #333';
      const header = document.createElement('div'); header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.marginBottom = '20px'; header.style.borderBottom = '1px solid #333'; header.style.paddingBottom = '20px';
      const sceneInfo = document.createElement('div'); sceneInfo.innerHTML = `<span style="color:#666; font-size: 18px; font-weight: 800; letter-spacing: 2px;">SCENE ${shot.scene || '?'}</span>`;
      const shotInfo = document.createElement('div'); shotInfo.innerHTML = `<span style="color:#f5a623; font-size: 24px; font-weight: 900; text-transform: uppercase;">${shot.shotSize} / ${shot.angle}</span>`;
      header.appendChild(sceneInfo); header.appendChild(shotInfo);
      const desc = document.createElement('div'); desc.innerText = shot.description || ''; desc.style.fontSize = '28px'; desc.style.lineHeight = '1.5'; desc.style.color = '#ddd'; desc.style.fontWeight = '500';
      info.appendChild(header); info.appendChild(desc);
      card.appendChild(imgContainer); card.appendChild(info);
      container.appendChild(card);
      try {
          const canvas = await html2canvas(card, { scale: scale, backgroundColor: '#111', useCORS: true });
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          document.body.removeChild(container);
          return dataUrl;
      } catch (e) { 
          console.error("Card Generation failed", e); 
          document.body.removeChild(container);
          return null;
      } 
  };

  const downloadCard = async (index: number, specificImageUrl?: string | null) => {
    const shot = generatedShots[index];
    if(!shot) return;
    const shotToRender = specificImageUrl ? { ...shot, imageUrl: specificImageUrl } : shot;
    const dataUrl = await generateCardDataUrl(shotToRender);
    if (dataUrl) { const link = document.createElement('a'); link.download = `shot_${index+1}_highres.png`; link.href = dataUrl; link.click(); } else { alert("Failed to export high-res card."); }
  };

  const handleBundleScene = async (sceneId: string) => {
      const sceneShots = generatedShots.filter(s => String(s.scene) === sceneId && isValidImage(s.imageUrl));
      if (sceneShots.length === 0) { alert("No generated visuals found in this scene to bundle."); return; }
      const container = document.createElement('div');
      container.style.position = 'absolute'; container.style.top = '-20000px'; container.style.left = '0'; container.style.width = '1000px';  container.style.backgroundColor = '#000'; container.style.display = 'flex'; container.style.flexDirection = 'column'; container.style.padding = '20px'; container.style.gap = '20px';
      const header = document.createElement('div');
      header.style.color = '#fff'; header.style.fontSize = '24px'; header.style.fontWeight = 'bold'; header.style.padding = '20px'; header.style.textAlign = 'center'; header.style.borderBottom = '2px solid #333';
      header.innerText = `SCENE ${sceneId} VISUAL STRIP`;
      container.appendChild(header);
      sceneShots.forEach((shot, i) => {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex'; wrapper.style.gap = '20px'; wrapper.style.alignItems = 'center';
          const img = document.createElement('img');
          img.src = shot.imageUrl!;
          img.style.width = '600px'; img.style.height = 'auto'; img.style.border = '1px solid #333';
          const info = document.createElement('div');
          info.style.flex = '1'; info.style.color = '#ccc'; info.style.fontFamily = 'monospace';
          info.innerHTML = `<div style="color:#f5a623; font-weight:900; font-size:20px; margin-bottom:10px;">${shot.shotSize}</div><div style="font-size:16px; line-height:1.4;">${shot.description}</div>`;
          wrapper.appendChild(img); wrapper.appendChild(info);
          container.appendChild(wrapper);
      });
      document.body.appendChild(container);
      try {
          const canvas = await html2canvas(container, { scale: 1.5, backgroundColor: '#000', useCORS: true });
          const link = document.createElement('a'); link.download = `Scene_${sceneId}_Strip.png`; link.href = canvas.toDataURL('image/png', 0.9); link.click();
      } catch (e) { console.error("Bundle failed", e); alert("Failed to bundle scene images."); } finally { document.body.removeChild(container); }
  };

  const handleAddToBoard = async (shotId: string, specificImageUrl?: string | null): Promise<boolean> => {
      const shot = generatedShots.find(s => s.id === shotId);
      if (!shot) return false;
      const imageToUse = specificImageUrl || shot.imageUrl;
      if (!isValidImage(imageToUse)) return false;
      const tempShot = { ...shot, imageUrl: imageToUse };
      const dataUrl = await generateCardDataUrl(tempShot, 1.5); 
      if (!dataUrl) { alert("Failed to generate card for board."); return false; }
      const centerX = (-panX + (window.innerWidth / 2)) / scale;
      const centerY = (-panY + (window.innerHeight / 2)) / scale;
      const newAnno: Annotation = { id: Date.now(), type: 'image', x: centerX - 200,  y: centerY - 150,  w: 400, h: 300, color: '#ffffff', imageUrl: dataUrl };
      setAnnotations(prev => [...prev, newAnno]);
      return true;
  };

  const handleSceneToBoard = async (sceneId: string): Promise<boolean> => {
      const sceneShots = generatedShots.filter(s => String(s.scene || '?') === sceneId && isValidImage(s.imageUrl));
      if (sceneShots.length === 0) { alert("No generated images found in this scene to bundle."); return false; }
      const centerX = (-panX + (window.innerWidth / 2)) / scale;
      const centerY = (-panY + (window.innerHeight / 2)) / scale;
      const CARD_WIDTH = 400; const GAP = 40; const COLS = Math.ceil(Math.sqrt(sceneShots.length)); 
      const newAnnotations: Annotation[] = [];
      const originalCursor = document.body.style.cursor;
      document.body.style.cursor = 'wait';
      try {
          for (let i = 0; i < sceneShots.length; i++) {
              const shot = sceneShots[i];
              const dataUrl = await generateCardDataUrl(shot, 1.5);
              if (dataUrl) {
                  const col = i % COLS; const row = Math.floor(i / COLS);
                  const gridWidth = (COLS * CARD_WIDTH) + ((COLS - 1) * GAP);
                  const startX = centerX - (gridWidth / 2); const startY = centerY - 200; 
                  const x = startX + (col * (CARD_WIDTH + GAP)); const y = startY + (row * (300 + GAP)); 
                  newAnnotations.push({ id: Date.now() + i, type: 'image', x: x, y: y, w: CARD_WIDTH, h: 300,  color: '#ffffff', imageUrl: dataUrl });
              }
          }
          if (newAnnotations.length > 0) { setAnnotations(prev => [...prev, ...newAnnotations]); return true; }
          return false;
      } catch (e) { console.error("Batch export error", e); return false; } finally { document.body.style.cursor = originalCursor; }
  };

  const getGridClass = () => {
      switch(gridSize) {
          case 'sm': return 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]';
          case 'lg': return 'grid-cols-[repeat(auto-fill,minmax(450px,1fr))]';
          default: return 'grid-cols-[repeat(auto-fill,minmax(320px,1fr))]';
      }
  };

  const activeShot = inspectorShotId ? generatedShots.find(s => s.id === inspectorShotId) : null;
  const isApiConnected = true;

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden relative ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#121215] text-zinc-100'}`}>
      
      {/* Primary Header Bar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between shrink-0 shadow-sm z-20 gap-3 ${isLight ? 'bg-white border-slate-200' : 'bg-[#16161a] border-[#22222a]'}`}>
        
        <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0f0f13] border-[#262634]'
            }`}>
               <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>SCENE</span>
               <input type="number" className={`w-8 bg-transparent text-center text-xs font-bold outline-none ${isLight ? 'text-slate-900 focus:text-amber-600' : 'text-zinc-100 focus:text-[#f5a623]'}`} value={startScene} onChange={e => setStartScene(parseInt(e.target.value))} min={1} />
               <span className="text-zinc-500 font-bold text-xs">-</span>
               <input type="number" className={`w-8 bg-transparent text-center text-xs font-bold outline-none ${isLight ? 'text-slate-900 focus:text-amber-600' : 'text-zinc-100 focus:text-[#f5a623]'}`} value={endScene} onChange={e => setEndScene(parseInt(e.target.value))} min={1} />
            </div>

            <button 
                onClick={handlePlanShots} 
                disabled={analyzing || isQueueRunning || !aiAvailable} 
                className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    isLight 
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm' 
                        : 'bg-[#22222c] border-[#2d2d3a] hover:bg-amber-500 hover:text-slate-950 text-zinc-200'
                }`}
            >
              {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 
              Analyze Range
            </button>
            
            <button 
                onClick={() => addGeneratedShot(generatedShots.length)} 
                disabled={isQueueRunning} 
                className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    isLight 
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' 
                        : 'bg-[#22222c] hover:bg-[#2c2c38] border-[#2d2d3a] text-zinc-200'
                }`}
            >
                <Plus size={14} /> Add Shot
            </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border w-full ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#0f0f13] border-[#262634] text-zinc-100'
            }`}>
                <Search size={14} className={isLight ? 'text-slate-400' : 'text-zinc-500'} />
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search scenes, action, subject, camera size..."
                    className={`bg-transparent text-xs outline-none w-full ${isLight ? 'placeholder:text-slate-400 text-slate-800' : 'placeholder:text-zinc-600 text-zinc-100'}`}
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-200 cursor-pointer"><X size={12} /></button>
                )}
            </div>

            <select 
                value={filterScene}
                onChange={(e) => setFilterScene(e.target.value)}
                className={`text-xs px-2 py-1.5 rounded-lg border outline-none cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#181820] border-[#262634] text-zinc-200'
                }`}
            >
                <option value="all" className={isLight ? 'bg-white' : 'bg-[#181820]'}>All Scenes</option>
                {availableScenes.map(sc => <option key={sc} value={sc} className={isLight ? 'bg-white' : 'bg-[#181820]'}>Scene {sc}</option>)}
            </select>

            <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className={`text-xs px-2 py-1.5 rounded-lg border outline-none cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#181820] border-[#262634] text-zinc-200'
                }`}
            >
                <option value="all" className={isLight ? 'bg-white' : 'bg-[#181820]'}>All Status</option>
                <option value="rendered" className={isLight ? 'bg-white' : 'bg-[#181820]'}>Rendered</option>
                <option value="unrendered" className={isLight ? 'bg-white' : 'bg-[#181820]'}>Unrendered</option>
            </select>
        </div>

        {/* View mode & Queue controls */}
        <div className="flex items-center gap-3">
            <div className={`flex rounded-lg border p-0.5 ${
                isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f0f13] border-[#262634]'
            }`}>
               <button onClick={() => setViewType('table')} className={`p-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === 'table' ? (isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-[#282836] text-amber-400 shadow-sm') : 'text-zinc-500 hover:text-zinc-300'}`} title="List View"><List size={14} /></button>
               <button onClick={() => setViewType('grid')} className={`p-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === 'grid' ? (isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-[#282836] text-amber-400 shadow-sm') : 'text-zinc-500 hover:text-zinc-300'}`} title="Grid View"><LayoutGrid size={14} /></button>
            </div>

            {viewMode === 'grid' && (
                <div className={`flex rounded-lg border p-0.5 items-center ${
                    isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0f0f13] border-[#262634]'
                }`}>
                    <button onClick={() => setGridSize('sm')} className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#22222c] cursor-pointer ${gridSize === 'sm' ? 'text-amber-500 font-bold' : 'text-zinc-500'}`}><Grid3X3 size={14} /></button>
                    <button onClick={() => setGridSize('md')} className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#22222c] cursor-pointer ${gridSize === 'md' ? 'text-amber-500 font-bold' : 'text-zinc-500'}`}><LayoutGrid size={14} /></button>
                    <button onClick={() => setGridSize('lg')} className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#22222c] cursor-pointer ${gridSize === 'lg' ? 'text-amber-500 font-bold' : 'text-zinc-500'}`}><Maximize size={14} /></button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-[#282834] mx-1"></div>
                    <button onClick={() => setShowSceneBreaks(!showSceneBreaks)} className={`p-1.5 rounded flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer ${showSceneBreaks ? 'text-amber-500' : 'text-zinc-500'}`} title="Toggle Scene Breaks">
                        <Scissors size={14} /> Breaks
                    </button>
                </div>
            )}

            {!isQueueRunning ? (
                 <button 
                    onClick={handleRenderAll} 
                    disabled={generatedShots.length === 0 || !isApiConnected} 
                    className={`h-8 flex items-center gap-2 px-3.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                        isApiConnected 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-50' 
                        : 'bg-slate-200 dark:bg-[#1f1f28] text-zinc-500 cursor-not-allowed border border-slate-300 dark:border-[#2a2a36]'
                    }`}
                    title={isApiConnected ? "Render All Shots" : "API Key Required"}
                 >
                    <Play size={12} fill="currentColor" /> Render All
                 </button>
             ) : (
                 <button onClick={handleStopQueue} className="h-8 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all shadow-md animate-pulse cursor-pointer">
                    <Pause size={12} fill="white" /> Stop
                 </button>
             )}
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#121216] border-[#22222a] text-zinc-300'
      }`}>
          <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className={`font-bold uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Total Shots:</span>
                  <span className="font-black text-amber-500">{metrics.total}</span>
              </div>
              <div className={`w-px h-3 ${isLight ? 'bg-slate-300' : 'bg-[#282834]'}`}></div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span className={`font-bold uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Rendered:</span>
                  <span className="font-bold text-emerald-500">{metrics.rendered}</span>
              </div>
              <div className={`w-px h-3 ${isLight ? 'bg-slate-300' : 'bg-[#282834]'}`}></div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <AlertCircle size={13} className="text-amber-500" />
                  <span className={`font-bold uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Unrendered:</span>
                  <span className="font-bold text-amber-500">{metrics.unrendered}</span>
              </div>
              <div className={`w-px h-3 ${isLight ? 'bg-slate-300' : 'bg-[#282834]'}`}></div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Clock size={13} className="text-blue-400" />
                  <span className={`font-bold uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Est. Duration:</span>
                  <span className="font-bold text-blue-400">{metrics.timeStr}</span>
              </div>
          </div>

          <div className="flex items-center gap-2">
              <button 
                  onClick={() => handleExport('excel')} 
                  disabled={isExporting}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer border ${
                      isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#1c1c24] border-[#2a2a36] hover:bg-[#262634] text-zinc-200'
                  }`}
              >
                  <FileSpreadsheet size={12} className="text-emerald-500" /> Excel
              </button>
              <button 
                  onClick={handleCopyShotList}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer border ${
                      isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#1c1c24] border-[#2a2a36] hover:bg-[#262634] text-zinc-200'
                  }`}
              >
                  <Copy size={12} className="text-cyan-400" /> Copy List
              </button>
              <button 
                  onClick={handlePrintGallery}
                  className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              >
                  <Printer size={12} /> Print Lookbook
              </button>
          </div>
      </div>

      {/* Floating Bulk Action Toolbar (When 1+ items selected) */}
      {selectedIds.size > 0 && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 border-b flex items-center justify-between shrink-0 shadow-md animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                  <span className="font-black text-xs uppercase tracking-wider">{selectedIds.size} Shots Selected</span>
                  <div className="w-px h-4 bg-slate-900/30"></div>
                  <button onClick={handleSelectAll} className="text-xs font-bold underline cursor-pointer hover:opacity-80">
                      {selectedIds.size === filteredShots.length ? 'Deselect All' : 'Select All Filtered'}
                  </button>
              </div>

              <div className="flex items-center gap-2">
                  <select 
                      onChange={(e) => { handleBulkSetSize(e.target.value); e.target.value = ''; }}
                      className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-700 outline-none cursor-pointer"
                  >
                      <option value="">Set Shot Size...</option>
                      {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <button 
                      onClick={handleBulkRender}
                      className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                      <Sparkles size={13} className="text-amber-400" /> Render Selected
                  </button>

                  <button 
                      onClick={handleBulkDelete}
                      className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                      <Trash2 size={13} /> Delete Selected
                  </button>

                  <button onClick={handleClearSelection} className="p-1 hover:bg-slate-900/20 rounded cursor-pointer"><X size={16} /></button>
              </div>
          </div>
      )}

      {/* Project Metadata Customization Bar */}
      <div className={`border-b px-4 py-1.5 flex flex-wrap items-center justify-between text-xs gap-2 shrink-0 ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0e0e12] border-[#22222a] text-zinc-300'
      }`}>
          <div className="flex items-center gap-3 flex-wrap">
              <label className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                  <input 
                      type="checkbox" 
                      checked={includeProjectMetadata} 
                      onChange={(e) => setIncludeProjectMetadata(e.target.checked)}
                      className="rounded accent-amber-500 cursor-pointer"
                  />
                  Print/Copy Metadata:
              </label>

              {includeProjectMetadata && (
                  <div className="flex items-center gap-2 flex-wrap">
                      <div className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                          isLight ? 'bg-white border-slate-300' : 'bg-[#16161c] border-[#282834]'
                      }`}>
                          <span className={`text-[9px] font-mono uppercase ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Project:</span>
                          <input 
                              type="text" 
                              value={customProjectName} 
                              onChange={(e) => setCustomProjectName(e.target.value)}
                              placeholder={activeProjectName}
                              className={`bg-transparent text-[11px] font-bold outline-none w-28 focus:w-36 transition-all ${
                                  isLight ? 'text-slate-800 placeholder-slate-400' : 'text-zinc-100 placeholder:text-zinc-600'
                              }`}
                          />
                      </div>
                      <div className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                          isLight ? 'bg-white border-slate-300' : 'bg-[#16161c] border-[#282834]'
                      }`}>
                          <span className={`text-[9px] font-mono uppercase ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Production:</span>
                          <input 
                              type="text" 
                              value={productionCompany} 
                              onChange={(e) => setProductionCompany(e.target.value)}
                              placeholder="Apex Pictures"
                              className={`bg-transparent text-[11px] font-bold outline-none w-28 focus:w-36 transition-all ${
                                  isLight ? 'text-slate-800 placeholder-slate-400' : 'text-zinc-100 placeholder:text-zinc-600'
                              }`}
                          />
                      </div>
                      <div className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                          isLight ? 'bg-white border-slate-300' : 'bg-[#16161c] border-[#282834]'
                      }`}>
                          <span className={`text-[9px] font-mono uppercase ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Director:</span>
                          <input 
                              type="text" 
                              value={directorName} 
                              onChange={(e) => setDirectorName(e.target.value)}
                              placeholder="Director Name"
                              className={`bg-transparent text-[11px] font-bold outline-none w-24 focus:w-32 transition-all ${
                                  isLight ? 'text-slate-800 placeholder-slate-400' : 'text-zinc-100 placeholder:text-zinc-600'
                              }`}
                          />
                      </div>

                      <div className={`h-3 w-px mx-1 ${isLight ? 'bg-slate-300' : 'bg-[#282834]'}`}></div>

                      <label className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ml-1">
                          <input 
                              type="checkbox" 
                              checked={includeHodSignoff} 
                              onChange={(e) => setIncludeHodSignoff(e.target.checked)}
                              className="rounded accent-cyan-500 cursor-pointer"
                          />
                          HOD Sign-off:
                      </label>

                      {includeHodSignoff && (
                          <>
                              <div className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                                  isLight ? 'bg-white border-slate-300' : 'bg-[#16161c] border-[#282834]'
                              }`}>
                                  <span className={`text-[9px] font-mono uppercase ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>HOD:</span>
                                  <input 
                                      type="text" 
                                      value={hodName} 
                                      onChange={(e) => setHodName(e.target.value)}
                                      placeholder="DP / HOD"
                                      className={`bg-transparent text-[11px] font-bold outline-none w-24 focus:w-32 transition-all ${
                                          isLight ? 'text-slate-800 placeholder-slate-400' : 'text-zinc-100 placeholder:text-zinc-600'
                                      }`}
                                  />
                              </div>
                              <div className={`flex items-center gap-1 border px-2 py-0.5 rounded ${
                                  isLight ? 'bg-white border-slate-300' : 'bg-[#16161c] border-[#282834]'
                              }`}>
                                  <span className={`text-[9px] font-mono uppercase ${isLight ? 'text-gray-500' : 'text-zinc-400'}`}>Dept:</span>
                                  <input 
                                      type="text" 
                                      value={hodDept} 
                                      onChange={(e) => setHodDept(e.target.value)}
                                      placeholder="Camera / Art"
                                      className={`bg-transparent text-[11px] font-bold outline-none w-24 focus:w-32 transition-all ${
                                          isLight ? 'text-slate-800 placeholder-slate-400' : 'text-zinc-100 placeholder:text-zinc-600'
                                      }`}
                                  />
                              </div>
                          </>
                      )}
                  </div>
              )}
          </div>

          <div className={`text-[10px] font-mono hidden md:block ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
              Headers attached automatically when exporting, printing, or copying
          </div>
      </div>
      
      {isQueueRunning && (
          <div className={`border-b px-4 py-2 flex items-center gap-4 shrink-0 ${
              isLight ? 'bg-amber-50 border-amber-200' : 'bg-[#111] border-[#333]'
          }`}>
             <div className="text-[10px] font-bold text-amber-600 uppercase animate-pulse shrink-0">Processing Queue... {queueProgress.current} / {queueProgress.total}</div>
             <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-[#333]'}`}>
                 <div className="h-full bg-amber-500 transition-all duration-300 ease-out" style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }} />
             </div>
             <div className="text-[10px] text-gray-500 font-mono shrink-0">Next request in {delay}s</div>
          </div>
      )}

      <div className="flex-1 flex overflow-hidden">
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isLight ? 'bg-slate-100/70' : 'bg-[#121215]'}`}>
            {filteredShots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-10">
                <div className={`p-8 rounded-2xl border text-center max-w-md shadow-sm ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#181820] border-[#262634] text-zinc-200'
                }`}>
                    <Film size={56} className={`mx-auto mb-4 ${isLight ? 'text-amber-500/80' : 'text-amber-400/80'}`} />
                    <h3 className={`text-lg font-extrabold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {generatedShots.length === 0 ? "Storyboard Empty" : "No Matching Shots Found"}
                    </h3>
                    <p className={`text-xs leading-relaxed mb-4 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                        {generatedShots.length === 0 
                            ? "Select a scene range above and click 'Analyze Range' to generate shots using AI, or click 'Add Shot' to start manually."
                            : "Try adjusting your search query or scene filters to display shots."
                        }
                    </p>
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setFilterScene('all'); setFilterStatus('all'); }} className="mt-2 mx-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-md text-xs flex items-center gap-1.5 cursor-pointer shadow-xs">
                            <RotateCcw size={12} /> Clear Filters
                        </button>
                    )}
                </div>
            </div>
            ) : (
            <>
                {viewMode === 'grid' && (
                    <div className={`grid gap-6 p-6 pb-20 ${getGridClass()}`}>
                        {filteredShots.map((shot, i) => {
                            const prevShot = filteredShots[i - 1];
                            const isNewScene = !prevShot || String(prevShot.scene) !== String(shot.scene);
                            const shouldShowDivider = showSceneBreaks && isNewScene;

                            return (
                                <React.Fragment key={shot.id}>
                                    {shouldShowDivider && (
                                        <SceneDivider scene={String(shot.scene || '?')} onBundle={() => handleBundleScene(String(shot.scene))} onToBoard={() => handleSceneToBoard(String(shot.scene || '?'))} isLight={isLight} />
                                    )}
                                    <StoryCard
                                        key={shot.id}
                                        index={i}
                                        total={filteredShots.length}
                                        shot={shot}
                                        onUpdate={updateGeneratedShot}
                                        onAddNext={addGeneratedShot}
                                        onDelete={removeGeneratedShot}
                                        onMove={moveGeneratedShot}
                                        onRender={renderSingleShot}
                                        onDownload={downloadCard}
                                        onOpenInspector={setInspectorShotId}
                                        onToBoard={handleAddToBoard}
                                        isRendering={currentlyRenderingId === shot.id}
                                        isSelected={selectedIds.has(shot.id)}
                                        onToggleSelect={handleToggleSelect}
                                        isLight={isLight}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {viewMode === 'table' && (
                    <div className="min-w-[1000px] p-0 pb-20">
                        <table className="w-full text-left border-collapse">
                            <thead className={`text-[10px] font-bold uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b ${
                                isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-[#1a1a1a] text-gray-400 border-[#333]'
                            }`}>
                                <tr>
                                    <th className={`p-3 border-r w-12 text-center ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>
                                        <button 
                                            onClick={handleSelectAll}
                                            className="cursor-pointer text-slate-500 hover:text-amber-500"
                                            title="Select all"
                                        >
                                            {selectedIds.size > 0 && selectedIds.size === filteredShots.length ? <CheckSquare size={14} className="text-amber-500" /> : <Square size={14} />}
                                        </button>
                                    </th>
                                    <th className={`p-3 border-r w-14 text-center ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>#</th>
                                    <th className={`p-3 border-r w-36 text-center ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Visual</th>
                                    <th className={`p-3 border-r w-20 text-center ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Scene</th>
                                    <th className={`p-3 border-r w-36 ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Shot Size</th>
                                    <th className={`p-3 border-r w-36 ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Angle</th>
                                    <th className={`p-3 border-r w-36 ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Lens / Movement</th>
                                    <th className={`p-3 border-r w-44 ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Subject</th>
                                    <th className={`p-3 border-r ${isLight ? 'border-slate-300' : 'border-[#222]'}`}>Description & Script Ref</th>
                                    <th className="p-3 w-20 text-center">Tools</th>
                                </tr>
                            </thead>
                            <tbody className={isLight ? 'bg-white' : 'bg-[#111]'}>
                                {filteredShots.map((shot, i) => (
                                    <ShotRow
                                        key={shot.id}
                                        index={i}
                                        total={filteredShots.length}
                                        shot={shot}
                                        onUpdate={updateGeneratedShot}
                                        onDelete={removeGeneratedShot}
                                        onAddNext={addGeneratedShot}
                                        onMove={moveGeneratedShot}
                                        onRender={renderSingleShot}
                                        isRendering={currentlyRenderingId === shot.id}
                                        isSelected={selectedIds.has(shot.id)}
                                        onToggleSelect={handleToggleSelect}
                                        isLight={isLight}
                                        aiAvailable={aiAvailable}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
            )}
          </div>

          {activeShot && (
              <AdvancedShotInspector 
                  shot={activeShot} 
                  onClose={() => setInspectorShotId(null)} 
                  onUpdate={updateGeneratedShot}
                  characterData={characterData}
                  isLight={isLight}
              />
          )}

      </div>
    </div>
  );
};

export default StoryboardView;
