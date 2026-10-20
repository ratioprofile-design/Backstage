import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { Beat, ProductionDocument } from '../../types';
import { callAiJson } from '../../services/gemini';
import { getProductionDocuments, loadProductionDocumentsAsync, saveProductionDocuments } from '../../services/documentsStorage';
import { parseScreenplayToTamilLeftRight, TamilScene } from '../../services/tamilLeftRightEngine';
import {
  ArrowDown, ArrowUp, Download, Film, Loader2, Printer, Search,
  Sparkles, RotateCcw, Calendar, CheckCircle2, AlertTriangle, X,
  Clock, MapPin, Users, SlidersHorizontal, ChevronRight, Check
} from 'lucide-react';

export type Strip = {
  beatId: number;
  scene: string;
  heading: string;
  synopsis: string;
  pages: string;
  dayNight: string;
  intExt: string;
  location: string;
  cast: string[];
  elements: string[];
  stunts: string;
  vfx: string;
  sound: string;
  notes: string;
  shootDay: string;
  color: string;
  sourceSceneId?: string;
  order?: number;
};

// Standard Hollywood & Kollywood 1st AD Stripboard Color Coding
const palette: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  white: { bg: 'bg-white', border: 'border-slate-300', text: 'text-slate-900', badge: 'bg-slate-200 text-slate-800' },
  yellow: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-950', badge: 'bg-amber-200 text-amber-900' },
  blue: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-950', badge: 'bg-sky-200 text-sky-900' },
  green: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-950', badge: 'bg-emerald-200 text-emerald-900' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-950', badge: 'bg-pink-200 text-pink-900' },
  red: { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-950', badge: 'bg-rose-200 text-rose-900' },
};

const clean = (html = '') =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const safeList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).map(s => s.trim()).filter(Boolean) : [];

// Calculate eighths of a page from text metrics (~50 lines or ~240 words = 1 script page)
function estimatePageFraction(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').filter(Boolean).length;
  const eighths = Math.max(1, Math.min(64, Math.round(Math.max(words / 28, lines / 6))));
  const whole = Math.floor(eighths / 8);
  const rem = eighths % 8;
  return whole > 0 ? (rem > 0 ? `${whole} ${rem}/8` : `${whole}`) : `${rem}/8`;
}

