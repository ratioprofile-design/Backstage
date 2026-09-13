import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CallSheet, CastCallItem, ExtrasCallItem } from '../../types';
import {
  Printer,
  Edit3,
  Check,
  Plus,
  Trash2,
  Sparkles,
  MapPin,
  Sun,
  Shield,
  Clock,
  Coffee,
  AlertTriangle,
  Camera,
  Flame,
  Utensils,
  Calendar,
  Layers,
  ClipboardList
} from 'lucide-react';

const DEFAULT_CALL_SHEET: CallSheet = {
  id: 'cs-default',
  productionTitle: 'BACKSTAGE PRODUCTION',
  shootDay: 1,
  totalShootDays: 25,
  date: new Date().toISOString().slice(0, 10),
  callTime: '06:00',
  breakfastTime: '06:30',
  estimatedWrap: '19:00',
  director: 'Director Name',
  producer: 'Producer Name',
  firstAd: '1st AD Name',
  cinematographer: 'DOP Name',
  productionDesigner: 'Art Director',
  stuntCoordinator: 'Stunt Master',
  soundMixer: 'Sound Recordist',
  generalCrewCall: '06:00 AM',
  weather: 'Clear, 28°C / 82°F, Low wind',
  sunriseSunset: 'Sunrise: 06:02 AM • Sunset: 18:24 PM',
  hospitalName: 'Apollo City Hospital (Emergency Trauma Center)',
  hospitalAddress: '100 Medical Enclave, Central Avenue',
  hospitalEmergencyPhone: '+91 44 2829 0200 / Emergency 108',
  locationName: 'Heritage Temple Complex (East Entrance)',
  locationAddress: 'East Veli Street, Old Town',
  parkingInstructions: 'Basecamp & vanity vans parked at Municipal Ground B; Crew shuttle runs every 10 mins.',
  scheduledScenes: ['1', '2', '3'],
  castCalls: [
    {
      id: 'cc-1',
      castNumber: 1,
      characterName: 'Lead Character',
      actorName: 'Actor Lead',
      status: 'SW',
      pickupTime: '05:30',
      makeupTime: '06:00',
      onSetTime: '07:00',
      notes: 'Costume #1 (Distressed Kurta), prosthetic scar touch-up.',
    },
    {
      id: 'cc-2',
      castNumber: 2,
      characterName: 'Antagonist',
      actorName: 'Actor Villain',
      status: 'W',
      pickupTime: '06:15',
      makeupTime: '06:45',
      onSetTime: '07:30',
      notes: 'Costume #2 (Dark Safari suit).',
    },
  ],
  extrasCalls: [
    {
      id: 'ec-1',
      groupName: 'Temple Crowd & Devotees',
      count: 35,
      callTime: '06:30',
      wardrobeNotes: 'Traditional South Indian attire; no bright neon colors.',
    },
  ],
  stuntSfxNotes: 'Scene 2 includes prop machetes. Stunt coordinator must inspect weapons prior to camera roll.',
  cameraNotes: 'A-Camera: Alexa 35 with 40mm Cooke Anamorphic. B-Camera: 75mm on Ronin 2.',
  cateringNotes: 'Hot South Indian breakfast at 06:30; High-protein lunch at 13:00; Evening tea & snacks at 16:30.',
  tomorrowPreview: 'Shoot Day 2: Market Chase & Alleyway shootout (Scenes 4, 5). Night call at 17:00.',
  advancedScheduleNotes: 'Quiet on set at all times around temple sanctum. Generator must be baffled behind acoustic barriers.',
};

