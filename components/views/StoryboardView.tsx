
import React, { useState, useEffect, useRef, memo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { generateShotList, generateImage } from '../../services/gemini';
import { 
    Wand2, Image as ImageIcon, Film, Loader2, Download, 
    Plus, Trash2, RefreshCw, Play, Pause, Clock, 
    Grid3X3, LayoutGrid, Maximize, Columns, List, Table2,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, UserCheck, ChevronLeft, ChevronRight,
    Settings2, Aperture, Paintbrush, Users, Lightbulb, X, ChevronsRight,
    Scissors, Send, Layers, Check, Hash, FileSpreadsheet
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

const AdvancedShotInspector = ({ shot, onClose, onUpdate, characterData }: { 
    shot: Shot, 
    onClose: () => void, 
    onUpdate: (id: string, updates: Partial<Shot>) => void,
    characterData: Record<string, CharacterData>
}) => {
    const [openSection, setOpenSection] = useState<'comp' | 'light' | 'art' | 'block'>('comp');

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
            className={`w-full flex items-center justify-between p-3 border-b border-[#333] transition-colors ${openSection === id ? 'bg-[#222] text-[#f5a623]' : 'bg-[#111] text-gray-400 hover:text-white'}`}
        >
            <div className="flex items-center gap-3">
                <Icon size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <ChevronRight size={14} className={`transition-transform ${openSection === id ? 'rotate-90' : ''}`} />
        </button>
    );

    const SelectField = ({ label, value, options, onChange }: any) => (
        <div className="mb-3">
            <label className="text-[9px] font-mono font-bold text-[#555] uppercase block mb-1">{label}</label>
            <select 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none"
            >
                <option value="">-- Default --</option>
                {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    const InputField = ({ label, value, onChange, placeholder }: any) => (
        <div className="mb-3">
            <label className="text-[9px] font-mono font-bold text-[#555] uppercase block mb-1">{label}</label>
            <BufferedInput 
                value={value} 
                onChange={onChange}
                placeholder={placeholder}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none placeholder-gray-700"
            />
        </div>
    );

    return (
        <div className="w-[320px] bg-[#161616] border-l border-[#333] h-full flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl">
            <div className="h-14 border-b border-[#333] flex items-center justify-between px-4 bg-[#111]">
                <div className="flex items-center gap-2">
                    <Settings2 size={16} className="text-[#f5a623]" />
                    <span className="text-xs font-black uppercase tracking-widest text-white">Shot Tuner</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-[#333] rounded text-gray-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <AccordionHeader id="comp" label="Composition" icon={Aperture} />
                {openSection === 'comp' && (
                    <div className="p-4 bg-[#1a1a1a]">
                        <SelectField label="Shot Size" value={shot.shotSize} options={SHOT_SIZES} onChange={(v: string) => onUpdate(shot.id, { shotSize: v })} />
                        <SelectField label="Angle" value={shot.angle} options={SHOT_ANGLES} onChange={(v: string) => onUpdate(shot.id, { angle: v })} />
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
                    <div className="p-4 bg-[#1a1a1a]">
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
                    <div className="p-4 bg-[#1a1a1a]">
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
                    <div className="p-4 bg-[#1a1a1a]">
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

const SceneDivider = ({ scene, onBundle, onToBoard }: { scene: string, onBundle: () => void, onToBoard: () => Promise<boolean> }) => {
    const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle');
    const handleSend = async () => {
        if (sendState !== 'idle') return;
        setSendState('sending');
        const success = await onToBoard();
        if (success) { setSendState('sent'); setTimeout(() => setSendState('idle'), 2000); } else { setSendState('idle'); }
    };
    return (
        <div className="col-span-full py-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#333]"></div>
            <div className="flex items-center gap-3 bg-[#222] px-4 py-1.5 rounded-full border border-[#333]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">SCENE {scene}</span>
                <div className="w-px h-3 bg-[#444]"></div>
                <button onClick={onBundle} className="text-[#f5a623] hover:text-white transition-colors" title="Bundle Scene Images"><Layers size={14} /></button>
                <button onClick={handleSend} className={`${sendState === 'sent' ? 'text-green-500' : 'text-[#3b82f6] hover:text-white'} transition-colors w-4 h-4 flex items-center justify-center`} title="Send to Board">
                    {sendState === 'sending' ? <Loader2 size={14} className="animate-spin" /> : sendState === 'sent' ? <Check size={14} /> : <Send size={14} />}
                </button>
            </div>
            <div className="h-px flex-1 bg-[#333]"></div>
        </div>
    );
};

const isValidImage = (url: string | null | undefined): boolean => {
    return !!url && (url.startsWith('data:image') || url.startsWith('http') || url.startsWith('blob:'));
};

const StoryCard = memo(({ shot, index, total, onUpdate, onAddNext, onDelete, onMove, onRender, onDownload, onOpenInspector, onToBoard, isRendering }: any) => {
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
        <div id={`story-card-${index}`} className="bg-[#252525] border border-[#333] rounded-lg overflow-hidden flex flex-col shadow-lg group hover:border-[#444] transition-colors relative">
            <div className="bg-[#222] px-2 py-1 flex justify-between items-center border-b border-[#333]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#666] uppercase">Shot {index + 1}</span>
                    <div className="flex bg-[#1a1a1a] rounded ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowLeft size={10} /></button>
                        <button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowRight size={10} /></button>
                    </div>
                </div>
                <div className="flex gap-1">
                     <button onClick={() => onOpenInspector(shot.id)} className="p-1 hover:bg-[#333] text-gray-400 hover:text-[#f5a623] rounded flex items-center gap-1"><Settings2 size={12} /></button>
                     <div className="w-px h-3 bg-[#333] mx-1"></div>
                     <button onClick={() => onAddNext(index)} className="p-1 hover:bg-[#333] text-gray-400 hover:text-green-500 rounded"><Plus size={12} /></button>
                     <button 
                        onClick={() => { if(confirmDelete) onDelete(shot.id); else setConfirmDelete(true); }} 
                        className={`p-1 hover:bg-[#333] rounded transition-colors ${confirmDelete ? 'text-red-500 bg-red-900/20' : 'text-gray-400 hover:text-red-500'}`}
                        title={confirmDelete ? "Click again to delete" : "Delete Shot"}
                     >
                        <Trash2 size={12} className={confirmDelete ? "animate-pulse" : ""} />
                     </button>
                </div>
            </div>
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden border-b border-[#333] group-inner">
                {isValidImage(displayImage) ? (<img src={displayImage} alt="Shot" className="w-full h-full object-cover" />) : (<div className="text-[#333] flex flex-col items-center gap-2"><Film size={32} /></div>)}
                {isRendering && (<div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-accent z-10"><Loader2 className="animate-spin mb-2" size={24} /><span className="text-[10px] font-bold uppercase tracking-widest">Rendering...</span></div>)}
                {!isRendering && hasHistory && (<div className="absolute inset-0 flex justify-between items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><button onClick={handlePrevHistory} className="bg-black/50 hover:bg-black/80 text-white p-1 rounded-full pointer-events-auto transition-colors"><ChevronLeft size={16} /></button><button onClick={handleNextHistory} className="bg-black/50 hover:bg-black/80 text-white p-1 rounded-full pointer-events-auto transition-colors"><ChevronRight size={16} /></button></div>)}
                {historyIndex !== -1 && (<div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/20">V.{historyIndex + 1}</div>)}
            </div>
            <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#555] uppercase shrink-0">SCENE</span>
                    <BufferedInput 
                        className="bg-transparent text-[10px] font-bold text-[#888] w-full outline-none border-b border-transparent focus:border-[#f5a623] transition-colors" 
                        value={shot.scene || ''} 
                        onChange={(val: string) => onUpdate(shot.id, { scene: val })} 
                        placeholder="?" 
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Size</label>
                        <select className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none" value={shot.shotSize} onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}>
                            {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            {!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (<option value={shot.shotSize}>{shot.shotSize} (Custom)</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Angle</label>
                         <select className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none" value={shot.angle} onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}>
                            {SHOT_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                            {!SHOT_ANGLES.includes(shot.angle) && shot.angle && (<option value={shot.angle}>{shot.angle} (Custom)</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Subject</label>
                    <BufferedInput 
                        className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none" 
                        value={shot.subject} 
                        onChange={(val: string) => onUpdate(shot.id, { subject: val })} 
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Visual Action</label>
                    <BufferedTextArea 
                        className="w-full h-16 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none resize-none leading-relaxed" 
                        value={shot.description} 
                        onChange={(val: string) => onUpdate(shot.id, { description: val })} 
                    />
                </div>
            </div>
            <div className="p-2 border-t border-[#333] bg-[#222] flex gap-2">
                <button onClick={() => onRender(index)} disabled={isRendering} className="flex-1 bg-[#333] border border-[#444] text-[#ccc] py-1.5 rounded text-[10px] font-bold uppercase hover:bg-[#444] hover:text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"><ImageIcon size={12} /> {shot.imageUrl ? 'Re-Draw' : 'Draw'}</button>
                <button onClick={() => onDownload(index, displayImage)} className="w-8 bg-[#1a3c28] border border-[#2e7d32] text-[#81c784] rounded flex items-center justify-center hover:bg-[#2e7d32] hover:text-white transition-colors"><Download size={12} /></button>
                <button onClick={handleSend} disabled={sendState !== 'idle'} className={`w-8 border rounded flex items-center justify-center transition-all duration-300 ${sendState === 'sent' ? 'bg-green-900/30 border-green-600 text-green-500' : 'bg-[#1e3a8a] border-[#1e40af] text-[#60a5fa] hover:bg-[#1e40af] hover:text-white'}`}>{sendState === 'sending' ? <Loader2 size={12} className="animate-spin" /> : sendState === 'sent' ? <Check size={12} /> : <Send size={12} />}</button>
            </div>
        </div>
    );
}, (prev, next) => prev.shot === next.shot && prev.index === next.index && prev.isRendering === next.isRendering && prev.total === next.total);

const ShotRow = memo(({ shot, index, total, onUpdate, onAddNext, onDelete, onMove, onRender, isRendering }: any) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    useEffect(() => {
        if (confirmDelete) {
            const timer = setTimeout(() => setConfirmDelete(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [confirmDelete]);

    return (
        <tr className="border-b border-[#2a2a2a] hover:bg-[#222] transition-colors group">
            <td className="p-2 text-center text-xs text-gray-500 font-mono w-14 border-r border-[#2a2a2a]"><div className="flex flex-col items-center gap-1"><span>{index + 1}</span><div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="hover:text-[#f5a623] disabled:opacity-30"><ArrowUp size={10} /></button><button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="hover:text-[#f5a623] disabled:opacity-30"><ArrowDown size={10} /></button></div></div></td>
            <td className="p-2 w-32 border-r border-[#2a2a2a]"><div className="w-28 h-16 bg-black rounded border border-[#333] overflow-hidden relative flex items-center justify-center cursor-pointer hover:border-[#f5a623] group/thumb" onClick={() => onRender(index)}>{isValidImage(shot.imageUrl) ? (<img src={shot.imageUrl} className="w-full h-full object-cover" />) : (<Film size={16} className="text-[#333]" />)}{isRendering ? (<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-[#f5a623]" /></div>) : (<div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity"><Wand2 size={16} className="text-white" /></div>)}</div></td>
            <td className="p-2 w-20 border-r border-[#2a2a2a]"><BufferedInput className="w-full bg-transparent text-xs text-center border-b border-transparent focus:border-[#f5a623] outline-none text-gray-300 placeholder-gray-600" value={shot.scene || ''} onChange={(val: string) => onUpdate(shot.id, { scene: val })} placeholder="SC#" /></td>
            <td className="p-2 w-40 border-r border-[#2a2a2a]"><select className="w-full bg-transparent text-xs text-gray-300 outline-none border border-transparent hover:border-[#333] focus:border-[#f5a623] rounded py-1" value={shot.shotSize} onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}>{SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}{!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (<option value={shot.shotSize}>{shot.shotSize}</option>)}</select></td>
            <td className="p-2 w-40 border-r border-[#2a2a2a]"><select className="w-full bg-transparent text-xs text-gray-300 outline-none border border-transparent hover:border-[#333] focus:border-[#f5a623] rounded py-1" value={shot.angle} onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}>{SHOT_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}{!SHOT_ANGLES.includes(shot.angle) && shot.angle && (<option value={shot.angle}>{shot.angle}</option>)}</select></td>
            <td className="p-2 w-48 border-r border-[#2a2a2a]"><BufferedInput className="w-full bg-transparent text-xs text-gray-300 outline-none border-b border-transparent focus:border-[#f5a623] py-1" value={shot.subject} onChange={(val: string) => onUpdate(shot.id, { subject: val })} placeholder="Subject..." /></td>
            <td className="p-2 border-r border-[#2a2a2a]"><BufferedTextArea className="w-full bg-transparent text-xs text-gray-300 resize-none outline-none focus:bg-[#222] rounded p-1 h-14 leading-relaxed" value={shot.description} onChange={(val: string) => onUpdate(shot.id, { description: val })} placeholder="Describe the action..." /></td>
            <td className="p-2 text-center w-20">
                <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onAddNext(index)} className="p-1.5 text-gray-500 hover:text-green-500 hover:bg-[#333] rounded transition-colors"><Plus size={14} /></button>
                    <button 
                        onClick={() => { if(confirmDelete) onDelete(shot.id); else setConfirmDelete(true); }}
                        className={`p-1.5 rounded transition-colors ${confirmDelete ? 'text-red-500 bg-red-900/20' : 'text-gray-500 hover:text-red-500 hover:bg-[#333]'}`}
                        title={confirmDelete ? "Click again" : "Delete"}
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
      geminiApiKey, stabilityApiKey
  } = useProject();
  
  // Range Analysis State
  const [startScene, setStartScene] = useState(1);
  const [endScene, setEndScene] = useState(beats.length || 1);
  const [analyzing, setAnalyzing] = useState(false);

  // Render Queue State
  const [delay, setDelay] = useState(5); // Seconds
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [currentlyRenderingId, setCurrentlyRenderingId] = useState<string | null>(null);
  
  // Inspector State
  const [inspectorShotId, setInspectorShotId] = useState<string | null>(null);
  
  // View Customization
  const [viewMode, setViewType] = useState<'grid' | 'table'>('table');
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showSceneBreaks, setShowSceneBreaks] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Ref for cancellation
  const cancelQueueRef = useRef(false);

  // Helper: Get Script Text
  const getScriptSegment = () => {
    const sorted = [...beats].sort((a, b) => a.x - b.x);
    // Be robust about scene numbers
    const validStart = Math.max(1, Math.min(startScene, sorted.length));
    const validEnd = Math.min(sorted.length, Math.max(validStart, endScene));
    
    return sorted.slice(validStart - 1, validEnd)
      .map((b, i) => `SCENE ${validStart + i}: ${b.slug.prefix} ${b.slug.location} - ${b.slug.time}\n${b.content.replace(/<[^>]+>/g, '')}`)
      .join('\n\n');
  };

  // --- 1. ANALYSIS (TEXT -> SHOTS) ---
  const handlePlanShots = async () => {
    if (!geminiApiKey) { alert("Analysis requires Gemini API Key. Please set it in Backstage settings."); return; }
    setAnalyzing(true);
    try {
      const text = getScriptSegment();
      if (!text.trim()) { alert("No scenes found in that range."); return; }
      
      const shots = await generateShotList(text, storyboardConfig.textModel || 'gemini-3-flash-preview', geminiApiKey);
      // Map to internal format with unique IDs
      const mappedShots: Shot[] = shots.map((s, i) => ({
          id: `${Date.now()}-${i}`,
          shotSize: s.shotSize || 'WIDE',
          angle: s.angle || 'EYE LEVEL',
          description: s.description || '',
          subject: s.subject || '',
          scene: s.scene || '?',
          imageUrl: null,
          imageHistory: []
      }));
      
      setGeneratedShots(mappedShots);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please check your API key and connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- EXPORT FUNCTION ---
  const handleExport = async (format: 'csv' | 'excel') => {
      setIsExporting(true);
      try {
          if (generatedShots.length === 0) {
              alert("No shots to export.");
              return;
          }

          const exportData = generatedShots.map((shot, i) => ({
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
    if (storyboardConfig.provider === 'stability' && !stabilityApiKey) {
        alert("Please set Stability API Key in Backstage settings.");
        return;
    }
    if (storyboardConfig.provider !== 'stability' && !geminiApiKey) {
        alert("Please set Gemini API Key in Backstage settings.");
        return;
    }

    const shot = generatedShots[index];
    if (!shot) return;
    
    setCurrentlyRenderingId(shot.id);
    try {
      const prompt = buildEnhancedPrompt(shot);
      
      const url = await generateImage({
          prompt, 
          aspectRatio: storyboardConfig.aspectRatio || '16:9',
          model: storyboardConfig.imageModel || 'gemini-2.5-flash-image',
          apiKey: geminiApiKey,
          provider: storyboardConfig.provider,
          stabilityApiKey: stabilityApiKey
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
    if (storyboardConfig.provider === 'stability' && !stabilityApiKey) { alert("Please set Stability API Key."); return; }
    if (storyboardConfig.provider !== 'stability' && !geminiApiKey) { alert("Please set Gemini API Key."); return; }

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
                 model: storyboardConfig.imageModel || 'gemini-2.5-flash-image',
                 apiKey: geminiApiKey,
                 provider: storyboardConfig.provider,
                 stabilityApiKey: stabilityApiKey
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
  const isApiConnected = !!(geminiApiKey || stabilityApiKey);

  return (
    <div className="w-full h-full bg-[#181818] flex flex-col overflow-hidden relative">
      
      <div className="bg-[#111] h-14 border-b border-[#222] px-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-4">
        
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-md px-2 py-1">
               <span className="text-[10px] font-bold text-[#666] uppercase mr-1">SCENE</span>
               <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={startScene} onChange={e => setStartScene(parseInt(e.target.value))} min={1} />
               <span className="text-gray-600 font-bold text-xs">-</span>
               <input type="number" className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" value={endScene} onChange={e => setEndScene(parseInt(e.target.value))} min={1} />
            </div>

            <div className="h-8 flex items-center justify-center px-3 bg-[#1a1a1a] border border-[#333] rounded-md">
                <span className="text-[10px] font-bold text-gray-400"><Hash size={10} className="inline mr-1 text-gray-600" />{generatedShots.length} SHOTS</span>
            </div>

            <button 
                onClick={handlePlanShots} 
                disabled={analyzing || isQueueRunning || !geminiApiKey} 
                className={`flex items-center gap-2 border border-[#333] px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all group ${
                    geminiApiKey 
                    ? 'bg-[#222] hover:bg-[#f5a623] hover:text-black text-gray-300' 
                    : 'bg-[#151515] text-gray-600 cursor-not-allowed opacity-50'
                }`}
                title={geminiApiKey ? "Analyze Script Segment" : "Gemini API Key Required"}
            >
              {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className={geminiApiKey ? "text-[#f5a623] group-hover:text-black" : "text-gray-600"} />} 
              Analyze
            </button>
            
            <button onClick={() => addGeneratedShot(generatedShots.length)} disabled={isQueueRunning} className="flex items-center gap-2 bg-[#222] hover:bg-[#333] border border-[#333] text-gray-300 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all disabled:opacity-50">
                <Plus size={14} /> Add Shot
            </button>
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
               <button onClick={() => setViewType('table')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewMode === 'table' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} title="List View"><List size={14} /></button>
               <button onClick={() => setViewType('grid')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewMode === 'grid' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} title="Grid View"><LayoutGrid size={14} /></button>
            </div>

            {viewMode === 'grid' && (
                <div className="flex bg-[#000] rounded-md p-1 border border-[#333] gap-1 animate-in fade-in items-center">
                    <button onClick={() => setGridSize('sm')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'sm' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><Grid3X3 size={14} /></button>
                    <button onClick={() => setGridSize('md')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'md' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><LayoutGrid size={14} /></button>
                    <button onClick={() => setGridSize('lg')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'lg' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><Maximize size={14} /></button>
                    <div className="w-px h-4 bg-[#333] mx-1"></div>
                    <button onClick={() => setShowSceneBreaks(!showSceneBreaks)} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase ${showSceneBreaks ? 'text-[#f5a623]' : 'text-gray-500 hover:text-white'}`} title="Toggle Scene Breaks">
                        <Scissors size={14} /> Breaks
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-3 justify-end">
             <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-md px-2 py-1 max-w-[150px]">
                 <ImageIcon size={12} className="text-[#666]" />
                 <select value={storyboardConfig.style || ''} onChange={(e) => setStoryboardConfig({...storyboardConfig, style: e.target.value})} disabled={isQueueRunning} className="bg-transparent text-white text-[10px] font-bold outline-none focus:text-[#f5a623] cursor-pointer w-full truncate">
                     <option value="" disabled>Style...</option>
                     {VISUAL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
             </div>

             <div className="flex items-center gap-2 bg-[#000] px-2 py-1 rounded-md border border-[#333]">
                 <Clock size={12} className="text-[#666]" />
                 <select value={delay} onChange={(e) => setDelay(parseInt(e.target.value))} disabled={isQueueRunning} className="bg-transparent text-white text-[10px] font-bold outline-none focus:text-[#f5a623] cursor-pointer">
                     <option value={2}>2s DELAY</option>
                     <option value={5}>5s DELAY</option>
                     <option value={10}>10s DELAY</option>
                     <option value={20}>20s DELAY</option>
                 </select>
             </div>

             {!isQueueRunning ? (
                 <button 
                    onClick={handleRenderAll} 
                    disabled={generatedShots.length === 0 || !isApiConnected} 
                    className={`h-8 flex items-center gap-2 px-4 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${
                        isApiConnected 
                        ? 'bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-50 disabled:grayscale' 
                        : 'bg-[#222] text-gray-600 cursor-not-allowed border border-[#333]'
                    }`}
                    title={isApiConnected ? "Render All Shots" : "API Key Required"}
                 >
                    <Play size={12} fill={isApiConnected ? "black" : "#666"} /> Render All
                 </button>
             ) : (
                 <button onClick={handleStopQueue} className="h-8 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 rounded-md text-[10px] font-black uppercase tracking-wide transition-all shadow-lg animate-pulse">
                    <Pause size={12} fill="white" /> Stop
                 </button>
             )}
        </div>
      </div>
      
      {isQueueRunning && (
          <div className="bg-[#111] border-b border-[#333] px-4 py-2 flex items-center gap-4 shrink-0">
             <div className="text-[10px] font-bold text-[#f5a623] uppercase animate-pulse shrink-0">Processing Queue... {queueProgress.current} / {queueProgress.total}</div>
             <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden"><div className="h-full bg-[#f5a623] transition-all duration-300 ease-out" style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }} /></div>
             <div className="text-[10px] text-gray-500 font-mono shrink-0">Next request in {delay}s</div>
          </div>
      )}

      <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-[#181818] custom-scrollbar">
            {generatedShots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#333] m-10">
                <Film size={64} className="mb-6 opacity-30" />
                <h3 className="text-xl font-bold text-gray-500 mb-2">Storyboard Empty</h3>
                <p className="text-sm text-gray-600 max-w-md text-center">
                    Select a scene range above and click "Analyze" to generate shots using AI, or click "Add Shot" to start manually.
                    <br/><br/>
                    <span className="text-[#f5a623]">Tip:</span> Configure Visual Style & Aspect Ratio in <b>Backstage &gt; Storyboard Config</b>.
                </p>
            </div>
            ) : (
            <>
                {viewMode === 'grid' && (
                    <div className={`grid gap-6 p-6 pb-20 ${getGridClass()}`}>
                        {generatedShots.map((shot, i) => {
                            const prevShot = generatedShots[i - 1];
                            const isNewScene = !prevShot || String(prevShot.scene) !== String(shot.scene);
                            const shouldShowDivider = showSceneBreaks && isNewScene;

                            return (
                                <React.Fragment key={shot.id}>
                                    {shouldShowDivider && (
                                        <SceneDivider scene={String(shot.scene || '?')} onBundle={() => handleBundleScene(String(shot.scene))} onToBoard={() => handleSceneToBoard(String(shot.scene || '?'))} />
                                    )}
                                    <StoryCard
                                        key={shot.id}
                                        index={i}
                                        total={generatedShots.length}
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
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {viewMode === 'table' && (
                    <div className="min-w-[1000px] p-0 pb-20">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#1a1a1a] text-[10px] font-bold text-gray-500 uppercase tracking-widest sticky top-0 z-10 shadow-lg border-b border-[#333]">
                                <tr>
                                    <th className="p-3 border-r border-[#222] w-14 text-center">#</th>
                                    <th className="p-3 border-r border-[#222] w-36 text-center">Visual</th>
                                    <th className="p-3 border-r border-[#222] w-24 text-center">Scene</th>
                                    <th className="p-3 border-r border-[#222] w-40">Shot Size</th>
                                    <th className="p-3 border-r border-[#222] w-40">Angle</th>
                                    <th className="p-3 border-r border-[#222] w-48">Subject</th>
                                    <th className="p-3 border-r border-[#222]">Description</th>
                                    <th className="p-3 w-20 text-center">Tools</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[#111]">
                                {generatedShots.map((shot, i) => (
                                    <ShotRow
                                        key={shot.id}
                                        index={i}
                                        total={generatedShots.length}
                                        shot={shot}
                                        onUpdate={updateGeneratedShot}
                                        onDelete={removeGeneratedShot}
                                        onAddNext={addGeneratedShot}
                                        onMove={moveGeneratedShot}
                                        onRender={renderSingleShot}
                                        isRendering={currentlyRenderingId === shot.id}
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
              />
          )}

      </div>
    </div>
  );
};

export default StoryboardView;