// Deterministic 1st AD strip builder: generates high-fidelity production strip immediately
function buildDeterministicStrip(scene: any, index: number, previous?: Strip): Strip {
  const beatId = scene.id;
  const sceneNumber = String(scene.sceneNumber || index + 1);
  const slugPrefix = (scene.slug?.prefix || scene.sluglineText?.match(/\b(INT\.?\s*\/\s*EXT\.?|EXT\.?|INT\.?)\b/i)?.[0] || 'INT').toUpperCase();
  const slugTime = (scene.slug?.time || scene.timeOfDay || scene.sluglineText?.match(/\b(DAY|NIGHT|DAWN|DUSK|EVENING|MORNING)\b/i)?.[0] || 'DAY').toUpperCase();
  const location = (scene.slug?.location || scene.location || scene.title || 'LOCATION').trim() || 'LOCATION';
  const heading = scene.slug?.raw || scene.sluglineText || `${slugPrefix} ${location} - ${slugTime}`;

  const contentText = clean(scene.content || '');
  const pages = previous?.pages && previous.pages !== 'TBD' ? previous.pages : estimatePageFraction(contentText);

  const isNight = /NIGHT|DUSK|EVENING|இரவு/i.test(slugTime);
  const isExt = /EXT|வெளி/i.test(slugPrefix);
  const intExt = isExt ? (/INT/i.test(slugPrefix) ? 'INT/EXT' : 'EXT') : 'INT';
  const dayNight = isNight ? 'NIGHT' : (/DAWN|வைகறை/i.test(slugTime) ? 'DAWN' : 'DAY');

  // Cast extraction
  const cast = safeList(
    previous?.cast?.length
      ? previous.cast
      : scene.characters?.length
      ? scene.characters
      : (scene.breakdown?.CAST?.map((c: any) => (typeof c === 'string' ? c : c.name || c.item)) || [])
  );

  // Production elements extraction
  const elementsSet = new Set<string>();
  if (previous?.elements?.length) {
    previous.elements.forEach(e => elementsSet.add(e));
  } else if (scene.breakdown) {
    ['PROPS', 'VEHICLES', 'WARDROBE', 'ANIMALS', 'SFX', 'SET_DRESSING', 'SPECIAL_EQUIPMENT'].forEach(cat => {
      const items = scene.breakdown[cat];
      if (Array.isArray(items)) {
        items.forEach((it: any) => {
          const name = typeof it === 'string' ? it : (it.name || it.item);
          if (name) elementsSet.add(name);
        });
      }
    });
  }
  const elements = Array.from(elementsSet).slice(0, 10);

  // Stunts & Action
  let stunts = previous?.stunts || '';
  if (!stunts || stunts === 'None identified') {
    const stuntItems = scene.breakdown?.STUNTS;
    if (Array.isArray(stuntItems) && stuntItems.length) {
      stunts = stuntItems.map((s: any) => typeof s === 'string' ? s : s.name).join(', ');
    } else if (/(fight|stunt|wire|gun|blast|fall|jump|chase|சண்டை|துப்பாக்கி)/i.test(contentText)) {
      stunts = 'Physical action / stunt flagged';
    } else {
      stunts = 'None identified';
    }
  }

  // VFX
  let vfx = previous?.vfx || '';
  if (!vfx || vfx === 'None identified') {
    const vfxItems = scene.breakdown?.SFX;
    if (Array.isArray(vfxItems) && vfxItems.length) {
      vfx = vfxItems.map((v: any) => typeof v === 'string' ? v : v.name).join(', ');
    } else if (/(vfx|cgi|green\s*screen|explosion|digital|plate|மாயாஜாலம்)/i.test(contentText)) {
      vfx = 'Visual effect / digital plate';
    } else {
      vfx = 'None identified';
    }
  }

  // Sound
  let sound = previous?.sound || '';
  if (!sound) {
    const soundItems = scene.breakdown?.SOUND;
    if (Array.isArray(soundItems) && soundItems.length) {
      sound = soundItems.map((s: any) => typeof s === 'string' ? s : s.name).join(', ');
    } else {
      sound = 'Standard production sound';
    }
  }

  // Authentic 1st AD Color Coding
  let color = previous?.color;
  if (!color || color === 'white') {
    if (stunts !== 'None identified' || /Special/i.test(heading)) {
      color = 'pink';
    } else if (intExt === 'INT' && dayNight === 'DAY') {
      color = 'white';
    } else if (intExt === 'INT' && dayNight === 'NIGHT') {
      color = 'yellow';
    } else if (intExt === 'EXT' && dayNight === 'DAY') {
      color = 'blue';
    } else if (intExt === 'EXT' && dayNight === 'NIGHT') {
      color = 'green';
    } else {
      color = 'white';
    }
  }

  const synopsis = previous?.synopsis || scene.summary || contentText.slice(0, 220).trim() || `${heading} scene`;

  return {
    beatId,
    sourceSceneId: (scene as any).sourceSceneId,
    scene: sceneNumber,
    heading,
    synopsis,
    pages,
    dayNight,
    intExt,
    location,
    cast,
    elements,
    stunts,
    vfx,
    sound,
    notes: previous?.notes || (isNight ? 'Night lighting required' : ''),
    shootDay: previous?.shootDay || '',
    color: color || 'white',
    order: previous?.order ?? index
  };
}

