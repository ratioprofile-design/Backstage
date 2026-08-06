import React from 'react';
import { PenLine, Film } from 'lucide-react';

interface DualViewToggleProps {
  activeView: 'characterdesign' | 'casting';
  isLight: boolean;
  onToggle: (view: 'characterdesign' | 'casting') => void;
}

const DualViewToggle: React.FC<DualViewToggleProps> = ({ activeView, isLight, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(activeView === 'characterdesign' ? 'casting' : 'characterdesign')}
    className={`relative w-[64px] h-[28px] rounded-none border transition-all select-none shrink-0 ${
      isLight
        ? 'bg-slate-200 border-slate-400 hover:border-amber-500 shadow-inner'
        : 'bg-[#181a22] border-slate-700 hover:border-amber-500/70'
    }`}
    title={activeView === 'characterdesign' ? 'Switch to Casting View (Director)' : 'Switch to Character Design View (Writer)'}
  >
    {/* Sliding Knob */}
    <span
      className={`absolute top-[2px] bottom-[2px] w-[28px] rounded-none bg-amber-500 shadow-md flex items-center justify-center transition-all duration-300 ${
        activeView === 'characterdesign' ? 'left-[2px]' : 'left-[32px]'
      }`}
    >
      {activeView === 'characterdesign' ? (
        <PenLine size={13} strokeWidth={2.5} className="text-black" />
      ) : (
        <Film size={13} strokeWidth={2.5} className="text-black" />
      )}
    </span>
    {/* Left: Character Design (Writer) */}
    <span className={`absolute inset-y-0 left-0 w-[30px] flex items-center justify-center pointer-events-none ${
      activeView === 'characterdesign' ? 'text-black' : 'text-slate-500'
    }`}>
      <PenLine size={13} strokeWidth={2.5} />
    </span>
    {/* Right: Casting (Director) */}
    <span className={`absolute inset-y-0 right-0 w-[32px] flex items-center justify-center pointer-events-none ${
      activeView === 'characterdesign' ? 'text-slate-500' : 'text-black'
    }`}>
      <Film size={13} strokeWidth={2.5} />
    </span>
  </button>
);

export default DualViewToggle;
