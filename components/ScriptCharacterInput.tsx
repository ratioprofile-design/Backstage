import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';

interface ScriptCharacterInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'right';
  onNext?: () => void;
  disabled?: boolean;
}

/**
 * Character input with autocomplete dropdown beautifully optimized for both Dark and Light themes.
 * Smooth local typing, zero layout shift, slim scrollbars, and high-contrast legible text.
 */
export const ScriptCharacterInput: React.FC<ScriptCharacterInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder = 'கதாபாத்திரம்',
  className = '',
  style,
  align = 'right',
  onNext,
  disabled = false,
}) => {
  const { appTheme, appAccentColor = '#f5a623' } = useProject();
  const isLight =
    appTheme === 'light' ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  const [localVal, setLocalVal] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync from props only when not currently focused by user
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value || '');
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const popupWidth = 210;
    const left = align === 'right' ? Math.max(10, rect.right - popupWidth) : rect.left;
    setPopupPos({
      top: rect.bottom + 4,
      left: Math.min(window.innerWidth - popupWidth - 10, Math.max(10, left)),
    });
  }, [align]);

  const filterSuggestions = useCallback(
    (query: string) => {
      const q = query.trim().toUpperCase();
      if (!q) {
        return suggestions.slice(0, 8);
      }
      const matches = suggestions.filter((s) => {
        const u = s.toUpperCase();
        return u.includes(q) && u !== q;
      });
      return matches.slice(0, 8);
    },
    [suggestions]
  );

  const handleOpen = () => {
    if (disabled) return;
    isFocusedRef.current = true;
    updatePosition();
    const matches = filterSuggestions(localVal);
    setFiltered(matches);
    setSelectedIndex(0);
    if (matches.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelect = (selected: string) => {
    setLocalVal(selected);
    onChange(selected);
    setIsOpen(false);
    if (onNext) {
      setTimeout(() => onNext(), 50);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    updatePosition();
    const matches = filterSuggestions(val);
    setFiltered(matches);
    setSelectedIndex(0);
    setIsOpen(matches.length > 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      if (!isOpen && filtered.length > 0) {
        setIsOpen(true);
        e.preventDefault();
        return;
      }
      if (isOpen && filtered.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
    }

    if (e.key === 'ArrowUp') {
      if (isOpen && filtered.length > 0) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filtered.length > 0 && filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      } else {
        onChange(localVal.trim());
        setIsOpen(false);
        if (onNext) onNext();
      }
      return;
    }

    if (e.key === 'Tab') {
      if (isOpen && filtered.length > 0 && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      } else {
        onChange(localVal.trim());
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    onChange(localVal.trim());
    setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={localVal}
        onChange={handleChange}
        onFocus={handleOpen}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        style={style}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />

      {isOpen &&
        filtered.length > 0 &&
        createPortal(
          <div
            className={`script-dropdown fixed border shadow-2xl rounded-xl z-[99999] w-52 max-h-48 overflow-y-auto font-sans p-1 [scrollbar-width:thin] ${
              isLight
                ? 'bg-white border-slate-200 text-slate-800 shadow-[0_14px_35px_rgba(0,0,0,0.12)] [&::-webkit-scrollbar-thumb]:bg-slate-300'
                : 'bg-[#18181b] border-zinc-700/90 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.65)] [&::-webkit-scrollbar-thumb]:bg-zinc-700'
            } [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full`}
            style={{
              top: popupPos.top,
              left: popupPos.left,
            }}
          >
            {filtered.map((s, i) => {
              const isActive = i === selectedIndex;
              return (
                <div
                  key={s}
                  className={`script-dropdown-item px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors rounded-lg ${
                    isActive
                      ? 'active font-extrabold'
                      : isLight
                      ? 'hover:bg-slate-100 text-slate-700'
                      : 'hover:bg-zinc-800 text-zinc-200'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: appAccentColor || '#f5a623',
                          color: '#000000',
                          fontWeight: 800,
                        }
                      : {
                          color: isLight ? '#1e293b' : '#f4f4f5',
                        }
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s);
                  }}
                >
                  {s}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};

interface SceneCharactersDropdownProps {
  characters: string[];
  allKnownCharacters: string[];
  onChange: (updatedChars: string[]) => void;
  className?: string;
}

/**
 * Scene heading character selector beautifully optimized for both Dark and Light themes.
 * Zero arrows, clean portal menu, search input, and high-contrast typography.
 */
export const SceneCharactersDropdown: React.FC<SceneCharactersDropdownProps> = ({
  characters = [],
  allKnownCharacters = [],
  onChange,
  className = '',
}) => {
  const { appTheme, appAccentColor = '#f5a623' } = useProject();
  const isLight =
    appTheme === 'light' ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popupWidth = 250;
    setPopupPos({
      top: rect.bottom + 4,
      left: Math.min(window.innerWidth - popupWidth - 10, Math.max(10, rect.left)),
    });
  }, []);

  const filtered = allKnownCharacters.filter((c) => {
    if (!searchTerm.trim()) return true;
    return c.toUpperCase().includes(searchTerm.trim().toUpperCase());
  });

  const handleOpen = () => {
    updatePosition();
    setSearchTerm('');
    setSelectedIndex(0);
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const toggleCharacter = (charName: string) => {
    const isPresent = characters.includes(charName);
    const updated = isPresent ? characters.filter((c) => c !== charName) : [...characters, charName];
    onChange(updated);
  };

  const handleAddNew = () => {
    const trimmed = searchTerm.trim();
    if (trimmed && !characters.includes(trimmed)) {
      onChange([...characters, trimmed]);
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !target.closest('.script-dropdown')
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const charListDisplay = characters.length > 0 ? characters.join(', ') : 'இல்லை';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <span
        onClick={handleOpen}
        className={`outline-none px-1 py-0.5 rounded font-normal inline break-words cursor-pointer transition-colors ${
          isLight ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-500/15'
        }`}
        title="Click to select or search characters from script"
      >
        {charListDisplay}
      </span>

      {isOpen &&
        createPortal(
          <div
            className={`script-dropdown fixed border shadow-2xl rounded-xl z-[99999] w-64 max-h-64 overflow-hidden font-sans flex flex-col ${
              isLight
                ? 'bg-white border-slate-200 text-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.14)]'
                : 'bg-[#18181b] border-zinc-700/90 text-zinc-100 shadow-[0_20px_45px_rgba(0,0,0,0.7)]'
            }`}
            style={{
              top: popupPos.top,
              left: popupPos.left,
            }}
          >
            {/* Quick search input at top of dropdown */}
            <div className={`p-1.5 border-b ${isLight ? 'border-slate-100 bg-slate-50/70' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filtered.length > 0 && filtered[selectedIndex]) {
                      toggleCharacter(filtered[selectedIndex]);
                    } else if (searchTerm.trim()) {
                      handleAddNew();
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (filtered.length > 0) {
                      setSelectedIndex((prev) => (prev + 1) % filtered.length);
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (filtered.length > 0) {
                      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search or add character..."
                className={`w-full px-2 py-1 text-xs rounded-lg outline-none transition-colors ${
                  isLight
                    ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-500'
                    : 'bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400'
                }`}
              />
            </div>

            {/* List of Characters */}
            <div
              className={`overflow-y-auto max-h-48 p-1 [scrollbar-width:thin] ${
                isLight
                  ? '[&::-webkit-scrollbar-thumb]:bg-slate-300'
                  : '[&::-webkit-scrollbar-thumb]:bg-zinc-700'
              } [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full`}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-zinc-500 italic flex flex-col gap-1">
                  <span>No matching script character.</span>
                  {searchTerm.trim() && (
                    <button
                      type="button"
                      onClick={handleAddNew}
                      className="text-left text-amber-500 font-bold hover:underline"
                    >
                      + Add &quot;{searchTerm.trim()}&quot; to scene
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((c, i) => {
                  const isPresent = characters.includes(c);
                  const isActive = i === selectedIndex;
                  return (
                    <div
                      key={c}
                      onClick={() => toggleCharacter(c)}
                      className={`script-dropdown-item px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors rounded-lg flex items-center justify-between ${
                        isActive
                          ? 'active font-extrabold'
                          : isPresent
                          ? isLight
                            ? 'bg-amber-500/10 text-amber-800'
                            : 'bg-amber-500/15 text-amber-300'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-zinc-800 text-zinc-200'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: appAccentColor || '#f5a623',
                              color: '#000000',
                              fontWeight: 800,
                            }
                          : {
                              color: isPresent
                                ? isLight ? '#92400e' : '#fcd34d'
                                : isLight ? '#1e293b' : '#f4f4f5',
                            }
                      }
                    >
                      <span>{c}</span>
                      {isPresent && (
                        <span
                          className={`text-[10px] font-bold px-1 rounded ${
                            isActive
                              ? 'bg-black/20 text-black'
                              : isLight
                              ? 'bg-amber-500/20 text-amber-800'
                              : 'bg-amber-400/20 text-amber-300'
                          }`}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
