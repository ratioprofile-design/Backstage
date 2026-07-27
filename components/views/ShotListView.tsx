import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Shot } from '../../types';
import { generateShotDivisionPreview, predictNextShotSummary } from '../../services/gemini';
import { 
  Film, Sparkles, Plus, Trash2, Edit3, ArrowUp, ArrowDown, Copy, 
  CheckCircle2, AlertTriangle, Eye, Layers, Camera, Wand2, Sliders, 
  ChevronDown, ChevronUp, Check, X, RefreshCw, MoveRight, HelpCircle, 
  Clapperboard, Play, Lightbulb
} from 'lucide-react';

const SHOT_SIZES = [
  'EXTREME WIDE', 'WIDE', 'MEDIUM WIDE', 'MEDIUM', 
  'MEDIUM CLOSE UP', 'CLOSE UP', 'EXTREME CLOSE UP', 
  'OVER THE SHOULDER', 'POV', 'TWO SHOT'
];

const CAMERA_ANGLES = [
  'EYE LEVEL', 'LOW ANGLE', 'HIGH ANGLE', 
  'DUTCH ANGLE', 'BIRD\'S EYE', 'WORM\'S EYE'
];

const CAMERA_MOVEMENTS = [
  'Static', 'Dolly In', 'Dolly Out', 'Slow Pan', 'Tilt', 
  'Tracking Shot', 'Handheld', 'Steadicam', 'Crane / Jib', 'Whip Pan'
];

const LENS_OPTIONS = [
  '18mm Ultra Wide', '24mm Wide', '35mm Prime', '50mm Standard', 
  '85mm Anamorphic', '105mm Macro', '70-200mm Telephoto'
];

const STYLE_PRESETS = [
  { id: 'Cinematic Pace', label: 'Cinematic Pace', desc: 'Balanced dynamic coverage with wide establishing and intimate closeups.' },
  { id: 'Classic Hollywood', label: 'Classic Hollywood', desc: 'Master shot establishing coverage followed by matching OTS and reaction shots.' },
  { id: 'Intimate & Handheld', label: 'Intimate & Handheld', desc: 'Handheld raw motion focusing on character micro-expressions.' },
  { id: 'High Tension & Thriller', label: 'High Tension', desc: 'Unsettling Dutch angles, tight ECU inserts, and rapid cuts.' }
];

interface ShotListViewProps {
  onNavigateToStoryboard?: () => void;
}