export const CallSheetView: React.FC = () => {
  const { beats = [], characters = [], appTheme, appAccentColor = '#f5a623' } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [isEditing, setIsEditing] = useState(false);
  const [sheetData, setSheetData] = useState<CallSheet>(() => {
    try {
      const saved = localStorage.getItem('backstage_active_callsheet');
      return saved ? JSON.parse(saved) : DEFAULT_CALL_SHEET;
    } catch {
      return DEFAULT_CALL_SHEET;
    }
  });

  const handleSave = () => {
    setIsEditing(false);
    localStorage.setItem('backstage_active_callsheet', JSON.stringify(sheetData));
  };

  // Auto-Fill from project's beats (scenes) and characters
  const handleAutoFillFromScenes = () => {
    const activeScenes = beats.slice(0, 4);
    const sceneNumbers = activeScenes.map((b, idx) => String(b.sceneNumber || idx + 1));

    // Extract cast from selected beats
    const charMap = new Map<string, { character: string; actor?: string }>();
    activeScenes.forEach((b) => {
      const castItems = b.breakdownData?.cast || [];
      castItems.forEach((c: any) => {
        const name = typeof c === 'string' ? c : c?.name;
        if (name && !charMap.has(name.toLowerCase())) {
          const matchedChar = characters.find((ch) => ch.name.toLowerCase() === name.toLowerCase());
          charMap.set(name.toLowerCase(), {
            character: name,
            actor: matchedChar?.actor || 'TBD',
          });
        }
      });
    });

    const newCastCalls: CastCallItem[] = Array.from(charMap.values()).map((meta, idx) => ({
      id: `cc-auto-${idx + 1}`,
      castNumber: idx + 1,
      characterName: meta.character,
      actorName: meta.actor || 'Cast Lead',
      status: idx === 0 ? 'SW' : 'W',
      pickupTime: idx === 0 ? '05:30' : '06:00',
      makeupTime: idx === 0 ? '06:00' : '06:30',
      onSetTime: idx === 0 ? '07:00' : '07:15',
      notes: idx === 0 ? 'Hero costume & makeup' : 'Standard costume & makeup',
    }));

    const primaryBeat = activeScenes[0];
    const updated: CallSheet = {
      ...sheetData,
      scheduledScenes: sceneNumbers,
      locationName: primaryBeat?.location ? `${primaryBeat.location}` : sheetData.locationName,
      castCalls: newCastCalls.length > 0 ? newCastCalls : sheetData.castCalls,
    };

    setSheetData(updated);
    localStorage.setItem('backstage_active_callsheet', JSON.stringify(updated));
  };

  // Add Cast Row
  const handleAddCastRow = () => {
    const newCast: CastCallItem = {
      id: `cc-${Date.now()}`,
      castNumber: sheetData.castCalls.length + 1,
      characterName: 'New Character',
      actorName: 'Actor Name',
      status: 'W',
      pickupTime: '06:30',
      makeupTime: '07:00',
      onSetTime: '07:45',
      notes: '',
    };
    setSheetData({ ...sheetData, castCalls: [...sheetData.castCalls, newCast] });
  };

  const handleDeleteCastRow = (id: string) => {
    setSheetData({ ...sheetData, castCalls: sheetData.castCalls.filter((c) => c.id !== id) });
  };

  return (
    <div className={`w-full min-h-full p-6 font-sans ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0a0a0c] text-gray-100'}`}>
      {/* Top Action Toolbar (Hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Daily Production Call Sheet</h1>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
              Shoot Day {sheetData.shootDay} of {sheetData.totalShootDays} • Call Time {sheetData.callTime} AM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoFillFromScenes}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors ${
              isLight ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#18181b] hover:bg-[#27272a] border-[#333] text-gray-200'
            }`}
          >
            <Sparkles size={14} className="text-[#f5a623]" />
            Auto-Fill from Scenes
          </button>

          {isEditing ? (
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Check size={14} />
              Save Sheet
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors ${
                isLight ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#18181b] hover:bg-[#27272a] border-[#333] text-gray-200'
              }`}
            >
              <Edit3 size={14} />
              Edit Details
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#f5a623] hover:bg-[#e09612] text-black flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer size={14} />
            Print Call Sheet
          </button>
        </div>
      </div>

      {/* Official Call Sheet Paper Container */}
      <div className={`max-w-5xl mx-auto rounded-xl border p-8 shadow-2xl transition-all ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#121215] border-[#27272a] text-gray-100'
      }`}>
        {/* Banner Header */}
        <div className="border-b-2 border-slate-900 dark:border-white/20 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={sheetData.productionTitle}
                  onChange={(e) => setSheetData({ ...sheetData, productionTitle: e.target.value })}
                  className="text-2xl font-black tracking-tight uppercase bg-transparent border-b border-[#f5a623] outline-none"
                />
              ) : (
                <h1 className="text-2xl font-black tracking-tight uppercase">{sheetData.productionTitle}</h1>
              )}
              <div className="text-xs font-mono text-gray-500 mt-1">
                SHOOT DAY {sheetData.shootDay} OF {sheetData.totalShootDays} &nbsp;•&nbsp; DATE: {sheetData.date}
              </div>
            </div>

            {/* General Call Badge */}
            <div className="text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">GENERAL CREW CALL</div>
              <div className="text-2xl font-black text-[#f5a623] font-mono">{sheetData.callTime} AM</div>
              <div className="text-[10px] font-mono text-gray-400">Breakfast: {sheetData.breakfastTime} AM</div>
            </div>
          </div>

          {/* Key Leadership Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Director</span>
              <span className="font-semibold">{sheetData.director}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Producer</span>
              <span className="font-semibold">{sheetData.producer}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">1st AD</span>
              <span className="font-semibold">{sheetData.firstAd}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Cinematographer</span>
              <span className="font-semibold">{sheetData.cinematographer}</span>
            </div>
          </div>
        </div>

        {/* Location, Safety & Weather Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
          {/* Location details */}
          <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181f] border-[#27272a]'}`}>
            <div className="flex items-center gap-2 font-bold mb-2 text-[#f5a623]">
              <MapPin size={14} />
              <span>SHOOT LOCATION & BASECAMP</span>
            </div>
            <div className="font-bold text-sm mb-1">{sheetData.locationName}</div>
            <div className="text-gray-500 mb-2">{sheetData.locationAddress}</div>
            <div className="text-[11px] text-gray-400 bg-white/5 p-2 rounded border border-white/5">
              <strong>Parking:</strong> {sheetData.parkingInstructions}
            </div>
          </div>

          {/* Emergency Hospital & Weather */}
          <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181f] border-[#27272a]'}`}>
            <div className="flex items-center gap-2 font-bold mb-2 text-red-500">
              <Shield size={14} />
              <span>NEAREST HOSPITAL & EMERGENCY</span>
            </div>
            <div className="font-bold text-sm text-red-400">{sheetData.hospitalName}</div>
            <div className="text-gray-500 mb-1">{sheetData.hospitalAddress}</div>
            <div className="font-mono text-red-400 font-bold mb-2">Emergency Phone: {sheetData.hospitalEmergencyPhone}</div>
            <div className="text-[11px] flex items-center gap-2 text-gray-400 border-t border-inherit pt-2">
              <Sun size={13} className="text-amber-400" />
              <span>{sheetData.weather}</span>
            </div>
          </div>
        </div>

        {/* Scheduled Scenes List */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-[#f5a623]" />
              Scheduled Scenes to Shoot Today
            </h2>
            <span className="text-[10px] font-mono text-gray-400">{sheetData.scheduledScenes.length} Scenes Scheduled</span>
          </div>

          <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-[#16161b] border-[#27272a]'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`text-[10px] font-black uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-[#1e1e24] text-gray-400'}`}>
                  <th className="py-2.5 px-3 w-16">Sc #</th>
                  <th className="py-2.5 px-3">Slugline / Setting</th>
                  <th className="py-2.5 px-3">Synopsis / Action</th>
                  <th className="py-2.5 px-3 w-20 text-center">Pages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-mono">
                {sheetData.scheduledScenes.map((scNum) => {
                  const matchedBeat = beats.find((b) => String(b.sceneNumber) === scNum);
                  return (
                    <tr key={scNum}>
                      <td className="py-2.5 px-3 font-bold text-[#f5a623]">{scNum}</td>
                      <td className="py-2.5 px-3 font-sans font-bold">{matchedBeat?.title || `INT/EXT. LOCATION - DAY`}</td>
                      <td className="py-2.5 px-3 font-sans text-gray-400">{matchedBeat?.synopsis || matchedBeat?.description || 'Scene action...'}</td>
                      <td className="py-2.5 px-3 text-center">{matchedBeat?.pageCount || '1/8'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cast Call Schedule Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-[#f5a623]" />
              Cast Call Times & Schedule
            </h2>
            {isEditing && (
              <button
                onClick={handleAddCastRow}
                className="text-[10px] font-bold px-2 py-1 rounded bg-[#f5a623]/20 text-[#f5a623] hover:bg-[#f5a623]/30 flex items-center gap-1"
              >
                <Plus size={12} /> Add Cast Row
              </button>
            )}
          </div>

          <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-[#16161b] border-[#27272a]'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`text-[10px] font-black uppercase border-b ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-[#1e1e24] text-gray-400'}`}>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Character</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-2 text-center w-12">Status</th>
                  <th className="py-2.5 px-3 text-center w-20">Pickup</th>
                  <th className="py-2.5 px-3 text-center w-20">H/MU</th>
                  <th className="py-2.5 px-3 text-center w-24 bg-amber-500/10 text-[#f5a623]">On Set</th>
                  <th className="py-2.5 px-3">Wardrobe & Special Notes</th>
                  {isEditing && <th className="py-2.5 px-2 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {sheetData.castCalls.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 text-center font-mono text-gray-400">{c.castNumber}</td>
                    <td className="py-2.5 px-3 font-bold">{c.characterName}</td>
                    <td className="py-2.5 px-3 text-gray-400">{c.actorName}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-500">{c.status || 'W'}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{c.pickupTime}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{c.makeupTime}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-[#f5a623] bg-amber-500/5">{c.onSetTime}</td>
                    <td className="py-2.5 px-3 text-gray-400 text-[11px]">{c.notes || '-'}</td>
                    {isEditing && (
                      <td className="py-2.5 px-2 text-center">
                        <button onClick={() => handleDeleteCastRow(c.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Notes Multi-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-white/10 text-xs">
          <div className={`p-3 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181f] border-[#27272a]'}`}>
            <div className="font-bold flex items-center gap-1.5 mb-1.5 text-sky-400">
              <Camera size={13} /> Camera & Grip Notes
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">{sheetData.cameraNotes || 'Standard setup.'}</p>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181f] border-[#27272a]'}`}>
            <div className="font-bold flex items-center gap-1.5 mb-1.5 text-orange-400">
              <Flame size={13} /> Stunt & Practical FX
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">{sheetData.stuntSfxNotes || 'No stunt elements today.'}</p>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181f] border-[#27272a]'}`}>
            <div className="font-bold flex items-center gap-1.5 mb-1.5 text-emerald-400">
              <Utensils size={13} /> Catering & Meals
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">{sheetData.cateringNotes || 'Standard meal times.'}</p>
          </div>
        </div>

        {/* Tomorrow Preview Footer */}
        <div className="mt-6 pt-3 border-t-2 border-slate-900 dark:border-white/20 flex justify-between items-center text-xs font-mono">
          <div>
            <span className="font-bold text-[#f5a623]">TOMORROW'S PREVIEW:</span> &nbsp;{sheetData.tomorrowPreview}
          </div>
          <div className="text-[10px] text-gray-500">
            GENERATED WITH BACKSTAGE STORY SEQUENCER
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallSheetView;
