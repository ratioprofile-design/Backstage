import React from 'react';
import {
  X,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import { ScriptConfig, ScriptElementConfig } from '../types';
import { AVAILABLE_ENGLISH_FONTS } from '../constants';

interface CharacterStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptConfig: ScriptConfig;
  onUpdateCharacterConfig: (updates: Partial<ScriptElementConfig>) => void;
  appAccentColor?: string;
  isLight?: boolean;
}

const PRESET_COLORS = [
  { id: 'default', label: 'Theme Default', value: '#000000', darkValue: '#e2e8f0', bg: 'bg-gradient-to-tr from-zinc-700 to-zinc-400' },
  { id: 'amber', label: 'Amber Gold', value: '#f5a623', bg: 'bg-amber-400' },
  { id: 'sky', label: 'Sky Blue', value: '#38bdf8', bg: 'bg-sky-400' },
  { id: 'emerald', label: 'Emerald Green', value: '#34d399', bg: 'bg-emerald-400' },
  { id: 'rose', label: 'Coral Rose', value: '#fb7185', bg: 'bg-rose-400' },
  { id: 'violet', label: 'Purple Violet', value: '#a78bfa', bg: 'bg-violet-400' },
  { id: 'white', label: 'Pure White', value: '#ffffff', bg: 'bg-white border border-zinc-400' },
  { id: 'black', label: 'Jet Black', value: '#050505', bg: 'bg-black border border-zinc-700' },
];

