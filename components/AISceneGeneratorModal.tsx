import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Zap, X, Film, Sparkles, Check, Layers, Sliders, Play } from 'lucide-react';

interface AISceneGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISceneGeneratorModal: React.FC<AISceneGeneratorModalProps> = ({ isOpen, onClose }) => {
  const { autoGenerateScenes } = useProject();
  const [selectedCount, setSelectedCount] = useState<5 | 20 | 50>(20);
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = (count: 5 | 20 | 50) => {
    setIsGenerating(true);
    setTimeout(() => {
      autoGenerateScenes(count);
      setIsGenerating(false);
      onClose();
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[#1a1a1a] border border-[#3d3d3d] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d2d] bg-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-500/30 text-[#f5a623]">
              <Zap size={20} className="fill-[#f5a623]/30" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                AI Scene Generator & Feature Test
                <span className="text-[10px] font-black tracking-widest uppercase bg-[#f5a623]/20 text-[#f5a623] px-2 py-0.5 rounded border border-[#f5a623]/40">
                  Sequencer
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Populate your story board with screenplay beats, acts, character rosters, and breakdown data.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Custom Topic Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#f5a623]" />
                Story Concept or Genre (Optional)
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Preset AI Generator</span>
            </label>
            <input 
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Cyberpunk Heist, Film Noir Detective, Deep Space Thriller..."
              className="w-full bg-[#111] border border-[#333] focus:border-[#f5a623] rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none transition-colors"
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 5 SCENES */}
            <div 
              onClick={() => setSelectedCount(5)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedCount === 5 
                  ? 'bg-[#252018] border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)]' 
                  : 'bg-[#141414] border-[#2d2d2d] hover:border-[#444] hover:bg-[#1a1a1a]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">5 Scenes</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">
                    Quick
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Showcase Structure</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                  5 Act breakdown (Setup, Rising Action, Midpoint, Climax, Epilogue). Ideal for rapid board testing.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Layers size={11} /> 5 Acts</span>
                <span className="flex items-center gap-1"><Film size={11} /> 1 Board Row</span>
              </div>
            </div>

            {/* 20 SCENES */}
            <div 
              onClick={() => setSelectedCount(20)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedCount === 20 
                  ? 'bg-[#252018] border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)]' 
                  : 'bg-[#141414] border-[#2d2d2d] hover:border-[#444] hover:bg-[#1a1a1a]'
              }`}
            >
              <div className="absolute -top-2.5 right-3 bg-[#f5a623] text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                Recommended
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">20 Scenes</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                    Standard
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Feature Outline</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                  20 scenes formatted with sluglines, dialogue, script breakdown elements, and character profiles.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Layers size={11} /> 5 Acts</span>
                <span className="flex items-center gap-1"><Film size={11} /> 20 Connected Beats</span>
              </div>
            </div>

            {/* 50 SCENES */}
            <div 
              onClick={() => setSelectedCount(50)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selectedCount === 50 
                  ? 'bg-[#252018] border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)]' 
                  : 'bg-[#141414] border-[#2d2d2d] hover:border-[#444] hover:bg-[#1a1a1a]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">50 Scenes</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono">
                    Full Feature
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Epic Script Arc</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                  50 scenes spanning 10 Acts across 2 canvas rows. Tests large board navigation, breakdown, and export.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2a2a2a] flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Layers size={11} /> 10 Acts</span>
                <span className="flex items-center gap-1"><Film size={11} /> 50 Connected Beats</span>
              </div>
            </div>
          </div>

          {/* Detailed Features List */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3.5 space-y-2">
            <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={12} className="text-[#f5a623]" />
              What will be populated on your project:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Act Groups with color coding</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Formatted Screenplay dialogue HTML</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Sequential story connections</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Script Breakdown (Cast, Props, VFX)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Character Profiles & Archetypes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-400" />
                <span>Director Notes & Version Logs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2d2d2d] bg-[#222]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={() => handleGenerate(selectedCount)}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#f5a623] to-[#e08b10] hover:from-[#fcae2b] hover:to-[#ef9418] text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <span>Generating {selectedCount} Scenes...</span>
            ) : (
              <>
                <Zap size={15} className="fill-black" />
                Generate {selectedCount} Scenes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