export const ShotListView: React.FC<ShotListViewProps> = ({ onNavigateToStoryboard }) => {
  const { 
    beats, 
    generatedShots, 
    setGeneratedShots, 
    storyboardConfig,
    captureSnapshot,
    characterData
  } = useProject();

  // Active Scene Filter
  const [selectedSceneId, setSelectedSceneId] = useState<string>('ALL');
  
  // Searching & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'ALL' | 'ai-batch' | 'ai-modified' | 'manual'>('ALL');

  // Shot Form State (Adding / Editing)
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [isAddingShot, setIsAddingShot] = useState<boolean>(false);
  
  const [formShot, setFormShot] = useState<Partial<Shot>>({
    shotSize: 'MEDIUM',
    angle: 'EYE LEVEL',
    subject: '',
    description: '',
    lens: '35mm Prime',
    movement: 'Static',
    durationSec: 3,
    equipment: 'Tripod',
    scriptReference: '',
    notes: '',
    sourceType: 'manual'
  });

  // AI Prediction State for Form
  const [aiPredicting, setAiPredicting] = useState<boolean>(false);
  const [aiPrediction, setAiPrediction] = useState<{
    description: string;
    subject: string;
    lens: string;
    movement: string;
    scriptReference: string;
  } | null>(null);

  // AI Division Preview Window Modal State
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewStyle, setPreviewStyle] = useState<string>('Cinematic Pace');
  const [isPreviewGenerating, setIsPreviewGenerating] = useState<boolean>(false);
  const [proposedShots, setProposedShots] = useState<any[]>([]);
  const [selectedProposedIndices, setSelectedProposedIndices] = useState<Set<number>>(new Set());

  // Scene Script Drawer
  const [showScriptDrawer, setShowScriptDrawer] = useState<boolean>(false);

  // Extract Scene Beats from project
  const sceneBeats = useMemo(() => {
    return beats.map((beat, idx) => {
      const sceneNum = beat.sceneNumber ? String(beat.sceneNumber) : `${idx + 1}`;
      const prefix = beat.slug?.prefix ? String(beat.slug.prefix).toUpperCase() : 'INT';
      const location = beat.slug?.location ? String(beat.slug.location).toUpperCase() : 'UNTITLED LOCATION';
      const time = beat.slug?.time ? String(beat.slug.time).toUpperCase() : 'DAY';
      const heading = `${prefix} ${location} - ${time}`;
      
      // Extract text content cleanly
      const div = document.createElement('div');
      div.innerHTML = beat.content || '';
      const rawText = div.textContent || '';
      
      // Extract character names (capitalized words in lines)
      const characterMatches = Array.from(new Set(rawText.match(/\b[A-Z]{2,}\b/g) || []))
        .filter(name => !['INT', 'EXT', 'DAY', 'NIGHT', 'CONTINUOUS', 'AFTERNOON', 'MORNING', 'EVENING'].includes(name));

      return {
        id: String(beat.id),
        sceneNum,
        prefix,
        heading,
        location,
        time,
        rawText,
        summary: beat.summary || 'No summary available.',
        characters: characterMatches
      };
    });
  }, [beats]);

  // Unified List of Movie Characters across Project & Scenes
  const movieCharacters = useMemo(() => {
    const set = new Set<string>();
    const excludeWords = new Set([
      'INT', 'EXT', 'DAY', 'NIGHT', 'CONTINUOUS', 'MORNING', 'EVENING', 'AFTERNOON',
      'SCENE', 'SHOT', 'ALL', 'NONE', 'CUT TO', 'FADE IN', 'DISSOLVE', 'CAMERA',
      'CLOSE UP', 'WIDE SHOT', 'MEDIUM SHOT', 'ESTABLISHING', 'INSERT', 'MONTAGE',
      'TRANSITION', 'TITLE', 'CREDITS', 'VO', 'OS', 'VOICE', 'OVER', 'OFF', 'SCREEN'
    ]);

    const sanitize = (val: string) => {
      if (!val || typeof val !== 'string') return '';
      // Strip parenthetical notes like (V.O.), (O.S.), (CONT'D), (1), etc.
      let clean = val.replace(/\s*\([^)]*\)/g, '').trim();
      // Remove trailing punctuation
      clean = clean.replace(/[:.,;!?]+$/, '').trim();
      return clean;
    };

    if (characterData) {
      Object.values(characterData).forEach((c: any) => {
        const name = sanitize(c?.name || '');
        if (name) set.add(name);
      });
      Object.keys(characterData).forEach(k => {
        const name = sanitize(k);
        if (name) set.add(name);
      });
    }

    sceneBeats.forEach(sb => {
      (sb.characters || []).forEach(c => {
        const name = sanitize(c);
        if (name) set.add(name);
      });
    });

    return Array.from(set)
      .filter(name => {
        if (!name || name.length < 2 || name.length > 25) return false;
        if (name.split(/\s+/).length > 3) return false;
        const upper = name.toUpperCase();
        if (excludeWords.has(upper)) return false;
        if (upper.startsWith('INT.') || upper.startsWith('EXT.')) return false;
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [characterData, sceneBeats]);

  // Helper to resolve Scene Number for any shot
  const getSceneNum = (shot: Shot) => {
    if (shot.scene) {
      const sb = sceneBeats.find(b => String(b.id) === String(shot.scene) || b.sceneNum === String(shot.scene));
      if (sb) return sb.sceneNum;
      return String(shot.scene);
    }
    if (currentSceneObj) return currentSceneObj.sceneNum;
    return '1';
  };

  // Selected Scene Object
  const currentSceneObj = useMemo(() => {
    if (selectedSceneId === 'ALL') return null;
    return sceneBeats.find(s => s.id === selectedSceneId) || null;
  }, [selectedSceneId, sceneBeats]);

  // Filtered Shots
  const activeShots = useMemo(() => {
    return generatedShots.filter(shot => {
      // Scene filter
      if (selectedSceneId !== 'ALL') {
        const matchScene = String(shot.scene) === String(selectedSceneId) || String(shot.scene) === currentSceneObj?.sceneNum;
        if (!matchScene) return false;
      }
      // Source filter
      if (filterSource !== 'ALL') {
        const src = shot.sourceType || 'manual';
        if (src !== filterSource) return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textToSearch = `${shot.shotSize} ${shot.angle} ${shot.subject} ${shot.description} ${shot.scriptReference || ''} ${shot.notes || ''}`.toLowerCase();
        if (!textToSearch.includes(q)) return false;
      }
      return true;
    });
  }, [generatedShots, selectedSceneId, currentSceneObj, filterSource, searchQuery]);

  // Attention Index & Audit Metrics
  const auditMetrics = useMemo(() => {
    const relevantShots = selectedSceneId === 'ALL' 
      ? generatedShots 
      : generatedShots.filter(s => String(s.scene) === String(selectedSceneId) || String(s.scene) === currentSceneObj?.sceneNum);
    
    const total = relevantShots.length;
    if (total === 0) {
      return { total: 0, aiBatchCount: 0, aiModifiedCount: 0, manualCount: 0, attentionPercent: 100 };
    }

    let aiBatchCount = 0;
    let aiModifiedCount = 0;
    let manualCount = 0;

    relevantShots.forEach(s => {
      const src = s.sourceType || 'manual';
      if (src === 'ai-batch') aiBatchCount++;
      else if (src === 'ai-modified') aiModifiedCount++;
      else manualCount++;
    });

    // Attention Percent = % of shots that are either manual or modified by human
    const reviewedCount = manualCount + aiModifiedCount;
    const attentionPercent = Math.round((reviewedCount / total) * 100);

    return { total, aiBatchCount, aiModifiedCount, manualCount, attentionPercent };
  }, [generatedShots, selectedSceneId, currentSceneObj]);

  // Handle Form Input Change with Auto-Marking AI (Modified)
  const handleFormFieldChange = (field: keyof Shot, value: any) => {
    setFormShot(prev => {
      const next = { ...prev, [field]: value };
      // If shot was ai-batch and modified, switch to ai-modified
      if (next.sourceType === 'ai-batch') {
        next.sourceType = 'ai-modified';
      }
      return next;
    });
  };

  // Real-time AI Prediction as user types/edits
  const handleTriggerPrediction = async () => {
    if (!currentSceneObj) return;
    setAiPredicting(true);
    setAiPrediction(null);
    try {
      const result = await predictNextShotSummary(
        currentSceneObj.heading,
        currentSceneObj.rawText,
        activeShots,
        {
          shotSize: formShot.shotSize,
          angle: formShot.angle,
          subject: formShot.subject,
          description: formShot.description
        }
      );
      if (result) {
        setAiPrediction(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiPredicting(false);
    }
  };

  const handleApplyPrediction = () => {
    if (!aiPrediction) return;
    setFormShot(prev => ({
      ...prev,
      description: aiPrediction.description || prev.description,
      subject: aiPrediction.subject || prev.subject,
      lens: aiPrediction.lens || prev.lens,
      movement: aiPrediction.movement || prev.movement,
      scriptReference: aiPrediction.scriptReference || prev.scriptReference,
      sourceType: prev.sourceType === 'ai-batch' ? 'ai-modified' : (prev.sourceType || 'manual')
    }));
    setAiPrediction(null);
  };

  // Save Shot (New or Edited)
  const handleSaveShotForm = () => {
    if (!formShot.description?.trim() && !formShot.subject?.trim()) {
      alert("Please provide at least a subject or visual description.");
      return;
    }

    captureSnapshot();

    if (editingShotId) {
      // Edit existing
      setGeneratedShots(prev => prev.map(s => {
        if (s.id === editingShotId) {
          const updatedSrc = s.sourceType === 'ai-batch' ? 'ai-modified' : (formShot.sourceType || s.sourceType || 'manual');
          return {
            ...s,
            ...formShot,
            sourceType: updatedSrc
          } as Shot;
        }
        return s;
      }));
      setEditingShotId(null);
    } else {
      // Add new
      const newShot: Shot = {
        id: `shot-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        shotSize: formShot.shotSize || 'MEDIUM',
        angle: formShot.angle || 'EYE LEVEL',
        description: formShot.description || '',
        subject: formShot.subject || '',
        lens: formShot.lens || '35mm Prime',
        movement: formShot.movement || 'Static',
        durationSec: formShot.durationSec || 3,
        equipment: formShot.equipment || 'Tripod',
        scriptReference: formShot.scriptReference || '',
        notes: formShot.notes || '',
        scene: selectedSceneId !== 'ALL' ? (currentSceneObj?.sceneNum || selectedSceneId) : '1',
        sourceType: formShot.sourceType || 'manual',
        imageHistory: []
      };
      setGeneratedShots(prev => [...prev, newShot]);
      setIsAddingShot(false);
    }

    // Reset Form
    setFormShot({
      shotSize: 'MEDIUM',
      angle: 'EYE LEVEL',
      subject: '',
      description: '',
      lens: '35mm Prime',
      movement: 'Static',
      durationSec: 3,
      equipment: 'Tripod',
      scriptReference: '',
      notes: '',
      sourceType: 'manual'
    });
    setAiPrediction(null);
  };

  // Edit Shot Trigger
  const handleStartEdit = (shot: Shot) => {
    setEditingShotId(shot.id);
    setIsAddingShot(false);
    setFormShot({
      shotSize: shot.shotSize,
      angle: shot.angle,
      subject: shot.subject,
      description: shot.description,
      lens: shot.lens || '35mm Prime',
      movement: shot.movement || 'Static',
      durationSec: shot.durationSec || 3,
      equipment: shot.equipment || 'Tripod',
      scriptReference: shot.scriptReference || '',
      notes: shot.notes || '',
      sourceType: shot.sourceType || 'manual'
    });
  };

  // Delete Shot
  const handleDeleteShot = (id: string) => {
    if (confirm("Delete this shot division entry?")) {
      captureSnapshot();
      setGeneratedShots(prev => prev.filter(s => s.id !== id));
    }
  };

  // Move Shot Order
  const handleMoveShot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeShots.length) return;

    captureSnapshot();
    const newShots = [...generatedShots];
    const shotA = activeShots[index];
    const shotB = activeShots[targetIndex];

    const idxA = newShots.findIndex(s => s.id === shotA.id);
    const idxB = newShots.findIndex(s => s.id === shotB.id);

    if (idxA !== -1 && idxB !== -1) {
      const temp = newShots[idxA];
      newShots[idxA] = newShots[idxB];
      newShots[idxB] = temp;
      setGeneratedShots(newShots);
    }
  };

  // AI Division Preview Generator
  const handleGenerateAIPreview = async () => {
    const sceneToAnalyze = currentSceneObj || sceneBeats[0];
    if (!sceneToAnalyze) {
      alert("No screenplay scene available for AI Shot Division.");
      return;
    }

    setIsPreviewGenerating(true);
    setProposedShots([]);
    try {
      const rawShots = await generateShotDivisionPreview(
        sceneToAnalyze.heading,
        sceneToAnalyze.rawText,
        previewStyle,
        storyboardConfig.textModel || 'gemini-3-flash-preview'
      );

      const formatted = rawShots.map((s, idx) => ({
        id: `ai-prop-${Date.now()}-${idx}`,
        shotSize: s.shotSize || 'MEDIUM',
        angle: s.angle || 'EYE LEVEL',
        lens: s.lens || '35mm Prime',
        movement: s.movement || 'Static',
        subject: s.subject || 'Subject',
        description: s.description || '',
        scriptReference: s.scriptReference || '',
        durationSec: s.durationSec || 4,
        reasoning: s.reasoning || 'Cinematic coverage for beat.',
        scene: sceneToAnalyze.sceneNum,
        sourceType: 'ai-batch' as const
      }));

      setProposedShots(formatted);
      setSelectedProposedIndices(new Set(formatted.map((_, i) => i)));
    } catch (e) {
      console.error(e);
      alert("Error generating AI Shot Division preview.");
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  // Apply AI Division Batch from Preview Modal
  const handleApplyAIPreview = (mode: 'replace' | 'append') => {
    if (proposedShots.length === 0) return;

    const selectedShots = proposedShots.filter((_, i) => selectedProposedIndices.has(i));
    if (selectedShots.length === 0) {
      alert("Please select at least one shot from the preview.");
      return;
    }

    captureSnapshot();
    const targetSceneNum = currentSceneObj ? currentSceneObj.sceneNum : (sceneBeats[0]?.sceneNum || '1');

    const formattedNewShots: Shot[] = selectedShots.map(s => ({
      id: `shot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      shotSize: s.shotSize,
      angle: s.angle,
      description: s.description,
      subject: s.subject,
      lens: s.lens,
      movement: s.movement,
      durationSec: s.durationSec,
      scriptReference: s.scriptReference,
      reasoning: s.reasoning,
      scene: targetSceneNum,
      sourceType: 'ai-batch',
      imageHistory: []
    }));

    if (mode === 'replace') {
      // Remove existing shots for this scene and insert new AI batch
      setGeneratedShots(prev => [
        ...prev.filter(s => String(s.scene) !== String(targetSceneNum) && String(s.scene) !== selectedSceneId),
        ...formattedNewShots
      ]);
    } else {
      // Append
      setGeneratedShots(prev => [...prev, ...formattedNewShots]);
    }

    setShowPreviewModal(false);
  };

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-gray-200 font-sans flex flex-col overflow-hidden">
      
      {/* TOP HEADER BAR */}
      <div className="h-14 border-b border-[#222] bg-[#111] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#f5a623]/10 text-[#f5a623] rounded-lg border border-[#f5a623]/20">
            <Clapperboard size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              Shot Division Studio
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                DIRECTOR DESK
              </span>
            </h1>
            <p className="text-[11px] text-gray-500">Break down script scenes into precise camera shots & monitor AI coverage</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowPreviewModal(true);
              if (proposedShots.length === 0) handleGenerateAIPreview();
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800 hover:to-indigo-800 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-purple-950/40"
          >
            <Sparkles size={14} className="text-purple-400 animate-pulse" />
            AI Division Batch
          </button>

          <button
            onClick={() => {
              setIsAddingShot(true);
              setEditingShotId(null);
              setFormShot({
                shotSize: 'MEDIUM',
                angle: 'EYE LEVEL',
                subject: '',
                description: '',
                lens: '35mm Prime',
                movement: 'Static',
                durationSec: 3,
                equipment: 'Tripod',
                scriptReference: '',
                notes: '',
                sourceType: 'manual'
              });
            }}
            className="px-3 py-1.5 bg-[#f5a623] hover:bg-[#e0951a] text-black rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={14} />
            Add Custom Shot
          </button>

          <button
            onClick={() => onNavigateToStoryboard?.()}
            className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 border border-[#333] hover:border-gray-500 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Film size={14} className="text-[#f5a623]" />
            Storyboard Page
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR: SCENE SELECTOR & SCRIPT DETAILS */}
        <div className="w-80 border-r border-[#222] bg-[#0d0d0d] flex flex-col shrink-0">
          
          {/* Scene Grid Selector Header */}
          <div className="p-4 border-b border-[#222]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                Select Screenplay Scene
              </label>
              <span className="text-[10px] text-[#f5a623] font-mono font-bold bg-[#f5a623]/10 px-2 py-0.5 rounded border border-[#f5a623]/20">
                {sceneBeats.length} SCENES
              </span>
            </div>

            {/* Grid of Scene Cards - Ultra-compact Calendar Style */}
            <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto p-0.5 custom-scrollbar">
              {/* ALL SCENES Tile */}
              <button
                type="button"
                onClick={() => setSelectedSceneId('ALL')}
                title="ALL SCENES (Entire Project Overview)"
                className={`h-7 rounded-md border font-mono text-center transition-all flex items-center justify-center p-0.5 ${
                  selectedSceneId === 'ALL'
                    ? 'bg-[#f5a623] text-black font-black border-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.4)] scale-95'
                    : 'bg-[#141414] border-[#222] text-gray-400 hover:bg-[#1f1f1f] hover:border-gray-500 hover:text-white'
                }`}
              >
                <span className="text-[9px] font-black uppercase tracking-tighter">ALL</span>
              </button>

              {/* Individual Scene Number Tiles */}
              {sceneBeats.map(s => {
                const isSelected = selectedSceneId === s.id;
                const isExt = s.prefix.includes('EXT');
                const isNight = s.time.includes('NIGHT') || s.time.includes('DUSK') || s.time.includes('EVENING');

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSceneId(s.id)}
                    title={`SCENE #${s.sceneNum}: ${s.prefix} ${s.location} - ${s.time}`}
                    className={`h-7 rounded-md border transition-all flex flex-col items-center justify-between p-0.5 relative group font-mono ${
                      isSelected
                        ? 'bg-[#f5a623]/25 border-[#f5a623] text-white shadow-[0_0_10px_rgba(245,166,35,0.35)] ring-1 ring-[#f5a623] scale-95'
                        : 'bg-[#141414] border-[#222] text-gray-300 hover:bg-[#1c1c1c] hover:border-gray-500'
                    }`}
                  >
                    {/* Tiny Top Color Bar for INT vs EXT */}
                    <div 
                      className={`w-full h-[2px] rounded-full ${
                        isExt ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                    />

                    {/* Scene Number */}
                    <span className={`text-[11px] font-black leading-none ${isSelected ? 'text-[#f5a623]' : 'text-white'}`}>
                      {s.sceneNum}
                    </span>

                    {/* Bottom Indicator Dots: Left Dot = INT/EXT, Right Dot = DAY/NIGHT */}
                    <div className="flex items-center gap-0.5">
                      <span 
                        className={`w-1 h-1 rounded-full ${
                          isExt ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`} 
                        title={isExt ? 'EXTERIOR' : 'INTERIOR'}
                      />
                      <span 
                        className={`w-1 h-1 rounded-full ${
                          isNight ? 'bg-indigo-400' : 'bg-amber-400'
                        }`} 
                        title={isNight ? 'NIGHT' : 'DAY'}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scene General Details Card */}
          {currentSceneObj ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* Scene Card */}
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#f5a623] bg-[#f5a623]/10 border border-[#f5a623]/20 px-2 py-0.5 rounded font-mono">
                    SCENE #{currentSceneObj.sceneNum}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {currentSceneObj.time}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white uppercase tracking-wide font-mono leading-snug">
                  {currentSceneObj.heading}
                </h3>

                <p className="text-[11px] text-gray-400 italic line-clamp-3 leading-relaxed">
                  "{currentSceneObj.summary}"
                </p>

                {/* Characters Present */}
                <div>
                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Characters in Scene
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentSceneObj.characters.length > 0 ? (
                      currentSceneObj.characters.map(c => (
                        <span key={c} className="text-[10px] bg-[#222] border border-[#333] text-gray-300 px-2 py-0.5 rounded-full font-mono">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-gray-600 italic">No character cues detected</span>
                    )}
                  </div>
                </div>

                {/* Toggle Script Reader */}
                <button
                  onClick={() => setShowScriptDrawer(!showScriptDrawer)}
                  className="w-full py-1.5 bg-[#1e1e1e] hover:bg-[#282828] text-gray-300 border border-[#333] rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye size={12} />
                  {showScriptDrawer ? 'Hide Script Content' : 'Read Scene Script'}
                </button>
              </div>

              {/* Script Drawer */}
              {showScriptDrawer && (
                <div className="bg-[#050505] border border-[#222] rounded-xl p-3 text-xs font-mono text-gray-300 max-h-60 overflow-y-auto leading-relaxed custom-scrollbar whitespace-pre-wrap">
                  {currentSceneObj.rawText}
                </div>
              )}

              {/* Attention Index Audit Panel */}
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Sliders size={12} className="text-[#f5a623]" />
                    Attention Audit Meter
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    auditMetrics.attentionPercent >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                    auditMetrics.attentionPercent >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {auditMetrics.attentionPercent}% Reviewed
                  </span>
                </div>

                {/* Meter Bar */}
                <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden flex">
                  <div 
                    style={{ width: `${(auditMetrics.manualCount / (auditMetrics.total || 1)) * 100}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Manual: ${auditMetrics.manualCount}`}
                  />
                  <div 
                    style={{ width: `${(auditMetrics.aiModifiedCount / (auditMetrics.total || 1)) * 100}%` }}
                    className="bg-cyan-500 h-full"
                    title={`AI Modified: ${auditMetrics.aiModifiedCount}`}
                  />
                  <div 
                    style={{ width: `${(auditMetrics.aiBatchCount / (auditMetrics.total || 1)) * 100}%` }}
                    className="bg-purple-500 h-full animate-pulse"
                    title={`AI Unreviewed Batch: ${auditMetrics.aiBatchCount}`}
                  />
                </div>

                {/* Audit Legend */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-[9px] font-mono">
                  <div className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    Manual ({auditMetrics.manualCount})
                  </div>
                  <div className="text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block"></span>
                    Modified ({auditMetrics.aiModifiedCount})
                  </div>
                  <div className="text-purple-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
                    Unreviewed ({auditMetrics.aiBatchCount})
                  </div>
                </div>

                {auditMetrics.aiBatchCount > 0 && (
                  <div className="p-2 bg-purple-950/40 border border-purple-500/30 rounded-lg text-[10px] text-purple-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-purple-400 mt-0.5" />
                    <span>
                      {auditMetrics.aiBatchCount} shot(s) are raw AI batch output. Edit or inspect them to mark as director-approved.
                    </span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-xs">
              Showing project-wide shots. Select a specific scene on top to unlock scene script context and attention audit metrics.
            </div>
          )}

        </div>

        {/* CENTER CONTENT: SHOT DIVISION LIST & EDITING */}
        <div className="flex-1 flex flex-col bg-[#080808] overflow-hidden">
          
          {/* SEARCH & FILTER BAR */}
          <div className="p-3 border-b border-[#222] bg-[#111] flex items-center justify-between gap-4">
            
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search shot descriptions, lens, subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1a1a1a] border border-[#333] focus:border-[#f5a623] text-gray-200 text-xs px-3 py-1.5 rounded-lg w-72 outline-none"
            />

            {/* Source Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-[#2a2a2a]">
              {(['ALL', 'manual', 'ai-modified', 'ai-batch'] as const).map(src => (
                <button
                  key={src}
                  onClick={() => setFilterSource(src)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    filterSource === src 
                      ? src === 'ai-batch' ? 'bg-purple-600 text-white' :
                        src === 'ai-modified' ? 'bg-cyan-600 text-white' :
                        src === 'manual' ? 'bg-emerald-600 text-white' : 'bg-[#333] text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {src === 'ALL' ? 'All Sources' :
                   src === 'ai-batch' ? '⚡ AI Batch' :
                   src === 'ai-modified' ? '✏️ AI (Modified)' : '👤 Manual'}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500 font-mono">
              Total Shots: <span className="text-white font-bold">{activeShots.length}</span>
            </div>
          </div>

          {/* SHOT LIST CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            
            {/* NEW SHOT FORM CONTAINER (Top) */}
            {isAddingShot && (
              <div className="bg-[#121212] border-2 border-[#f5a623] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-[#222] pb-3">
                  <h3 className="text-xs font-bold text-[#f5a623] uppercase tracking-wider flex items-center gap-2">
                    <Camera size={16} />
                    Create New Custom Shot Entry
                  </h3>
                  <button 
                    type="button"
                    onClick={() => { setIsAddingShot(false); setEditingShotId(null); }}
                    className="text-gray-500 hover:text-white p-1"
                    title="Close form"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Shot Name & Character Subject */}
                <div>
                  <label className="text-[10px] font-bold text-[#f5a623] uppercase tracking-wider block mb-1">
                    Shot Focus / Subject (Movie Character)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {movieCharacters.length > 0 && (
                      <select
                        value={movieCharacters.includes(formShot.subject || '') ? (formShot.subject || '') : ''}
                        onChange={(e) => handleFormFieldChange('subject', e.target.value)}
                        className="bg-[#1c1c1c] border border-[#333] text-white text-xs font-mono rounded-lg p-2.5 outline-none focus:border-[#f5a623] sm:w-56"
                      >
                        <option value="">-- Select Character --</option>
                        {movieCharacters.map(char => (
                          <option key={char} value={char}>{char}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      placeholder="Or type custom subject (e.g. Hero Close-up, Maya Reaction, Envelope Insert)..."
                      value={formShot.subject || ''}
                      onChange={(e) => handleFormFieldChange('subject', e.target.value)}
                      className="flex-1 bg-[#1c1c1c] border border-[#f5a623]/50 focus:border-[#f5a623] text-white text-xs font-mono font-bold rounded-lg p-2.5 outline-none shadow-inner"
                    />
                  </div>
                </div>

                {/* Form Controls Grid */}
                <div className="grid grid-cols-4 gap-3">
                  {/* Shot Size */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Shot Size</label>
                    <select
                      value={formShot.shotSize || 'MEDIUM'}
                      onChange={(e) => handleFormFieldChange('shotSize', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    >
                      {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Camera Angle */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Camera Angle</label>
                    <select
                      value={formShot.angle || 'EYE LEVEL'}
                      onChange={(e) => handleFormFieldChange('angle', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    >
                      {CAMERA_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  {/* Lens */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Lens Choice</label>
                    <select
                      value={formShot.lens || '35mm Prime'}
                      onChange={(e) => handleFormFieldChange('lens', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    >
                      {LENS_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  {/* Camera Movement */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Camera Movement</label>
                    <select
                      value={formShot.movement || 'Static'}
                      onChange={(e) => handleFormFieldChange('movement', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    >
                      {CAMERA_MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Duration & Equipment */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Est. Duration (Sec)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={formShot.durationSec || 3}
                      onChange={(e) => handleFormFieldChange('durationSec', Number(e.target.value))}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Equipment / Rig</label>
                    <input
                      type="text"
                      placeholder="e.g. Tripod, Steadicam, Gimbal, Dolly"
                      value={formShot.equipment || 'Tripod'}
                      onChange={(e) => handleFormFieldChange('equipment', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                    />
                  </div>
                </div>

                {/* Description Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visual Action & Framing Summary</label>
                    
                    <button
                      type="button"
                      onClick={handleTriggerPrediction}
                      disabled={aiPredicting || !currentSceneObj}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase flex items-center gap-1 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded transition-all"
                    >
                      <Wand2 size={10} className={aiPredicting ? "animate-spin" : ""} />
                      {aiPredicting ? 'AI Reading Scene...' : 'AI Guess Shot Intent'}
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Describe the action, emotional tone, composition..."
                    value={formShot.description || ''}
                    onChange={(e) => handleFormFieldChange('description', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2.5 outline-none focus:border-[#f5a623]"
                  />
                </div>

                {/* AI PREDICTION CHIP BOX */}
                {aiPrediction && (
                  <div className="p-3 bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 rounded-xl space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-300 uppercase flex items-center gap-1.5">
                        <Sparkles size={12} className="text-purple-400" />
                        AI Directorial Suggestion
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyPrediction}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        Apply AI Suggestion
                      </button>
                    </div>

                    <p className="text-xs text-purple-100 font-sans italic">
                      "{aiPrediction.description}"
                    </p>

                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-purple-300/80 pt-1">
                      <span>Target: <b>{aiPrediction.subject}</b></span> • 
                      <span>Lens: <b>{aiPrediction.lens}</b></span> • 
                      <span>Movement: <b>{aiPrediction.movement}</b></span>
                    </div>
                  </div>
                )}

                {/* Script Line Reference */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Screenplay Line Reference</label>
                  <input
                    type="text"
                    placeholder='e.g. Dialogue line: "I never said I loved you."'
                    value={formShot.scriptReference || ''}
                    onChange={(e) => handleFormFieldChange('scriptReference', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222]">
                  <button
                    type="button"
                    onClick={() => { setIsAddingShot(false); setEditingShotId(null); }}
                    className="px-4 py-2 bg-[#222] hover:bg-[#333] text-gray-300 rounded-lg text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveShotForm}
                    className="px-5 py-2 bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                  >
                    <Check size={14} />
                    Save New Shot
                  </button>
                </div>
              </div>
            )}

            {/* CARDS LIST */}
            {activeShots.length > 0 ? (
              <div className="space-y-3">
                {activeShots.map((shot, idx) => {
                  const src = shot.sourceType || 'manual';
                  const shotName = shot.subject || `${shot.shotSize} ${shot.angle} Shot`;
                  const isBeingEdited = editingShotId === shot.id;

                  if (isBeingEdited) {
                    return (
                      <div key={shot.id} className="bg-[#121212] border-2 border-[#f5a623] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-[#222] pb-3">
                          <h3 className="text-xs font-bold text-[#f5a623] uppercase tracking-wider flex items-center gap-2">
                            <Camera size={16} />
                            Editing Shot #{idx + 1}
                          </h3>
                          <button 
                            type="button"
                            onClick={() => setEditingShotId(null)}
                            className="text-gray-500 hover:text-white p-1"
                            title="Cancel editing"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Shot Name & Character Subject */}
                        <div>
                          <label className="text-[10px] font-bold text-[#f5a623] uppercase tracking-wider block mb-1">
                            Shot Focus / Subject (Movie Character)
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            {movieCharacters.length > 0 && (
                              <select
                                value={movieCharacters.includes(formShot.subject || '') ? (formShot.subject || '') : ''}
                                onChange={(e) => handleFormFieldChange('subject', e.target.value)}
                                className="bg-[#1c1c1c] border border-[#333] text-white text-xs font-mono rounded-lg p-2.5 outline-none focus:border-[#f5a623] sm:w-56"
                              >
                                <option value="">-- Select Character --</option>
                                {movieCharacters.map(char => (
                                  <option key={char} value={char}>{char}</option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              placeholder="Or type custom subject (e.g. Hero Close-up, Maya Reaction, Envelope Insert)..."
                              value={formShot.subject || ''}
                              onChange={(e) => handleFormFieldChange('subject', e.target.value)}
                              className="flex-1 bg-[#1c1c1c] border border-[#f5a623]/50 focus:border-[#f5a623] text-white text-xs font-mono font-bold rounded-lg p-2.5 outline-none shadow-inner"
                            />
                          </div>
                        </div>

                        {/* Form Controls Grid */}
                        <div className="grid grid-cols-4 gap-3">
                          {/* Shot Size */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Shot Size</label>
                            <select
                              value={formShot.shotSize || 'MEDIUM'}
                              onChange={(e) => handleFormFieldChange('shotSize', e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            >
                              {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>

                          {/* Camera Angle */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Camera Angle</label>
                            <select
                              value={formShot.angle || 'EYE LEVEL'}
                              onChange={(e) => handleFormFieldChange('angle', e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            >
                              {CAMERA_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>

                          {/* Lens */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Lens Choice</label>
                            <select
                              value={formShot.lens || '35mm Prime'}
                              onChange={(e) => handleFormFieldChange('lens', e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            >
                              {LENS_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>

                          {/* Camera Movement */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Camera Movement</label>
                            <select
                              value={formShot.movement || 'Static'}
                              onChange={(e) => handleFormFieldChange('movement', e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            >
                              {CAMERA_MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Duration & Equipment */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Est. Duration (Sec)</label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={formShot.durationSec || 3}
                              onChange={(e) => handleFormFieldChange('durationSec', Number(e.target.value))}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Equipment / Rig</label>
                            <input
                              type="text"
                              placeholder="e.g. Tripod, Steadicam, Gimbal, Dolly"
                              value={formShot.equipment || 'Tripod'}
                              onChange={(e) => handleFormFieldChange('equipment', e.target.value)}
                              className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                            />
                          </div>
                        </div>

                        {/* Description Textarea */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visual Action & Framing Summary</label>
                            
                            <button
                              type="button"
                              onClick={handleTriggerPrediction}
                              disabled={aiPredicting || !currentSceneObj}
                              className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase flex items-center gap-1 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded transition-all"
                            >
                              <Wand2 size={10} className={aiPredicting ? "animate-spin" : ""} />
                              {aiPredicting ? 'AI Reading Scene...' : 'AI Guess Shot Intent'}
                            </button>
                          </div>

                          <textarea
                            rows={2}
                            placeholder="Describe the action, emotional tone, composition..."
                            value={formShot.description || ''}
                            onChange={(e) => handleFormFieldChange('description', e.target.value)}
                            className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2.5 outline-none focus:border-[#f5a623]"
                          />
                        </div>

                        {/* AI PREDICTION CHIP BOX */}
                        {aiPrediction && (
                          <div className="p-3 bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 rounded-xl space-y-2 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-300 uppercase flex items-center gap-1.5">
                                <Sparkles size={12} className="text-purple-400" />
                                AI Directorial Suggestion
                              </span>
                              <button
                                type="button"
                                onClick={handleApplyPrediction}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                              >
                                Apply AI Suggestion
                              </button>
                            </div>

                            <p className="text-xs text-purple-100 font-sans italic">
                              "{aiPrediction.description}"
                            </p>

                            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-purple-300/80 pt-1">
                              <span>Target: <b>{aiPrediction.subject}</b></span> • 
                              <span>Lens: <b>{aiPrediction.lens}</b></span> • 
                              <span>Movement: <b>{aiPrediction.movement}</b></span>
                            </div>
                          </div>
                        )}

                        {/* Script Line Reference */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Screenplay Line Reference</label>
                          <input
                            type="text"
                            placeholder='e.g. Dialogue line: "I never said I loved you."'
                            value={formShot.scriptReference || ''}
                            onChange={(e) => handleFormFieldChange('scriptReference', e.target.value)}
                            className="w-full bg-[#1c1c1c] border border-[#333] text-white text-xs rounded-lg p-2 outline-none focus:border-[#f5a623]"
                          />
                        </div>

                        {/* Form Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222]">
                          <button
                            type="button"
                            onClick={() => setEditingShotId(null)}
                            className="px-4 py-2 bg-[#222] hover:bg-[#333] text-gray-300 rounded-lg text-xs font-bold uppercase"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveShotForm}
                            className="px-5 py-2 bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                          >
                            <Check size={14} />
                            Update Shot Entry
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={shot.id} 
                      onDoubleClick={() => handleStartEdit(shot)}
                      className="bg-[#18181c] border border-[#2a2a32] rounded-xl p-4 hover:border-[#f5a623]/60 transition-colors group relative cursor-pointer select-none"
                      title="Double-click card to edit shot"
                    >
                      {/* Top Bar: Scene Number, Shot Number, Name, Action Buttons */}
                      <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-[#262630]">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Scene Number Badge */}
                          <span className="h-6 px-2 bg-[#1d1d28] border border-[#2d2d3e] text-cyan-400 font-mono text-[11px] font-bold rounded flex items-center justify-center shrink-0">
                            SCENE {getSceneNum(shot)}
                          </span>

                          {/* Shot Number Badge */}
                          <span className="h-6 px-2 bg-[#22222b] border border-[#333342] text-[#f5a623] font-mono text-xs font-bold rounded flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>

                          {/* Shot Title / Name */}
                          <span className="text-sm font-semibold text-white tracking-tight truncate font-mono">
                            {shotName}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveShot(idx, 'up'); }}
                            disabled={idx === 0}
                            className="p-1.5 bg-[#22222a] hover:bg-[#2c2c38] text-gray-400 hover:text-white rounded border border-[#333342] disabled:opacity-30 transition-colors"
                            title="Move Shot Up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveShot(idx, 'down'); }}
                            disabled={idx === activeShots.length - 1}
                            className="p-1.5 bg-[#22222a] hover:bg-[#2c2c38] text-gray-400 hover:text-white rounded border border-[#333342] disabled:opacity-30 transition-colors"
                            title="Move Shot Down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(shot); }}
                            className="p-1.5 bg-[#22222a] hover:bg-[#2c2c38] text-gray-300 hover:text-white border border-[#333342] rounded transition-colors"
                            title="Edit Shot"
                          >
                            <Edit3 size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteShot(shot.id); }}
                            className="p-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-900/40 rounded transition-colors"
                            title="Delete Shot"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Technical Specs row */}
                      <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-gray-300 mb-2.5">
                        <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-white font-bold">
                          {shot.shotSize}
                        </span>

                        <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-gray-300">
                          {shot.angle}
                        </span>

                        {shot.lens && (
                          <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-gray-400">
                            Lens: {shot.lens}
                          </span>
                        )}

                        {shot.movement && (
                          <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-gray-400">
                            Move: {shot.movement}
                          </span>
                        )}

                        {shot.durationSec && (
                          <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-gray-400">
                            {shot.durationSec}s
                          </span>
                        )}

                        {shot.equipment && (
                          <span className="px-2 py-0.5 bg-[#22222a] border border-[#333342] rounded text-gray-400">
                            {shot.equipment}
                          </span>
                        )}

                        {/* Source tag */}
                        <span className="ml-auto text-[10px] text-gray-500 font-mono uppercase">
                          {src === 'ai-batch' ? 'AI' : src === 'ai-modified' ? 'AI (Edited)' : 'Manual'}
                        </span>
                      </div>

                      {/* Description & Script Context */}
                      <div className="space-y-2 text-xs text-gray-300">
                        {shot.subject && (
                          <div className="text-gray-400 font-mono text-[11px] flex items-center gap-1.5">
                            <span className="uppercase text-[9px] text-gray-500 font-bold tracking-wider">Subject:</span>
                            <span className="text-[#f5a623] font-semibold">{shot.subject}</span>
                          </div>
                        )}
                        {shot.description ? (
                          <p className="leading-relaxed text-gray-200">
                            {shot.description}
                          </p>
                        ) : (
                          <p className="italic text-gray-600 text-[11px]">
                            No visual description added.
                          </p>
                        )}

                        {shot.scriptReference && (
                          <div className="pl-2.5 border-l-2 border-[#f5a623] text-gray-400 italic font-mono text-[11px] py-0.5">
                            "{shot.scriptReference}"
                          </div>
                        )}

                        {shot.reasoning && (
                          <div className="text-[11px] text-purple-300/80 font-mono pt-1">
                            Rationale: {shot.reasoning}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 border-2 border-dashed border-[#222] rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Clapperboard size={36} className="text-gray-600" />
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">No Shot Divisions Created</h3>
                <p className="text-xs text-gray-600 max-w-sm">
                  Click "Add Custom Shot" above to manually add camera shots, or use "AI Division Batch" to generate automatic scene shot division suggestions.
                </p>
                <button
                  onClick={() => {
                    setShowPreviewModal(true);
                    if (proposedShots.length === 0) handleGenerateAIPreview();
                  }}
                  className="px-4 py-2 bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  <Sparkles size={14} className="text-purple-400" />
                  Run AI Division Batch
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* AI DIVISION BATCH PREVIEW WINDOW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[5000] flex items-center justify-center p-6">
          <div className="bg-[#101010] border border-[#333] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-[#222] bg-[#161616] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-950 border border-purple-500/30 text-purple-400 rounded-xl">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    AI Shot Division Preview Window
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Preview AI proposed camera shot coverage before applying to your project shot list
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-[#222]"
              >
                <X size={18} />
              </button>
            </div>

            {/* PREVIEW CONTROLS BAR */}
            <div className="p-4 border-b border-[#222] bg-[#121212] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase">Style Preset:</span>
                <div className="flex gap-2">
                  {STYLE_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPreviewStyle(p.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                        previewStyle === p.id 
                          ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                          : 'bg-[#1e1e1e] text-gray-400 border-[#333] hover:text-white'
                      }`}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateAIPreview}
                disabled={isPreviewGenerating}
                className="px-3.5 py-1.5 bg-[#222] hover:bg-[#333] text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={12} className={isPreviewGenerating ? "animate-spin" : ""} />
                Regenerate AI Preview
              </button>
            </div>

            {/* PREVIEW CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
              
              {isPreviewGenerating ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw size={32} className="animate-spin text-purple-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-purple-200">Analyzing Scene & Generating Shot Division...</p>
                </div>
              ) : proposedShots.length > 0 ? (
                <div className="space-y-3">
                  
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Proposed Shots ({proposedShots.length}) — Review & Select Shots to Apply:
                    </span>
                    <button
                      onClick={() => {
                        if (selectedProposedIndices.size === proposedShots.length) {
                          setSelectedProposedIndices(new Set());
                        } else {
                          setSelectedProposedIndices(new Set(proposedShots.map((_, i) => i)));
                        }
                      }}
                      className="text-xs text-gray-400 hover:text-white underline font-mono"
                    >
                      {selectedProposedIndices.size === proposedShots.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {proposedShots.map((s, i) => {
                    const isSelected = selectedProposedIndices.has(i);
                    return (
                      <div 
                        key={s.id}
                        onClick={() => {
                          const next = new Set(selectedProposedIndices);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          setSelectedProposedIndices(next);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-950/20 border-purple-500/60 shadow-lg' 
                            : 'bg-[#151515] border-[#252525] opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          
                          {/* Checkbox */}
                          <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-purple-600 border-purple-400 text-white' : 'bg-[#222] border-[#444]'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>

                          <div className="flex-1 space-y-1">
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-purple-400 font-mono">
                                  SHOT #{i + 1}
                                </span>
                                <span className="text-xs font-bold text-white bg-[#222] px-2 py-0.5 rounded border border-[#333]">
                                  {s.shotSize}
                                </span>
                                <span className="text-xs text-gray-300 bg-[#222] px-2 py-0.5 rounded border border-[#333]">
                                  {s.angle}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono bg-[#222] px-2 py-0.5 rounded border border-[#333]">
                                  📷 {s.lens}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono bg-[#222] px-2 py-0.5 rounded border border-[#333]">
                                  🎥 {s.movement}
                                </span>
                              </div>

                              <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                                Tagged as: ⚡ AI Batch
                              </span>
                            </div>

                            <p className="text-xs text-gray-200 pt-1 leading-relaxed">
                              {s.description}
                            </p>

                            {s.scriptReference && (
                              <div className="text-[11px] text-gray-400 italic pt-0.5">
                                Line: "{s.scriptReference}"
                              </div>
                            )}

                            {s.reasoning && (
                              <div className="text-[10px] text-purple-300/80 font-mono pt-1 flex items-center gap-1">
                                <Lightbulb size={11} className="text-purple-400" />
                                Rationale: {s.reasoning}
                              </div>
                            )}

                          </div>

                        </div>
                      </div>
                    );
                  })}

                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 text-xs">
                  No preview generated yet. Click "Regenerate AI Preview" above.
                </div>
              )}

            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t border-[#222] bg-[#161616] flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-400 font-mono">
                {selectedProposedIndices.size} of {proposedShots.length} shot(s) selected
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 bg-[#222] hover:bg-[#333] text-gray-300 rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>

                <button
                  onClick={() => handleApplyAIPreview('append')}
                  disabled={selectedProposedIndices.size === 0}
                  className="px-4 py-2 bg-[#222] hover:bg-[#333] text-purple-200 border border-purple-500/30 rounded-lg text-xs font-bold uppercase disabled:opacity-30 transition-colors"
                >
                  Append Selected
                </button>

                <button
                  onClick={() => handleApplyAIPreview('replace')}
                  disabled={selectedProposedIndices.size === 0}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg disabled:opacity-30 transition-all"
                >
                  <Check size={14} />
                  Apply & Replace Scene Shots
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ShotListView;