export const CharacterStyleModal: React.FC<CharacterStyleModalProps> = ({
  isOpen,
  onClose,
  scriptConfig,
  onUpdateCharacterConfig,
  appAccentColor = '#f5a623',
  isLight = false,
}) => {
  if (!isOpen) return null;

  const charConfig = scriptConfig.character || {
    marginLeft: 35,
    width: 40,
    marginTop: 0.4,
    marginBottom: 0,
    fontSize: 13,
    fontFamily: 'Courier Prime',
    textAlign: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    bold: true,
    italic: false,
    underline: false,
    color: '#000000',
    highlightColor: null,
    textTransform: 'uppercase',
  };

  const handleReset = () => {
    onUpdateCharacterConfig({
      marginLeft: 35,
      width: 40,
      marginTop: 0.4,
      marginBottom: 0,
      fontSize: 13,
      fontFamily: 'Courier Prime',
      textAlign: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
      bold: true,
      italic: false,
      underline: false,
      color: '#000000',
      highlightColor: null,
      textTransform: 'uppercase',
    });
  };

  const fontOptions = AVAILABLE_ENGLISH_FONTS;

  const currentTransform = (charConfig as any).textTransform || 'uppercase';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#18181c] border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800/80 bg-zinc-900/40'
        }`}>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center text-black font-black"
              style={{ backgroundColor: appAccentColor }}
            >
              <Type size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Character Element Styling</h2>
              <p className="text-[11px] text-zinc-400">Configure font, size, casing & positioning for script character names</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          
          {/* 1. Font Family */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Font Family</span>
              <span className="text-[10px] text-amber-500 font-mono">Meera Inimai (Tamil) Recommended</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {fontOptions.map((f) => {
                const isSelected = charConfig.fontFamily === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => onUpdateCharacterConfig({ fontFamily: f.value })}
                    className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 font-bold shadow-xs'
                        : isLight
                          ? 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                          : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300'
                    }`}
                    style={isSelected ? { borderColor: appAccentColor } : undefined}
                  >
                    <span 
                      className="truncate text-[12px]" 
                      style={{ fontFamily: f.value === 'Meera Inimai' ? `'Meera Inimai', sans-serif` : f.value }}
                    >
                      {f.label}
                    </span>
                    {isSelected && <Check size={13} style={{ color: appAccentColor }} className="shrink-0 ml-1 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Font Size & Casing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Font Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <span>Font Size</span>
                <span className="font-mono text-amber-400 font-bold">{charConfig.fontSize}px</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[11, 12, 13, 14, 16, 18].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onUpdateCharacterConfig({ fontSize: size })}
                    className={`flex-1 py-1.5 rounded-lg font-mono font-bold text-[11px] transition-all cursor-pointer ${
                      charConfig.fontSize === size
                        ? 'bg-amber-500 text-black shadow-xs font-black'
                        : isLight
                          ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                    }`}
                    style={charConfig.fontSize === size ? { backgroundColor: appAccentColor } : undefined}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Casing / Text Transform */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Text Casing
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-xl border border-zinc-700/60 bg-zinc-800/40">
                <button
                  type="button"
                  onClick={() => onUpdateCharacterConfig({ textTransform: 'uppercase' })}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    currentTransform === 'uppercase'
                      ? 'bg-amber-500 text-black shadow-xs font-black'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentTransform === 'uppercase' ? { backgroundColor: appAccentColor } : undefined}
                  title="UPPERCASE: Hollywood script standard"
                >
                  <span>UPPERCASE</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCharacterConfig({ textTransform: 'none' })}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    currentTransform === 'none'
                      ? 'bg-amber-500 text-black shadow-xs font-black'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={currentTransform === 'none' ? { backgroundColor: appAccentColor } : undefined}
                  title="Normal / As-Typed: Essential for Tamil & Unicode"
                >
                  <span>Normal (Tamil)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Weight, Style, and Alignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Weight & Style Buttons */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Style & Emphasis
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateCharacterConfig({ bold: !charConfig.bold })}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    charConfig.bold
                      ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-black shadow-xs'
                      : isLight
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Bold size={13} strokeWidth={3} />
                  <span>Bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCharacterConfig({ italic: !charConfig.italic })}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    charConfig.italic
                      ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-black shadow-xs'
                      : isLight
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Italic size={13} strokeWidth={2.5} />
                  <span>Italic</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCharacterConfig({ underline: !charConfig.underline })}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    charConfig.underline
                      ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-black shadow-xs'
                      : isLight
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Underline size={13} strokeWidth={2.5} />
                  <span>Line</span>
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Text Alignment
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'left', label: 'Left', icon: AlignLeft },
                  { id: 'center', label: 'Center', icon: AlignCenter },
                  { id: 'right', label: 'Right', icon: AlignRight },
                ].map((align) => {
                  const AlignIcon = align.icon;
                  const isSelected = (charConfig.textAlign || 'left') === align.id;
                  return (
                    <button
                      key={align.id}
                      type="button"
                      onClick={() => onUpdateCharacterConfig({ textAlign: align.id })}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-black shadow-xs'
                          : isLight
                            ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <AlignIcon size={13} />
                      <span>{align.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Text Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span>Character Name Color</span>
              <span className="font-mono text-zinc-300 font-bold">{charConfig.color || 'Default'}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {PRESET_COLORS.map((c) => {
                const isSelected = (charConfig.color || '#000000') === c.value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdateCharacterConfig({ color: c.value })}
                    className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center relative ${
                      isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={c.label}
                  >
                    {isSelected && <Check size={13} className="text-black drop-shadow stroke-[3]" />}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="color"
                  value={charConfig.color || '#f5a623'}
                  onChange={(e) => onUpdateCharacterConfig({ color: e.target.value })}
                  className="w-7 h-7 rounded-lg border border-zinc-700 bg-transparent cursor-pointer p-0.5"
                  title="Pick Custom Color"
                />
              </div>
            </div>
          </div>

          {/* 5. Left Indent & Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                <span>Left Indent:</span>
                <span className="font-mono text-amber-400">{charConfig.marginLeft}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="70"
                step="1"
                value={charConfig.marginLeft}
                onChange={(e) => onUpdateCharacterConfig({ marginLeft: parseInt(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                <span>Block Width:</span>
                <span className="font-mono text-amber-400">{charConfig.width}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="1"
                value={charConfig.width}
                onChange={(e) => onUpdateCharacterConfig({ width: parseInt(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 6. Live Interactive Preview */}
          <div className={`p-4 rounded-xl border space-y-2 select-none ${
            isLight ? 'bg-zinc-100/90 border-zinc-200' : 'bg-black/60 border-zinc-800'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" /> Live Screenplay Preview
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {charConfig.fontFamily} • {charConfig.fontSize}px
              </span>
            </div>
            
            {/* English character preview */}
            <div 
              style={{
                fontFamily: charConfig.fontFamily === 'Meera Inimai' ? `'Meera Inimai', monospace` : `'${charConfig.fontFamily}', monospace`,
                fontSize: `${charConfig.fontSize}px`,
                fontWeight: charConfig.bold ? 'bold' : 'normal',
                fontStyle: charConfig.italic ? 'italic' : 'normal',
                textDecoration: charConfig.underline ? 'underline' : 'none',
                textAlign: (charConfig.textAlign as any) || 'left',
                color: charConfig.color && charConfig.color !== '#000000' && charConfig.color !== '#ffffff' ? charConfig.color : (isLight ? '#0f172a' : '#f1f5f9'),
                textTransform: currentTransform as any,
                letterSpacing: `${charConfig.letterSpacing || 0}px`,
                marginLeft: `${Math.min(charConfig.marginLeft, 35)}%`,
              }}
            >
              DETECTIVE VAIBHAV (V.O.)
            </div>

            {/* Tamil character preview */}
            <div 
              style={{
                fontFamily: charConfig.fontFamily === 'Meera Inimai' ? `'Meera Inimai', sans-serif` : `'${charConfig.fontFamily}', 'Meera Inimai', sans-serif`,
                fontSize: `${charConfig.fontSize}px`,
                fontWeight: charConfig.bold ? 'bold' : 'normal',
                fontStyle: charConfig.italic ? 'italic' : 'normal',
                textDecoration: charConfig.underline ? 'underline' : 'none',
                textAlign: (charConfig.textAlign as any) || 'left',
                color: charConfig.color && charConfig.color !== '#000000' && charConfig.color !== '#ffffff' ? charConfig.color : (isLight ? '#0f172a' : '#f1f5f9'),
                textTransform: currentTransform as any,
                letterSpacing: `${charConfig.letterSpacing || 0}px`,
                marginLeft: `${Math.min(charConfig.marginLeft, 35)}%`,
              }}
            >
              ரங்கா (குரல்)
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'
        }`}>
          <button
            type="button"
            onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isLight ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl font-bold text-xs text-black transition-all cursor-pointer shadow-sm hover:opacity-95"
            style={{ backgroundColor: appAccentColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
