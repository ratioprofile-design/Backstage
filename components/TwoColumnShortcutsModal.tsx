import React, { useEffect } from 'react';
import {
  Keyboard,
  X,
  Undo2,
  Redo2,
  Save,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Search,
  Scissors,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';

export interface TwoColumnShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLight: boolean;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  badge?: string;
}

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  items: ShortcutItem[];
}

export const TwoColumnShortcutsModal: React.FC<TwoColumnShortcutsModalProps> = ({
  isOpen,
  onClose,
  isLight,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections: ShortcutSection[] = [
    {
      title: 'Undo, Redo & Essentials',
      icon: <Undo2 size={16} className="text-amber-500" />,
      items: [
        { keys: ['Ctrl', 'Z'], description: 'Undo last change (text, move, split, delete)', badge: '⌘Z' },
        { keys: ['Ctrl', 'Y'], description: 'Redo previously undone change', badge: 'Ctrl+Shift+Z / ⌘⇧Z' },
        { keys: ['Ctrl', 'S'], description: 'Instantly save 2-column screenplay to Vault', badge: '⌘S' },
        { keys: ['Ctrl', 'F'], description: 'Search & jump across scenes and dialogue', badge: '⌘F' },
        { keys: ['Ctrl', 'H'], description: 'Find & Replace words or character names', badge: '⌘H' },
        { keys: ['?'], description: 'Open / close this Shortcuts Cheatsheet', badge: 'F1' },
      ],
    },
    {
      title: 'Keyboard Navigation',
      icon: <ArrowDown size={16} className="text-sky-500" />,
      items: [
        { keys: ['↓'], description: 'Navigate down across cards or at end of text while typing', badge: 'Next Card' },
        { keys: ['↑'], description: 'Navigate up across cards or at top of text while typing', badge: 'Prev Card' },
        { keys: ['Alt', '↓ / ↑'], description: 'Quick-jump immediately to next / previous row while editing' },
        { keys: ['→ / ←'], description: 'Glide between Left (Action) ➔ Right (Dialogue / Character)' },
        { keys: ['Home / End'], description: 'Jump directly to first / last paragraph in screenplay' },
        { keys: ['Shift', '↑ / ↓'], description: 'Multi-select continuous range of paragraph cards' },
        { keys: ['Enter'], description: 'Start editing selected card' },
        { keys: ['Esc'], description: 'Finish typing & return to card browsing mode' },
        { keys: ['Tab'], description: 'Glide from Left (Action) ➔ Right (Dialogue)', badge: 'Smooth Jump' },
        { keys: ['Shift', 'Tab'], description: 'Glide from Right (Dialogue) ➔ Left (Action)' },
      ],
    },
    {
      title: 'Writing & Splitting Shots',
      icon: <Scissors size={16} className="text-emerald-500" />,
      items: [
        { keys: ['Enter'], description: 'In Action box: Split shot into next line ending with " -"', badge: 'Kollywood Auto' },
        { keys: ['Enter'], description: 'In Dialogue box: Split dialogue into next row' },
        { keys: ['Alt', 'Click'], description: 'Split paragraph exactly where you click' },
        { keys: ['Ctrl', 'Enter'], description: 'Insert a new paragraph box below', badge: '⌘Enter' },
        { keys: ['Ctrl', 'Shift', 'Enter'], description: 'Insert a new paragraph box above', badge: '⌘⇧Enter' },
        { keys: ['Delete'], description: 'Delete highlighted paragraph block(s)', badge: 'Backspace' },
        { keys: ['Ctrl', 'D'], description: 'Delete current block without selecting', badge: 'Alt+Backspace' },
      ],
    },
    {
      title: 'Formatting & Montage',
      icon: <Sparkles size={16} className="text-amber-500" />,
      items: [
        { keys: ['Ctrl', 'B'], description: 'Toggle Bold formatting on text block / selected blocks', badge: '⌘B' },
        { keys: ['Ctrl', 'I'], description: 'Toggle Italic style on text block / selected blocks', badge: '⌘I' },
        { keys: ['Montage'], description: 'Convert block to மாண்டேஜ் (MONTAGE) Center element', badge: '⚡ Button' },
        { keys: ['Delete'], description: 'Delete block from hover box or press Delete/Backspace', badge: 'Trash Icon' },
        { keys: ['+ Scene'], description: 'Insert fresh scene with smart auto suffix (e.g. 4A)', badge: 'Sidebar / Header' },
        { keys: ['Renumber'], description: 'Renumber all scenes sequentially (1, 2, 3...) in 1 click', badge: 'Sidebar' },
      ],
    },
    {
      title: 'Column Conversion & Reordering',
      icon: <ArrowRight size={16} className="text-purple-500" />,
      items: [
        { keys: ['Alt', '←', '/', '['], description: 'Move to Left Column: காட்சி (Visual Action)', badge: '[ or Alt+←' },
        { keys: ['Alt', '→', '/', ']'], description: 'Move to Right Column: வசனம் (Dialogue)', badge: '] or Alt+→' },
        { keys: ['\\', '/', 'Alt', 'C'], description: 'Move to Center: Transition / Title (காட்சி மாற்றம்)', badge: '\\ or Alt+\\' },
        { keys: ['Alt', 'Shift', '↑'], description: 'Move current block UP above previous row' },
        { keys: ['Alt', 'Shift', '↓'], description: 'Move current block DOWN below next row' },
        { keys: ['Ctrl', 'B'], description: 'Toggle Left Scenes Navigator sidebar', badge: '⌘B' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${
          isLight
            ? 'bg-white text-slate-900 border-slate-200 shadow-slate-900/20'
            : 'bg-[#141419] text-zinc-100 border-zinc-800 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-zinc-900/60 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Keyboard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Kollywood 2-Column Keyboard Shortcuts</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
                  Fast & Lightweight
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Full keyboard control for writing, navigating, formatting, and history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts Body (Scrollable 2-Column Grid) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((sec, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col gap-3 ${
                isLight
                  ? 'bg-white border-slate-200 shadow-xs'
                  : 'bg-zinc-900/40 border-zinc-800/80'
              }`}
            >
              <div className="flex items-center gap-2 pb-1 border-b border-inherit">
                {sec.icon}
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                  {sec.title}
                </h3>
              </div>

              <div className="space-y-2.5">
                {sec.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 leading-snug">
                      <span className={isLight ? 'text-slate-700' : 'text-zinc-300'}>
                        {item.description}
                      </span>
                      {item.badge && (
                        <span className={`block text-[10px] font-mono pt-0.5 ${
                          isLight ? 'text-slate-400' : 'text-zinc-500'
                        }`}>
                          Also: {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className={`px-2 py-0.5 text-[11px] font-bold rounded-md border shadow-2xs ${
                            isLight
                              ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-slate-200'
                              : 'bg-zinc-800 text-zinc-200 border-zinc-700 shadow-black'
                          }`}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3 border-t flex items-center justify-between text-xs shrink-0 ${
            isLight
              ? 'bg-slate-50/80 border-slate-200 text-slate-600'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500 shrink-0" />
            <span>
              <strong>Pro-tip:</strong> Use <kbd className="px-1.5 py-0.5 font-mono text-[10px] rounded bg-black/10 dark:bg-white/10 border border-inherit">Tab</kbd> to seamlessly jump between Action and Dialogue without lifting your hands from the keyboard!
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
