import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { ThemeAnimationStyle } from '../types';
import {
  CircleDot,
  MoveRight,
  MoveDown,
  Slash,
  Diamond,
  Layers,
  Play,
  Check,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export interface ThemeAnimationOption {
  id: ThemeAnimationStyle;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  previewCss: string;
}

export const THEME_ANIMATION_OPTIONS: ThemeAnimationOption[] = [
  {
    id: 'circle',
    name: 'Radial Bloom',
    tagline: 'Circular ripple wave',
    description: 'Expands smoothly in a 360° circular wave outward from your click coordinate.',
    badge: 'Standard',
    icon: CircleDot,
    previewCss: 'radial-gradient(circle, rgba(245,166,35,0.4) 0%, transparent 70%)',
  },
  {
    id: 'wipe-right',
    name: 'Cinematic Wipe',
    tagline: 'Horizontal curtain sweep',
    description: 'Crisp cinematic film sweep travelling across the screen from left to right.',
    badge: 'Film',
    icon: MoveRight,
    previewCss: 'linear-gradient(90deg, rgba(245,166,35,0.3) 0%, transparent 100%)',
  },
  {
    id: 'wipe-down',
    name: 'Curtain Drop',
    tagline: 'Theatrical vertical drop',
    description: 'Theatrical stage reveal cascading smoothly from the top of the window to the bottom.',
    badge: 'Stage',
    icon: MoveDown,
    previewCss: 'linear-gradient(180deg, rgba(245,166,35,0.3) 0%, transparent 100%)',
  },
  {
    id: 'diagonal',
    name: 'Diagonal Slice',
    tagline: 'Dynamic 45° angle cut',
    description: 'Dynamic diagonal angle sweep slicing modernly across opposing screen corners.',
    badge: 'Dynamic',
    icon: Slash,
    previewCss: 'linear-gradient(135deg, rgba(245,166,35,0.3) 0%, transparent 100%)',
  },
  {
    id: 'diamond',
    name: 'Diamond Iris',
    tagline: 'Aperture diamond iris',
    description: 'Camera lens diamond aperture radiating geometrically from your focal point.',
    badge: 'Iris',
    icon: Diamond,
    previewCss: 'radial-gradient(ellipse at center, rgba(245,166,35,0.35) 0%, transparent 65%)',
  },
  {
    id: 'dissolve',
    name: 'Soft Dissolve',
    tagline: 'Silky crossfade & scale',
    description: 'Subtle photographic crossfade with a microscopic zoom pop for effortless switching.',
    badge: 'Crossfade',
    icon: Layers,
    previewCss: 'linear-gradient(to bottom right, rgba(245,166,35,0.2), rgba(245,166,35,0.05))',
  },
];

interface ThemeAnimationSelectorProps {
  variant?: 'compact' | 'detailed';
  columns?: 2 | 3;
  showTestButton?: boolean;
}

export const ThemeAnimationSelector: React.FC<ThemeAnimationSelectorProps> = ({
  variant = 'compact',
  columns = 2,
  showTestButton = true,
}) => {
  const {
    themeAnimationStyle = 'circle',
    setThemeAnimationStyle,
    appTheme = 'dark',
    setAppTheme,
    appAccentColor = '#f5a623',
  } = useProject();

  const isLight = appTheme === 'light';
  const [testingStyle, setTestingStyle] = useState<ThemeAnimationStyle | null>(null);

  const handleSelect = (styleId: ThemeAnimationStyle) => {
    setThemeAnimationStyle(styleId);
  };

  const handlePreview = (styleId: ThemeAnimationStyle, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingStyle(styleId);
    setThemeAnimationStyle(styleId);

    // Toggle theme to preview the animation in real-time
    const nextTheme = isLight ? 'dark' : 'light';
    setAppTheme(nextTheme, e);

    setTimeout(() => {
      setTestingStyle(null);
    }, 600);
  };

  return (
    <div className="space-y-3">
      {/* Top Banner / Description */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: appAccentColor }} />
            <span className="text-xs font-black uppercase tracking-wider">Theme Switch Animation</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Select the visual effect when transitioning between light and dark modes.
          </p>
        </div>

        {showTestButton && (
          <button
            type="button"
            onClick={(e) => handlePreview(themeAnimationStyle, e)}
            className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all shadow-xs ${
              isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                : 'bg-[#222] hover:bg-[#2c2c32] text-gray-200 border border-[#333]'
            }`}
            title="Toggle theme now to preview current animation"
          >
            <RefreshCw size={12} className={testingStyle ? 'animate-spin' : ''} style={{ color: appAccentColor }} />
            <span>Test Animation</span>
          </button>
        )}
      </div>

      {/* Grid of Styles */}
      <div
        className={`grid gap-2.5 ${
          columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {THEME_ANIMATION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = themeAnimationStyle === opt.id;
          const isTesting = testingStyle === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`group relative p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'border-2 shadow-md'
                  : isLight
                    ? 'border-gray-200 bg-gray-50/80 hover:bg-gray-100/90 text-gray-700'
                    : 'border-[#26262c] bg-[#16161a] hover:bg-[#1f1f25] text-gray-300'
              }`}
              style={{
                borderColor: isSelected ? appAccentColor : undefined,
                backgroundColor: isSelected ? `${appAccentColor}10` : undefined,
              }}
            >
              {/* Background ambient gradient */}
              <div
                className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: opt.previewCss }}
              />

              {/* Card Header: Icon, Name, Badge & Selection Indicator */}
              <div className="flex items-start justify-between gap-2 mb-1.5 relative z-10">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'text-white'
                        : isLight
                          ? 'bg-gray-200 text-gray-700 group-hover:text-black'
                          : 'bg-[#222228] text-gray-300 group-hover:text-white'
                    }`}
                    style={{
                      backgroundColor: isSelected ? appAccentColor : undefined,
                    }}
                  >
                    <Icon size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                      <span>{opt.name}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-gray-400 border border-white/5">
                        {opt.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono leading-tight">{opt.tagline}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isSelected && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: appAccentColor }}
                    >
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>

              {/* Description (Detailed variant only or compact preview) */}
              {variant === 'detailed' && (
                <p className="text-[11px] text-gray-400 mb-2 relative z-10 line-clamp-2">
                  {opt.description}
                </p>
              )}

              {/* Card Footer: Quick Preview Button */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/5 relative z-10">
                <span className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">
                  {isSelected ? 'Active Style' : 'Click to select'}
                </span>

                <button
                  type="button"
                  onClick={(e) => handlePreview(opt.id, e)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-black/30 text-white hover:bg-black/50 border border-white/10'
                      : isLight
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-[#222228] text-gray-300 hover:bg-[#2c2c34] hover:text-white'
                  }`}
                  title={`Preview ${opt.name} transition`}
                >
                  <Play size={9} className={isTesting ? 'animate-ping' : ''} style={{ fill: 'currentColor' }} />
                  <span>Preview</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
