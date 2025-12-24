
import React, { useState, useEffect, useRef } from 'react';

export const SlugInput = ({ 
  id,
  value, 
  onChange, 
  suggestions,
  onNext,
  placeholder,
  className = "flex-1",
  style,
  align = 'left',
  openOnFocus = true,
  readOnly = false
}: { 
  id?: string,
  value: string, 
  onChange: (val: string) => void, 
  suggestions: string[],
  onNext?: () => void,
  placeholder?: string,
  className?: string,
  style?: React.CSSProperties,
  align?: 'left' | 'right',
  openOnFocus?: boolean,
  readOnly?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value.toUpperCase();
    onChange(val);
    if (val.length > 0) {
      const matches = suggestions.filter(s => s.startsWith(val) && s !== val);
      setFiltered(matches);
      setSelectedIndex(0);
      setIsOpen(matches.length > 0);
    } else {
      setFiltered(suggestions);
      setSelectedIndex(0);
      setIsOpen(true);
    }
  };

  const handleSelect = (val: string) => {
    if (readOnly) return;
    onChange(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && filtered.length > 0) setIsOpen(true);
      else if (isOpen) setSelectedIndex(prev => (prev + 1) % filtered.length);
      return;
    } 
    
    if (e.key === 'ArrowUp') {
       e.preventDefault();
       if (isOpen) setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
       return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen && filtered.length > 0) {
            handleSelect(filtered[selectedIndex]);
            if(onNext) onNext();
        } else {
            // Even if no autocomplete, proceed to next field
            if (onNext) onNext();
        }
        setIsOpen(false);
    } else if (e.key === 'Escape') {
        if (isOpen) {
             setIsOpen(false);
             e.preventDefault(); // Important: Flag event as handled
             e.stopPropagation(); // Stop bubbling to prevent modal close
        }
    } else if (e.key === 'Tab') {
        e.preventDefault(); // Always prevent default to handle focus manually
        if (isOpen && filtered.length > 0) {
             handleSelect(filtered[selectedIndex]);
             if (onNext) onNext();
        } else {
             if (onNext) onNext();
        }
        setIsOpen(false);
    }
  };

  const handleOpen = () => {
      if (readOnly) return;
      if (value.length > 0) {
          const matches = suggestions.filter(s => s.startsWith(value) && s !== value);
          setFiltered(matches);
          setSelectedIndex(0);
          setIsOpen(matches.length > 0);
      } else if (openOnFocus) {
          setFiltered(suggestions.slice(0, 10)); 
          setSelectedIndex(0);
          setIsOpen(true);
      }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input 
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        onFocus={handleOpen}
        onMouseDown={handleOpen} // Force open on click
        className={`uppercase bg-transparent outline-none w-full transition-colors print:border-none print:bg-transparent leading-tight placeholder-gray-400/50 ${readOnly ? 'cursor-default opacity-80' : 'hover:bg-black/5'}`}
        style={style}
        placeholder={placeholder}
        autoComplete="off"
      />
      {!readOnly && isOpen && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} w-full min-w-[120px] bg-white border border-gray-300 shadow-xl z-[9999] max-h-40 overflow-y-auto mt-1 rounded-sm print:hidden text-left`}>
          {filtered.map((s, i) => (
            <div 
              key={s}
              className={`px-3 py-1.5 cursor-pointer text-sm font-bold ${i === selectedIndex ? 'bg-orange-100 text-orange-800' : 'text-gray-700 hover:bg-gray-100'}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); if(onNext) onNext(); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
};