const StripboardView: React.FC = () => {
  const {
    beats = [], updateBeat, setBeats, currentProjectId,
    projectList = [], generalAiModel, openrouterKey
  } = useProject(['beats', 'updateBeat', 'setBeats', 'currentProjectId', 'projectList', 'generalAiModel', 'openrouterKey']);

  const { aiAvailable, refresh: refreshAiStatus } = useAiKeyStatus();
  useEffect(() => {
    if (openrouterKey) refreshAiStatus(openrouterKey);
  }, [openrouterKey, refreshAiStatus]);

  const projectName = projectList.find((p: any) => p.id === currentProjectId)?.name || 'Untitled production';

  // Screenplay source state
  const [source, setSource] = useState<'screenplay' | 'script'>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('backstage_stripboard_preferred_source');
      if (saved === 'script' || saved === 'screenplay') return saved;
    }
    return 'screenplay';
  });

  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments(currentProjectId || undefined));
  const [selectedDocId, setSelectedDocId] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('active_two_column_doc_id') || '' : ''));

  useEffect(() => {
    setDocuments(getProductionDocuments(currentProjectId || undefined));
    loadProductionDocumentsAsync(currentProjectId || undefined).then(docs => {
      if (docs?.length) setDocuments(docs);
    }).catch(() => {});
  }, [currentProjectId]);

  const scriptDocs = useMemo(
    () => documents.filter(d => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT' || d.twoColumnData?.scenes?.length),
    [documents]
  );
  const activeDoc = scriptDocs.find(d => d.id === selectedDocId) || scriptDocs.find(d => d.isStagedToScript) || scriptDocs[0];

  useEffect(() => {
    if (activeDoc && activeDoc.id !== selectedDocId) setSelectedDocId(activeDoc.id);
  }, [activeDoc?.id]);

  const screenplayScenes = useMemo(
    () => (beats as Beat[]).filter(b => !b.isDisabled).slice().sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    [beats]
  );

  const scriptPageScenes = useMemo(() => {
    if (!activeDoc) return [] as Beat[];
    let parsed = activeDoc.twoColumnData;
    if (!Array.isArray(parsed?.scenes)) {
      const raw = activeDoc.textContent || activeDoc.content || (activeDoc.htmlContent || '').replace(/<[^>]*>/g, '\n');
      if (raw.trim()) parsed = parseScreenplayToTamilLeftRight(raw, activeDoc.title);
    }
    return ((parsed?.scenes || []) as TamilScene[]).map((scene, index) => {
      const body = (scene.items || [])
        .map(item => [item.leftAction, item.rightCharacter ? `${item.rightCharacter}:` : '', item.rightDialogue, item.rightAudioSfx ? `[SOUND: ${item.rightAudioSfx}]` : '', item.rawText].filter(Boolean).join(' '))
        .join('\n');
      const slug = scene.sluglineText || `${scene.location || ''} - ${scene.timeOfDay || ''}`;
      const prefix = slug.match(/\b(INT\.?\s*\/\s*EXT\.?|EXT\.?|INT\.?)\b/i)?.[0] || 'INT';
      const location = scene.location || slug.replace(/^\s*(INT\.?\s*\/\s*EXT\.?|EXT\.?|INT\.?)\s*/i, '').replace(/\s*-\s*(DAY|NIGHT|DAWN|DUSK|EVENING|MORNING).*$/i, '').trim() || 'LOCATION';
      return {
        id: -(index + 1),
        sourceSceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        title: location,
        summary: '',
        slug: { prefix, location, time: scene.timeOfDay || 'DAY', raw: slug },
        content: body,
        characters: scene.characters || [],
        breakdown: scene.breakdown,
        stripboard: (scene as any).stripboard,
        x: index,
        y: index
      } as Beat & { sourceSceneId: string };
    });
  }, [activeDoc]);

  // Auto-switch to script if screenplay is empty but script has scenes
  useEffect(() => {
    if (screenplayScenes.length === 0 && scriptPageScenes.length > 0 && source === 'screenplay') {
      setSource('script');
      try { localStorage.setItem('backstage_stripboard_preferred_source', 'script'); } catch {}
    }
  }, [screenplayScenes.length, scriptPageScenes.length, source]);

  const handleSetSource = (nextSource: 'screenplay' | 'script') => {
    setSource(nextSource);
    try { localStorage.setItem('backstage_stripboard_preferred_source', nextSource); } catch {}
  };

  const scenes = source === 'screenplay' ? screenplayScenes : scriptPageScenes;
  const storageKey = `backstage_stripboard_${currentProjectId || 'default'}_${source}${source === 'script' ? `_${activeDoc?.id || 'none'}` : ''}`;

  const [strips, setStrips] = useState<Strip[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All scenes');
  const [filterShootDay, setFilterShootDay] = useState('All days');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // AI Batch Progress
  const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({ current: 0, total: 0, message: '' });
  const cancelRef = useRef(false);

  // Initialize strips from storage or baseline
  useEffect(() => {
    if (!scenes.length) {
      setStrips([]);
      return;
    }

    let existing: Strip[] = [];
    if (source === 'script') {
      try {
        existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch {
        existing = [];
      }
    } else {
      existing = scenes
        .filter(b => b.stripboard)
        .map((b, i) => ({
          beatId: b.id,
          scene: String(b.stripboard!.scene || b.sceneNumber || i + 1),
          heading: String(b.stripboard!.heading || `${b.slug?.prefix || ''} ${b.slug?.location || b.title} - ${b.slug?.time || 'DAY'}`.trim()),
          synopsis: String(b.stripboard!.synopsis || b.summary || ''),
          pages: String(b.stripboard!.pages || 'TBD'),
          dayNight: String(b.stripboard!.dayNight || b.slug?.time || 'DAY').toUpperCase(),
          intExt: String(b.stripboard!.intExt || b.slug?.prefix || 'INT').toUpperCase(),
          location: String(b.stripboard!.location || b.slug?.location || 'LOCATION'),
          cast: safeList(b.stripboard!.cast).length ? safeList(b.stripboard!.cast) : b.characters || [],
          elements: safeList(b.stripboard!.elements),
          stunts: String(b.stripboard!.stunts || 'None identified'),
          vfx: String(b.stripboard!.vfx || 'None identified'),
          sound: String(b.stripboard!.sound || 'Standard production sound'),
          notes: String(b.stripboard!.notes || ''),
          shootDay: String(b.stripboard!.shootDay || ''),
          color: String(b.stripboard!.color || 'white'),
          order: Number(b.stripboard!.order ?? i)
        }))
        .sort((a, b) => a.order - b.order)
        .map(({ order, ...strip }) => strip as Strip);
    }

    // If no strips exist yet, build high-fidelity baseline strips immediately
    if (!existing.length) {
      const baseline = scenes.map((sc, i) => buildDeterministicStrip(sc, i));
      setStrips(baseline);
      if (source === 'script') {
        try { localStorage.setItem(storageKey, JSON.stringify(baseline)); } catch {}
      }
    } else {
      setStrips(existing);
    }
  }, [storageKey, scenes.length, source]);

  // Persist strips on change for script source
  useEffect(() => {
    if (source === 'script' && strips.length > 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(strips)); } catch {}
    }
  }, [strips, source, storageKey]);

  // Sync back to ProjectContext / Documents
  const persistStrips = useCallback((updatedStrips: Strip[]) => {
    if (source === 'screenplay') {
      const orderMap = new Map(updatedStrips.map((s, idx) => [s.beatId, { ...s, order: idx }]));
      setBeats((beats as Beat[]).map(beat => {
        const item = orderMap.get(beat.id);
        if (!item) return beat;
        return { ...beat, stripboard: item };
      }));
    } else if (activeDoc?.twoColumnData?.scenes) {
      const updatedDoc = {
        ...activeDoc,
        twoColumnData: {
          ...activeDoc.twoColumnData,
          scenes: activeDoc.twoColumnData.scenes.map((scene: any) => {
            const strip = updatedStrips.find(s => s.sourceSceneId === scene.id);
            if (!strip) return scene;
            return { ...scene, stripboard: { ...strip, order: updatedStrips.indexOf(strip) } };
          })
        }
      };
      const updatedDocs = documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc);
      setDocuments(updatedDocs);
      saveProductionDocuments(updatedDocs, currentProjectId || undefined);
    }
  }, [source, activeDoc, documents, currentProjectId, setBeats, beats]);

  // Cancel AI Generation
  const handleCancelAi = () => {
    cancelRef.current = true;
    setBusy(false);
    setProgress({ current: 0, total: 0, message: '' });
  };

  // AI Generation in resilient batches of 5 scenes
  const generate = async () => {
    if (!scenes.length) return;
    setBusy(true);
    setError('');
    setSuccessBanner('');
    cancelRef.current = false;

    // Step 1: Ensure all scenes have baseline strips
    let workingStrips = scenes.map((sc, i) => {
      const prev = strips.find(s => s.beatId === sc.id);
      return buildDeterministicStrip(sc, i, prev);
    });
    setStrips(workingStrips);

    const BATCH_SIZE = 5;
    const totalScenes = scenes.length;
    const totalBatches = Math.ceil(totalScenes / BATCH_SIZE);

    setProgress({
      current: 0,
      total: totalScenes,
      message: `Starting 1st AD analysis for ${totalScenes} scenes in ${totalBatches} batches...`
    });

    try {
      for (let bIdx = 0; bIdx < totalBatches; bIdx++) {
        if (cancelRef.current) break;

        const start = bIdx * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalScenes);
        const batchScenes = scenes.slice(start, end);

        setProgress({
          current: start + 1,
          total: totalScenes,
          message: `AI studying scenes ${start + 1}–${end} of ${totalScenes} (Batch ${bIdx + 1}/${totalBatches})...`
        });

        const batchInput = batchScenes.map((sc, i) => {
          const currentStrip = workingStrips.find(s => s.beatId === sc.id);
          const excerpt = clean(sc.content || '').slice(0, 1100);
          return {
            beatId: sc.id,
            sceneNumber: sc.sceneNumber || String(start + i + 1),
            heading: sc.slug?.raw || `${sc.slug?.prefix || ''} ${sc.slug?.location || sc.title} - ${sc.slug?.time || ''}`.trim(),
            characters: sc.characters || [],
            location: currentStrip?.location || sc.slug?.location || sc.title,
            existingStunts: currentStrip?.stunts !== 'None identified' ? currentStrip?.stunts : undefined,
            existingElements: currentStrip?.elements?.length ? currentStrip.elements : undefined,
            screenplayExcerpt: excerpt
          };
        });

        const prompt = `You are a veteran 1st Assistant Director (1st AD) and Production Breakdown Supervisor for feature films.
Analyze these ${batchScenes.length} screenplay scenes and return production stripboard cards.
Return ONLY valid JSON matching this schema:
{
  "strips": [
    {
      "beatId": number,
      "scene": string,
      "heading": string,
      "synopsis": "1-2 sentence dramatic and logistical summary of what happens and characters involved",
      "dayNight": "DAY" | "NIGHT" | "DAWN" | "DUSK",
      "intExt": "INT" | "EXT" | "INT/EXT",
      "location": "primary filming location name",
      "cast": ["Character 1", "Character 2"],
      "elements": ["Notable production prop / vehicle / animal / special item"],
      "stunts": "Action or stunt requirements (or 'None identified')",
      "vfx": "Visual effects or digital plates (or 'None identified')",
      "sound": "Key sound cues (e.g. sync sound, gunfire, heavy rain, crowd)",
      "notes": "Actionable 1st AD notes (e.g. night lighting, crowd control, drone, wet down)",
      "pages": "Estimated eighth-page count e.g. '3/8', '1 2/8', '2 5/8'",
      "color": "white" | "yellow" | "blue" | "green" | "pink"
    }
  ]
}

Color rules:
- INT DAY = "white"
- INT NIGHT = "yellow"
- EXT DAY = "blue"
- EXT NIGHT = "green"
- Special / Stunt / Heavy VFX = "pink"

Scenes to analyze:
${JSON.stringify(batchInput)}`;

        let aiResult: any = null;
        try {
          aiResult = await callAiJson(prompt, generalAiModel || 'gemini-flash-latest', openrouterKey);
        } catch (callErr: any) {
          console.warn(`[Stripboard AI] Batch ${bIdx + 1} call error:`, callErr);
          // Wait 1.5s and retry once
          await new Promise(r => setTimeout(r, 1500));
          try {
            aiResult = await callAiJson(prompt, generalAiModel || 'gemini-flash-latest', openrouterKey);
          } catch (retryErr) {
            console.warn(`[Stripboard AI] Batch ${bIdx + 1} retry failed, preserving deterministic strips:`, retryErr);
          }
        }

        const receivedStrips = Array.isArray(aiResult?.strips) ? aiResult.strips : [];
        const byId = new Map(receivedStrips.map((s: any) => [Number(s.beatId), s]));

        // Merge batch results into working strips
        workingStrips = workingStrips.map(prevStrip => {
          const aiStrip: any = byId.get(prevStrip.beatId);
          if (!aiStrip) return prevStrip;

          const intExt = String(aiStrip.intExt || prevStrip.intExt || 'INT').toUpperCase();
          const dayNight = String(aiStrip.dayNight || prevStrip.dayNight || 'DAY').toUpperCase();
          let color = aiStrip.color || prevStrip.color;
          if (!color || color === 'white') {
            if (aiStrip.stunts && aiStrip.stunts !== 'None identified') color = 'pink';
            else if (intExt === 'INT' && dayNight === 'DAY') color = 'white';
            else if (intExt === 'INT' && dayNight === 'NIGHT') color = 'yellow';
            else if (intExt === 'EXT' && dayNight === 'DAY') color = 'blue';
            else if (intExt === 'EXT' && dayNight === 'NIGHT') color = 'green';
          }

          return {
            ...prevStrip,
            scene: String(aiStrip.scene || prevStrip.scene),
            heading: String(aiStrip.heading || prevStrip.heading),
            synopsis: String(aiStrip.synopsis || prevStrip.synopsis),
            pages: String(aiStrip.pages && aiStrip.pages !== 'TBD' ? aiStrip.pages : prevStrip.pages),
            dayNight,
            intExt,
            location: String(aiStrip.location || prevStrip.location),
            cast: safeList(aiStrip.cast).length ? safeList(aiStrip.cast) : prevStrip.cast,
            elements: safeList(aiStrip.elements).length ? safeList(aiStrip.elements) : prevStrip.elements,
            stunts: String(aiStrip.stunts || prevStrip.stunts),
            vfx: String(aiStrip.vfx || prevStrip.vfx),
            sound: String(aiStrip.sound || prevStrip.sound),
            notes: String(aiStrip.notes || prevStrip.notes),
            color: color || 'white'
          };
        });

        // Progressive real-time UI update!
        setStrips([...workingStrips]);
        persistStrips(workingStrips);
      }

      setSuccessBanner(`✓ 1st AD Stripboard complete! All ${totalScenes} scenes analyzed and formatted into production strips.`);
    } catch (e: any) {
      console.error('[Stripboard AI] Generation error:', e);
      setError(e?.message || 'Stripboard generation hit an issue. Existing production strips were preserved.');
    } finally {
      setBusy(false);
      setProgress({ current: 0, total: 0, message: '' });
    }
  };

  // 1st AD Auto-Schedule: Group scenes into shoot days by location & lighting
  const handleAutoGroupShootDays = () => {
    if (!strips.length) return;
    const locationDayMap = new Map<string, string>();
    let currentDayNumber = 1;
    let currentDayPages = 0;

    const updated = strips.map(strip => {
      // Group key: clean location + day/night
      const groupKey = `${strip.location.toLowerCase().trim()}_${strip.dayNight}`;
      let assignedDay = locationDayMap.get(groupKey);

      if (!assignedDay) {
        assignedDay = `Day ${currentDayNumber}`;
        locationDayMap.set(groupKey, assignedDay);
      }

      // Estimate pages added to track day capacity (aiming ~4 pages per shoot day)
      const parts = strip.pages.match(/(\d+)?\s*(\d+)?\/?8?/);
      let pageFloat = 0.5;
      if (parts) {
        const whole = parseInt(parts[1] || '0', 10);
        const eighths = parseInt(parts[2] || '0', 10);
        pageFloat = whole + (eighths / 8);
      }
      currentDayPages += pageFloat;

      if (currentDayPages >= 4.5) {
        currentDayNumber++;
        currentDayPages = 0;
      }

      return { ...strip, shootDay: assignedDay };
    });

    setStrips(updated);
    persistStrips(updated);
    setSuccessBanner(`✓ Auto-grouped ${strips.length} scenes into ${new Set(updated.map(s => s.shootDay)).size} shoot days by location & lighting!`);
  };

  // Edit single field
  const setField = (id: number, key: keyof Strip, value: any) => {
    const current = strips.find(s => s.beatId === id);
    if (!current) return;
    const next = { ...current, [key]: value };
    const updated = strips.map(s => s.beatId === id ? next : s);
    setStrips(updated);
    persistStrips(updated);
  };

  // Move scene order
  const move = (index: number, direction: number) => {
    const n = index + direction;
    if (n < 0 || n >= strips.length) return;
    const copy = [...strips];
    [copy[index], copy[n]] = [copy[n], copy[index]];
    setStrips(copy);
    persistStrips(copy);
  };

  // Export CSV
  const exportCsv = () => {
    const columns: (keyof Strip)[] = ['scene', 'heading', 'pages', 'dayNight', 'intExt', 'location', 'cast', 'synopsis', 'elements', 'stunts', 'vfx', 'sound', 'shootDay', 'notes'];
    const quote = (v: any) => `"${(Array.isArray(v) ? v.join('; ') : String(v ?? '')).replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...strips.map(s => columns.map(k => quote(s[k])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-stripboard.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Filtered strips
  const visible = useMemo(() => {
    return strips.filter(s => {
      const q = query.toLowerCase();
      const matchesQuery = !q || `${s.scene} ${s.heading} ${s.location} ${s.synopsis} ${s.cast.join(' ')} ${s.elements.join(' ')} ${s.stunts} ${s.vfx}`.toLowerCase().includes(q);
      const matchesLighting = filter === 'All scenes' || s.intExt === filter || s.dayNight === filter;
      const matchesDay = filterShootDay === 'All days' || s.shootDay === filterShootDay;
      return matchesQuery && matchesLighting && matchesDay;
    });
  }, [strips, query, filter, filterShootDay]);

  const uniqueShootDays = useMemo(() => {
    return Array.from(new Set(strips.map(s => s.shootDay).filter(Boolean))).sort();
  }, [strips]);

  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(strips.map(s => s.location).filter(x => x && x !== 'LOCATION' && x !== 'TBD')));
  }, [strips]);

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="h-full overflow-auto bg-[#0b0d10] text-slate-100">
      <div className="mx-auto max-w-[1540px] p-6 md:p-9">
        {/* HEADER */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.24em] text-amber-400">
              <Film size={15} /> Production / Stripboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">One line. Every scene.</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              AI 1st AD reads your screenplay line-by-line and generates color-coded production strips with eighth-page counts, cast requirements, stunts, and shoot schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              title="Print call-sheet style stripboard"
            >
              <Printer size={16} /> Print
            </button>
            <button
              onClick={exportCsv}
              disabled={!strips.length}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Export production stripboard as CSV"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              onClick={handleAutoGroupShootDays}
              disabled={!strips.length || busy}
              className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
              title="Automatically group scenes by location into shoot days"
            >
              <Calendar size={16} /> Auto-Schedule Days
            </button>
            <button
              onClick={generate}
              disabled={busy || !scenes.length}
              title={!aiAvailable && !openrouterKey ? 'AI API key not set (will generate high-fidelity 1st AD baseline)' : `Analyze ${scenes.length} scenes in batches`}
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-amber-400/20 transition-all"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : strips.length ? <RotateCcw size={16} /> : <Sparkles size={16} />}
              {busy ? 'Analyzing with AI…' : strips.length ? 'Regenerate with AI' : 'Build with AI'}
            </button>
          </div>
        </header>

        {/* AI BATCH PROGRESS BAR */}
        {busy && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 shadow-lg">
            <div className="flex items-center justify-between text-sm font-medium text-amber-200 mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-amber-400" size={17} />
                <span>{progress.message || '1st AD analyzing screenplay scenes in batches...'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-amber-300 font-bold">{progressPercent}%</span>
                <button
                  onClick={handleCancelAi}
                  className="rounded px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-300 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* SUCCESS / ERROR ALERTS */}
        {successBanner && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-sm text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} className="text-emerald-400" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner('')} className="text-emerald-400 hover:text-emerald-200">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/50 p-3.5 text-sm text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">
              <X size={16} />
            </button>
          </div>
        )}

        {/* SOURCE CONTROLS */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-sm">
          <span className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Screenplay Source:</span>
          <button
            onClick={() => handleSetSource('screenplay')}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${source === 'screenplay' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Screenplay Page <span className="ml-1 opacity-70">({screenplayScenes.length})</span>
          </button>
          <button
            onClick={() => handleSetSource('script')}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${source === 'script' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Script Page (2-Column) <span className="ml-1 opacity-70">({scriptPageScenes.length})</span>
          </button>

          {source === 'script' && scriptDocs.length > 1 && (
            <select
              aria-label="Choose Script document"
              value={activeDoc?.id || ''}
              onChange={e => {
                setSelectedDocId(e.target.value);
                try { localStorage.setItem('active_two_column_doc_id', e.target.value); } catch {}
              }}
              className="ml-auto max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="">Choose script document</option>
              {scriptDocs.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          )}

          {source === 'script' && activeDoc && (
            <span className="ml-auto text-xs font-medium text-slate-400">
              Source Doc: <span className="text-amber-300">{activeDoc.title}</span>
            </span>
          )}
        </div>

        {/* EMPTY STATE */}
        {!scenes.length ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center bg-slate-900/20">
            <Film className="mx-auto mb-3 text-slate-500" size={32} />
            <h2 className="text-lg font-semibold text-slate-200">
              {source === 'script' ? 'No Script page scenes found' : 'No Screenplay page scenes found'}
            </h2>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              Switch to the other source above or import your script in the Script (2-Column) page first.
            </p>
          </div>
        ) : (
          <>
            {/* STATS OVERVIEW */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Scenes', scenes.length, 'Clapperboard'],
                ['Production Strips', strips.length, 'Film'],
                ['Shoot Days', uniqueShootDays.length || 'Unscheduled', 'Calendar'],
                ['Filming Locations', uniqueLocations.length, 'MapPin']
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className="mt-1 text-2xl font-bold text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            {/* SEARCH AND FILTERS */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                <Search size={16} className="text-slate-500" />
                <input
                  aria-label="Search strips"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search scene #, location, cast, stunts, props, keywords…"
                  className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
                    <X size={14} />
                  </button>
                )}
              </label>

              <select
                aria-label="Filter lighting"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="All scenes">All Lighting</option>
                <option value="INT">INT only</option>
                <option value="EXT">EXT only</option>
                <option value="DAY">DAY only</option>
                <option value="NIGHT">NIGHT only</option>
                <option value="DAWN">DAWN only</option>
                <option value="DUSK">DUSK only</option>
              </select>

              {uniqueShootDays.length > 0 && (
                <select
                  aria-label="Filter shoot day"
                  value={filterShootDay}
                  onChange={e => setFilterShootDay(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none"
                >
                  <option value="All days">All Shoot Days</option>
                  {uniqueShootDays.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}

              <span className="text-xs font-medium text-slate-500 ml-auto">
                Showing {visible.length} of {strips.length} strips
              </span>
            </div>

            {/* STRIPS LIST */}
            <div className="space-y-3">
              {visible.map(strip => {
                const index = strips.findIndex(s => s.beatId === strip.beatId);
                const colors = palette[strip.color] || palette.white;

                return (
                  <article
                    key={strip.beatId}
                    className={`overflow-hidden rounded-xl border shadow-md transition-all ${colors.border} ${colors.bg} ${colors.text}`}
                  >
                    <div className="grid md:grid-cols-[90px_1fr]">
                      {/* LEFT: SCENE NUMBER & REORDER */}
                      <div className="flex flex-col items-center justify-center gap-1.5 border-b border-black/10 bg-black/5 p-3 md:border-b-0 md:border-r">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Scene</div>
                        <input
                          aria-label={`Scene number ${strip.scene}`}
                          value={strip.scene}
                          onChange={e => setField(strip.beatId, 'scene', e.target.value)}
                          className="w-full bg-transparent text-center text-2xl font-black outline-none"
                        />
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            aria-label="Move scene up"
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            className="rounded p-1 hover:bg-black/10 disabled:opacity-30 transition-colors"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            aria-label="Move scene down"
                            onClick={() => move(index, 1)}
                            disabled={index === strips.length - 1}
                            className="rounded p-1 hover:bg-black/10 disabled:opacity-30 transition-colors"
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      </div>

                      {/* RIGHT: STRIP METADATA */}
                      <div className="p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-[260px] flex-1">
                            <input
                              aria-label="Scene heading"
                              value={strip.heading}
                              onChange={e => setField(strip.beatId, 'heading', e.target.value)}
                              className="w-full bg-transparent text-base font-black tracking-wide outline-none"
                            />
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold uppercase tracking-wider opacity-70">
                              <span className="rounded px-1.5 py-0.5 bg-black/10 font-mono">{strip.intExt}</span>
                              <span>·</span>
                              <span className="rounded px-1.5 py-0.5 bg-black/10 font-mono">{strip.dayNight}</span>
                              <span>·</span>
                              <span className="rounded px-1.5 py-0.5 bg-black/10 font-mono">{strip.pages} pages</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                              Shoot Day
                              <input
                                aria-label={`Shoot day scene ${strip.scene}`}
                                value={strip.shootDay}
                                onChange={e => setField(strip.beatId, 'shootDay', e.target.value)}
                                placeholder="Unscheduled"
                                className="mt-1 block w-28 rounded-md border border-black/15 bg-white/60 px-2 py-1 text-xs font-semibold outline-none focus:border-black/40"
                              />
                            </label>

                            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                              Strip Color
                              <select
                                aria-label={`Strip color scene ${strip.scene}`}
                                value={strip.color}
                                onChange={e => setField(strip.beatId, 'color', e.target.value)}
                                className="mt-1 block rounded-md border border-black/15 bg-white/70 px-2 py-1 text-xs font-semibold outline-none focus:border-black/40"
                              >
                                <option value="white">White · INT DAY</option>
                                <option value="yellow">Yellow · INT NIGHT</option>
                                <option value="blue">Blue · EXT DAY</option>
                                <option value="green">Green · EXT NIGHT</option>
                                <option value="pink">Pink · Stunt / Special</option>
                                <option value="red">Red · Company Move</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        {/* SYNOPSIS */}
                        <textarea
                          aria-label={`Synopsis scene ${strip.scene}`}
                          value={strip.synopsis}
                          onChange={e => setField(strip.beatId, 'synopsis', e.target.value)}
                          rows={2}
                          placeholder="Scene synopsis and dramatic action summary..."
                          className="mt-3 w-full resize-y bg-black/[0.03] rounded-md p-2 text-sm leading-relaxed outline-none border border-black/10 focus:border-black/30"
                        />

                        {/* 4-COLUMN DETAILS */}
                        <div className="mt-3.5 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <b className="text-[10px] tracking-wider opacity-60 uppercase">LOCATION</b>
                            <input
                              aria-label={`Location scene ${strip.scene}`}
                              value={strip.location}
                              onChange={e => setField(strip.beatId, 'location', e.target.value)}
                              placeholder="Filming location"
                              className="mt-1 block w-full bg-transparent font-medium outline-none border-b border-black/15 pb-0.5"
                            />
                          </div>

                          <div>
                            <b className="text-[10px] tracking-wider opacity-60 uppercase">CAST</b>
                            <input
                              aria-label={`Cast scene ${strip.scene}`}
                              value={strip.cast.join(', ')}
                              onChange={e => setField(strip.beatId, 'cast', e.target.value.split(',').map(x => x.trim()).filter(Boolean))}
                              placeholder="Characters present"
                              className="mt-1 block w-full bg-transparent font-medium outline-none border-b border-black/15 pb-0.5"
                            />
                          </div>

                          <div>
                            <b className="text-[10px] tracking-wider opacity-60 uppercase">ELEMENTS (PROPS/VEHICLES)</b>
                            <div className="mt-1 font-medium truncate" title={strip.elements.join(' · ')}>
                              {strip.elements.join(' · ') || 'None flagged'}
                            </div>
                          </div>

                          <div>
                            <b className="text-[10px] tracking-wider opacity-60 uppercase">STUNTS / VFX</b>
                            <div className="mt-1 font-medium truncate" title={`${strip.stunts} · ${strip.vfx}`}>
                              {strip.stunts} · {strip.vfx}
                            </div>
                          </div>
                        </div>

                        {/* SOUND & NOTES FOOTER */}
                        {(strip.notes || strip.sound) && (
                          <div className="mt-3 border-t border-black/10 pt-2 text-[11px] opacity-75 flex flex-wrap gap-x-3">
                            {strip.sound && <span><b>Sound:</b> {strip.sound}</span>}
                            {strip.notes && <span><b>Notes:</b> {strip.notes}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-8 text-center text-xs text-slate-500">
          {projectName} · Stripboard updates and reorders are saved automatically
        </div>
      </div>
    </div>
  );
};

export default StripboardView;
