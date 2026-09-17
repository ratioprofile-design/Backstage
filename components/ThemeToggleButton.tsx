import React, { useState, useEffect, useRef } from 'react';
import {
  Sun, Moon, Sparkles, Check,
  CircleDot, MoveRight, MoveDown, Slash, Diamond, Layers
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ThemeAnimationStyle } from '../types';

interface ThemeToggleButtonProps {
  variant?: 'header' | 'sidebar' | 'pill';
  className?: string;
  size?: number;
}

const ANIM_STYLE_NAMES: Record<ThemeAnimationStyle, { name: string; icon: React.ComponentType<any> }> = {
  circle: { name: 'Radial Bloom', icon: CircleDot },
  'wipe-right': { name: 'Cinematic Wipe', icon: MoveRight },
  'wipe-down': { name: 'Curtain Drop', icon: MoveDown },
  diagonal: { name: 'Diagonal Slice', icon: Slash },
  diamond: { name: 'Diamond Iris', icon: Diamond },
  dissolve: { name: 'Soft Dissolve', icon: Layers },
};

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  variant = 'header',
  className = '',
  size = 16,
}) => {
  const {
    appTheme,
    setAppTheme,
    appAccentColor = '#f5a623',
    themeAnimationStyle = 'circle',
    setThemeAnimationStyle,
  } = useProject();

  const isLight = appTheme === 'light';
  const [clicked, setClicked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside or escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setClicked(true);
    setTimeout(() => setClicked(false), 600);

    const nextTheme = isLight ? 'dark' : 'light';
    setAppTheme(nextTheme, e);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    // Position below button
    const left = Math.min(rect.left, window.innerWidth - 200);
    const top = rect.bottom + 6;

    setMenuPos({ top, left });
    setMenuOpen(true);
  };

  const activeInfo = ANIM_STYLE_NAMES[themeAnimationStyle] || ANIM_STYLE_NAMES.circle;

  const buttonTooltip = `Switch to ${isLight ? 'Dark' : 'Light'} Mode [Style: ${activeInfo.name}] • Right-click to change animation`;

  const renderDropdown = () => {
    if (!menuOpen) return null;

    return (
      <div
        ref={menuRef}
        className="fixed z-[9999] w-52 rounded-xl shadow-2xl border p-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(20, 20, 24, 0.96)',
          borderColor: isLight ? '#e2e8f0' : '#2e2e34',
          color: isLight ? '#1e293b' : '#f1f5f9',
        }}
      >
        <div className="px-2 py-1.5 mb-1 border-b border-gray-500/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-400">
            <Sparkles size={12} style={{ color: appAccentColor }} />
            <span>Animation Style</span>
          </div>
        </div>

        <div className="space-y-0.5">
          {(Object.keys(ANIM_STYLE_NAMES) as ThemeAnimationStyle[]).map((styleId) => {
            const item = ANIM_STYLE_NAMES[styleId];
            const Icon = item.icon;
            const isSelected = themeAnimationStyle === styleId;

            return (
              <button
                key={styleId}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeAnimationStyle(styleId);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  isSelected
                    ? 'font-bold'
                    : isLight
                      ? 'hover:bg-gray-100 text-gray-700'
                      : 'hover:bg-[#282830] text-gray-300'
                }`}
                style={{
                  backgroundColor: isSelected ? `${appAccentColor}15` : undefined,
                  color: isSelected ? appAccentColor : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: isSelected ? appAccentColor : undefined }} />
                  <span>{item.name}</span>
                </div>
                {isSelected && <Check size={13} style={{ color: appAccentColor }} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className={`relative p-1.5 rounded-lg transition-all duration-200 group overflow-hidden flex items-center justify-center ${
            isLight
              ? 'text-gray-600 hover:text-amber-600 hover:bg-gray-200/80'
              : 'text-gray-400 hover:text-amber-400 hover:bg-[#1e1e24]'
          } ${className}`}
          title={buttonTooltip}
          aria-label={buttonTooltip}
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Moon Icon (Visible in Dark Mode) */}
            <Moon
              size={size}
              className={`absolute inset-0 m-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isLight
                  ? '-rotate-90 scale-0 opacity-0'
                  : 'rotate-0 scale-100 opacity-100 text-amber-400 group-hover:drop-shadow-[0_0_8px_rgba(245,166,35,0.6)]'
              }`}
            />
            {/* Sun Icon (Visible in Light Mode) */}
            <Sun
              size={size}
              className={`absolute inset-0 m-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isLight
                  ? 'rotate-0 scale-100 opacity-100 text-amber-500 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'rotate-90 scale-0 opacity-0'
              }`}
            />
          </div>

          {/* Micro ripple burst inside button on click */}
          {clicked && (
            <span className="absolute inset-0 rounded-lg bg-amber-400/20 animate-ping pointer-events-none" />
          )}
        </button>
        {renderDropdown()}
      </>
    );
  }

  // Header / Standard Variant
  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`relative w-9 h-9 rounded-[4px] border flex items-center justify-center transition-all duration-200 shadow-xs group overflow-hidden ${
          isLight
            ? 'bg-slate-100/90 border-slate-300 hover:border-[#f5a623] hover:bg-slate-200/70 text-amber-600'
            : 'bg-[#222] border-[#3d3d3d] hover:border-[#f5a623] hover:bg-[#282828] text-amber-400 hover:text-amber-300'
        } ${className}`}
        title={buttonTooltip}
        aria-label={buttonTooltip}
      >
        <div className="relative w-4 h-4 flex items-center justify-center pointer-events-none">
          {/* Moon Icon (Visible in Dark Mode) */}
          <Moon
            size={size}
            className={`absolute inset-0 m-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isLight
                ? '-rotate-90 scale-0 opacity-0'
                : 'rotate-0 scale-100 opacity-100 text-amber-400 group-hover:drop-shadow-[0_0_8px_rgba(245,166,35,0.7)]'
            }`}
          />
          {/* Sun Icon (Visible in Light Mode) */}
          <Sun
            size={size}
            className={`absolute inset-0 m-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isLight
                ? 'rotate-0 scale-100 opacity-100 text-amber-500 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                : 'rotate-90 scale-0 opacity-0'
            }`}
          />
        </div>

        {/* Micro ripple burst on click */}
        {clicked && (
          <span className="absolute inset-0 rounded-[4px] bg-amber-400/25 animate-ping pointer-events-none" />
        )}
      </button>
      {renderDropdown()}
    </>
  );
};
