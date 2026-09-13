import React, { useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  X, Settings, Layout, AlignJustify, Columns, Sun, Moon, Monitor,
  Palette, Check, ExternalLink, Sparkles, Pipette
} from 'lucide-react';
import { ACCENT_COLORS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToBackstage?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNavigateToBackstage
}) => {
  const {
    navLayout = 'horizontal', setNavLayout,
    appTheme = 'dark', setAppTheme,
    appAccentColor = '#f5a623', setAppAccentColor
  } = useProject();

  const isLight = appTheme === 'light';

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-xl shadow-2xl border overflow-hidden flex flex-col transition-all ${
          isLight
            ? 'bg-white border-gray-200 text-gray-800'
            : 'bg-[#141417] border-[#2e2e34] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isLight ? 'border-gray-200 bg-gray-50' : 'border-[#26262c] bg-[#101013]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: `${appAccentColor}18`,
                borderColor: `${appAccentColor}40`,
                color: appAccentColor
              }}
            >
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">App Preferences</h3>
              <p className="text-[11px] font-mono text-gray-400">Navigation layout, theme & accents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-[#25252b]'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* 1. NAVIGATION LAYOUT SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Layout size={14} style={{ color: appAccentColor }} /> Navigation Layout
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Choose between top navigation header or a vertical sidebar.
                </p>
              </div>
              <span
                className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border"
                style={{
                  backgroundColor: `${appAccentColor}15`,
                  borderColor: `${appAccentColor}40`,
                  color: appAccentColor
                }}
              >
                {navLayout === 'vertical' ? 'Vertical Sidebar' : 'Horizontal Top Bar'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              {/* Option 1: Horizontal Top Bar */}
              <div
                onClick={() => setNavLayout('horizontal')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between group relative overflow-hidden ${
                  navLayout === 'horizontal'
                    ? 'border-amber-500 bg-amber-500/5 shadow-md'
                    : isLight
                      ? 'border-gray-200 hover:border-gray-300 bg-gray-50'
                      : 'border-[#26262c] hover:border-[#383842] bg-[#19191e]'
                }`}
                style={{
                  borderColor: navLayout === 'horizontal' ? appAccentColor : undefined
                }}
              >
                {/* Wireframe Preview Graphic */}
                <div className={`w-full h-20 rounded border mb-3 p-1.5 flex flex-col gap-1 overflow-hidden ${
                  isLight ? 'bg-white border-gray-200' : 'bg-[#0f0f12] border-[#2a2a30]'
                }`}>
                  {/* Top Bar Wireframe (Highlighted) */}
                  <div
                    className="w-full h-4 rounded flex items-center justify-between px-1.5 shadow-sm"
                    style={{ backgroundColor: appAccentColor }}
                  >
                    <div className="w-8 h-1.5 bg-black/60 rounded-full" />
                    <div className="flex gap-1">
                      <div className="w-3 h-1 bg-black/40 rounded-full" />
                      <div className="w-3 h-1 bg-black/40 rounded-full" />
                      <div className="w-3 h-1 bg-black/40 rounded-full" />
                    </div>
                  </div>
                  {/* Content Wireframe */}
                  <div className="flex-1 rounded flex gap-1 p-1 opacity-40">
                    <div className="w-1/3 h-full rounded bg-gray-500/20" />
                    <div className="w-2/3 h-full rounded bg-gray-500/20" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider">Horizontal Top Bar</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">Classic header tab switcher</div>
                  </div>
                  {navLayout === 'horizontal' && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-black font-bold"
                      style={{ backgroundColor: appAccentColor }}
                    >
                      <Check size={12} />
                    </div>
                  )}
                </div>
              </div>

              {/* Option 2: Vertical Sidebar */}
              <div
                onClick={() => setNavLayout('vertical')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between group relative overflow-hidden ${
                  navLayout === 'vertical'
                    ? 'border-amber-500 bg-amber-500/5 shadow-md'
                    : isLight
                      ? 'border-gray-200 hover:border-gray-300 bg-gray-50'
                      : 'border-[#26262c] hover:border-[#383842] bg-[#19191e]'
                }`}
                style={{
                  borderColor: navLayout === 'vertical' ? appAccentColor : undefined
                }}
              >
                {/* Wireframe Preview Graphic */}
                <div className={`w-full h-20 rounded border mb-3 flex overflow-hidden ${
                  isLight ? 'bg-white border-gray-200' : 'bg-[#0f0f12] border-[#2a2a30]'
                }`}>
                  {/* Left Sidebar Wireframe (Highlighted) */}
                  <div
                    className="w-10 h-full p-1.5 flex flex-col justify-between shadow-sm"
                    style={{ backgroundColor: appAccentColor }}
                  >
                    <div className="w-full h-2 bg-black/60 rounded-full" />
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-black/40 rounded-full" />
                      <div className="w-full h-1 bg-black/40 rounded-full" />
                      <div className="w-full h-1 bg-black/40 rounded-full" />
                    </div>
                    <div className="w-full h-1 bg-black/30 rounded-full" />
                  </div>
                  {/* Right Content Wireframe */}
                  <div className="flex-1 p-1.5 flex flex-col gap-1 opacity-40">
                    <div className="w-full h-2 rounded bg-gray-500/20" />
                    <div className="flex-1 rounded bg-gray-500/10" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider">Vertical Sidebar</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">Modern left navigation rail</div>
                  </div>
                  {navLayout === 'vertical' && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-black font-bold"
                      style={{ backgroundColor: appAccentColor }}
                    >
                      <Check size={12} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. THEME MODE */}
          <div className="pt-4 border-t border-[#26262c]">
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 mb-2">
              <Sun size={14} style={{ color: appAccentColor }} /> Theme Mode
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark' as const, label: 'Dark', icon: Moon, desc: 'High-contrast dark' },
                { id: 'light' as const, label: 'Light', icon: Sun, desc: 'Clean daylight' },
                { id: 'system' as const, label: 'System', icon: Monitor, desc: 'Match OS' },
              ].map(themeItem => {
                const Icon = themeItem.icon;
                const isSelected = appTheme === themeItem.id;
                return (
                  <button
                    key={themeItem.id}
                    onClick={() => setAppTheme(themeItem.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-2 font-bold shadow-md'
                        : isLight
                          ? 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                          : 'border-[#26262c] bg-[#19191e] hover:bg-[#202026] text-gray-300'
                    }`}
                    style={{
                      borderColor: isSelected ? appAccentColor : undefined,
                      backgroundColor: isSelected ? `${appAccentColor}10` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon size={16} style={{ color: isSelected ? appAccentColor : undefined }} />
                      {isSelected && <Check size={13} style={{ color: appAccentColor }} />}
                    </div>
                    <div className="text-xs font-bold uppercase">{themeItem.label}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{themeItem.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. ACCENT COLOR */}
          <div className="pt-4 border-t border-[#26262c]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <Palette size={14} style={{ color: appAccentColor }} /> Accent Color
              </h4>
              <span className="text-[11px] font-mono text-gray-400">{appAccentColor}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_COLORS.map(c => {
                const isSelected = appAccentColor.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.name}
                    onClick={() => setAppAccentColor(c.value)}
                    className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center hover:scale-110 ${
                      isSelected ? 'ring-2 ring-white border-transparent scale-110' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {isSelected && <Check size={12} className="text-black font-bold" />}
                  </button>
                );
              })}

              {/* Custom Picker */}
              <label
                className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform relative overflow-hidden bg-gradient-to-tr from-pink-500 via-amber-400 to-blue-500"
                title="Custom Color"
              >
                <input
                  type="color"
                  value={appAccentColor.startsWith('#') && appAccentColor.length === 7 ? appAccentColor : '#f5a623'}
                  onChange={e => setAppAccentColor(e.target.value)}
                  className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
                />
                <Pipette size={11} className="text-white drop-shadow" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between ${
            isLight ? 'border-gray-200 bg-gray-50' : 'border-[#26262c] bg-[#101013]'
          }`}
        >
          <button
            onClick={() => {
              onClose();
              onNavigateToBackstage?.();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-amber-400 transition-colors"
          >
            <ExternalLink size={13} />
            Open Full Backstage Suite
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-black transition-all hover:brightness-110"
            style={{ backgroundColor: appAccentColor }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};