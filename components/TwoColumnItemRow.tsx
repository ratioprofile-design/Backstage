import React, { useState } from 'react';
import { TamilScriptItem } from '../services/tamilLeftRightEngine';
import { ScriptCharacterInput } from './ScriptCharacterInput';
import {
  GripVertical,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowLeft,
  ArrowRight,
  Minus,
  Palette,
  RotateCcw,
  Plus,
} from 'lucide-react';

export interface TwoColumnItemRowProps {
  item: TamilScriptItem;
  isSelected: boolean;
  isFirstItemInScene: boolean;
  columnSplitPercent: number;
  columnGutterPx: number;
  showDivider?: boolean;
  dividerStyle?: 'hairline' | 'dashed' | 'none';
  actionTextAlign?: 'left' | 'center' | 'right' | 'justify';
  dialogueTextAlign?: 'left' | 'center' | 'right' | 'justify';
  characterNameBold?: boolean;
  characterColor?: string;
  transitionBold?: boolean;
  transitionColor?: string;
  transitionStyle?: 'tracking' | 'dashed' | 'pill' | 'italic';
  gapParagraphRowPx: number;
  allKnownCharacters: string[];
  isLight: boolean;
  isDragged: boolean;
  dragOverPosition: 'above' | 'below' | null;
  onParagraphClick: (itemId: string, e?: React.MouseEvent) => void;
  onToggleSelect: (itemId: string) => void;
  onUpdateText: (itemId: string, newText: string) => void;
  onUpdateCharacter: (itemId: string, newChar: string) => void;
  onSetSingleAlignment: (itemId: string, align: 'left' | 'center' | 'right' | 'justify', e?: React.MouseEvent) => void;
  onMoveColumn: (targetColumn: 'left' | 'right' | 'center', itemId: string) => void;
  onSetColor: (itemId: string, color?: string) => void;
  onAddAbove: (itemId: string, column: 'left' | 'right' | 'center') => void;
  onAddBelow: (itemId: string, column: 'left' | 'right' | 'center') => void;
  onSplit: (itemId: string, splitOffset?: number, customFullText?: string) => void;
  onDragStart: (itemId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (itemId: string, e: React.DragEvent) => void;
  onDragLeave: (itemId: string, e: React.DragEvent) => void;
  onDrop: (itemId: string, e: React.DragEvent) => void;
  onOpenCharacterManager: () => void;
  onFocusNextRow?: (currentItemId: string, targetCol?: 'auto' | 'action' | 'dialogue' | 'character') => void;
  onFocusPrevRow?: (currentItemId: string, targetCol?: 'auto' | 'action' | 'dialogue' | 'character') => void;
  onEscapeToCard?: (currentItemId: string) => void;
  showToast: (msg: string) => void;
}

// Color palette options for individual paragraph highlight
const COLOR_PRESETS = [
  { name: 'Default', hex: '' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Emerald', hex: '#16a34a' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Slate', hex: '#64748b' },
];

// Helper to detect if caret is at start/end or first/last line of a contentEditable element
const isCaretAtStart = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length === 0;
};

const isCaretAtEnd = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const postRange = range.cloneRange();
  postRange.selectNodeContents(el);
  postRange.setStart(range.endContainer, range.endOffset);
  return postRange.toString().length === 0;
};

const isCaretOnFirstLine = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return rect.top - elRect.top < 24 || isCaretAtStart(el);
};

const isCaretOnLastLine = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return elRect.bottom - rect.bottom < 24 || isCaretAtEnd(el);
};

export const TwoColumnItemRow: React.FC<TwoColumnItemRowProps> = React.memo(
  ({
    item,
    isSelected,
    isFirstItemInScene,
    columnSplitPercent,
    columnGutterPx,
    showDivider,
    dividerStyle,
    actionTextAlign = 'justify',
    dialogueTextAlign = 'left',
    characterNameBold = true,
    characterColor = '#0284c7',
    transitionBold = true,
    transitionColor = '#f59e0b',
    transitionStyle = 'tracking',
    gapParagraphRowPx,
    allKnownCharacters,
    isLight,
    isDragged,
    dragOverPosition,
    onParagraphClick,
    onToggleSelect,
    onUpdateText,
    onUpdateCharacter,
    onSetSingleAlignment,
    onMoveColumn,
    onSetColor,
    onAddAbove,
    onAddBelow,
    onSplit,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    onOpenCharacterManager,
    onFocusNextRow,
    onFocusPrevRow,
    onEscapeToCard,
    showToast,
  }) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

    const isLeft = item.column === 'left';
    const isRight = item.column === 'right';
    const isCenter = item.column === 'center';

    // Calculate caret character offset from mouse click
    const getCaretOffsetFromPoint = (e: MouseEvent, container: HTMLElement): number => {
      let range: Range | null = null;
      const doc = document as any;

      if (doc.caretRangeFromPoint) {
        range = doc.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      if (range && container.contains(range.startContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(container);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length;
      }

      return Math.floor((container.innerText || '').length / 2);
    };

    return (
      <div
        id={`script-row-${item.id}`}
        data-item-row-id={item.id}
        className="relative group/row"
        style={{ marginBottom: `${gapParagraphRowPx}px` }}
        onDragOver={(e) => onDragOver(item.id, e)}
        onDragLeave={(e) => onDragLeave(item.id, e)}
        onDrop={(e) => onDrop(item.id, e)}
      >
        {/* Drag landing line indicator above */}
        {dragOverPosition === 'above' && (
          <div className="absolute -top-1.5 inset-x-0 h-1 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 z-35 pointer-events-none flex items-center justify-between px-1 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
          </div>
        )}

        {/* In-Between Above: Only for the very first item in the scene */}
        {isFirstItemInScene && (
          <div className="group/inbetween absolute -top-3 inset-x-0 h-6 z-20 flex items-center justify-between opacity-0 hover:opacity-100 group-hover/row:opacity-100 transition-opacity">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0 border-t border-dashed border-slate-300/35 dark:border-zinc-700/35 opacity-0 group-hover/inbetween:opacity-100 transition-opacity pointer-events-none" />

            {/* Left Half (Action) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onAddAbove(item.id, 'left');
              }}
              style={{ width: `${columnSplitPercent}%` }}
              className="h-full flex items-center justify-start pl-2 cursor-pointer relative"
              title="Insert Action box (காட்சி) above"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAbove(item.id, 'left');
                }}
                className={`absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                  isLight
                    ? 'bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border-slate-300 hover:border-emerald-600 shadow-slate-200'
                    : 'bg-zinc-900 hover:bg-emerald-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-emerald-400'
                }`}
                title="Insert Action box (காட்சி) above"
              >
                <Plus size={13} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Right Half (Dialogue) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onAddAbove(item.id, 'right');
              }}
              style={{ width: `${100 - columnSplitPercent}%` }}
              className="h-full flex items-center justify-end pr-2 cursor-pointer relative"
              title="Insert Dialogue box (வசனம்) above"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAbove(item.id, 'right');
                }}
                className={`absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                  isLight
                    ? 'bg-white hover:bg-sky-600 hover:text-white text-slate-700 border-slate-300 hover:border-sky-600 shadow-slate-200'
                    : 'bg-zinc-900 hover:bg-sky-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-sky-400'
                }`}
                title="Insert Dialogue box (வசனம்) above"
              >
                <Plus size={13} className="stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* The Box Card itself */}
        <div
          id={`script-row-card-${item.id}`}
          tabIndex={-1}
          onClick={(e) => onParagraphClick(item.id, e)}
          className={`group relative rounded-xl p-2.5 transition-all cursor-pointer border ${
            isDragged
              ? 'opacity-35 scale-[0.99] ring-2 ring-emerald-500/50 shadow-xl border-emerald-500/50'
              : isSelected
              ? isLight
                ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/75 shadow-md shadow-amber-500/10'
                : 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/20'
              : isLight
              ? 'hover:bg-slate-50/70 border-transparent hover:border-slate-200'
              : 'hover:bg-zinc-800/40 border-transparent hover:border-zinc-800'
          }`}
        >
          {/* Active selection bar indicator on left edge */}
          {isSelected && (
            <div className="absolute -left-1 top-2 bottom-2 w-1.5 bg-amber-500 dark:bg-amber-400 rounded-full shadow-sm shadow-amber-500/60 pointer-events-none" />
          )}
          {/* Drag Handle (Grip) for reordering up and down */}
          <div
            draggable={true}
            onDragStart={(e) => onDragStart(item.id, e)}
            onDragEnd={onDragEnd}
            className={`absolute -left-7 top-1/2 -translate-y-1/2 z-25 w-5 h-7 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-grab active:cursor-grabbing hover:scale-110 ${
              isLight
                ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Click & drag up or down to reorder"
          >
            <GripVertical size={14} className="stroke-[2.2]" />
          </div>

          {/* Mouse Multi-select Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            className={`absolute -left-2.5 top-2.5 z-10 w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer ${
              isSelected
                ? 'bg-amber-500 text-black border border-amber-400 shadow-xs opacity-100 scale-105'
                : isLight
                ? 'opacity-0 group-hover:opacity-100 bg-white hover:bg-slate-100 text-slate-500 border border-slate-300 shadow-xs'
                : 'opacity-0 group-hover:opacity-100 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 border border-zinc-600/60'
            }`}
            title={isSelected ? 'Deselect paragraph' : 'Click to select paragraph (Cmd+Click to multi-select)'}
          >
            {isSelected ? (
              <Check size={11} className="stroke-[3]" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-400'}`} />
            )}
          </button>

          {/* Hover Quick Action Toolbar */}
          <div
            className={`absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all z-30 flex items-center gap-1 border rounded-xl px-1.5 py-0.5 shadow-xl backdrop-blur-xs ${
              isLight
                ? 'bg-white/95 text-slate-700 border-slate-200/90 shadow-[0_8px_25px_rgba(0,0,0,0.12)]'
                : 'bg-zinc-950/95 dark:bg-zinc-900 border-zinc-700/90 text-zinc-100'
            }`}
          >
            {/* 1. Alignment */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const current =
                  item.textAlign ||
                  (isLeft ? actionTextAlign : dialogueTextAlign);
                const next =
                  current === 'left'
                    ? 'center'
                    : current === 'center'
                    ? 'right'
                    : current === 'right'
                    ? 'justify'
                    : 'left';
                onSetSingleAlignment(item.id, next, e);
                showToast(`✓ Aligned: ${next}`);
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100' : 'text-zinc-400 hover:text-amber-400'
              }`}
              title={`Alignment: ${item.textAlign || 'default'} (Click to cycle Left -> Center -> Right -> Justify)`}
            >
              {(item.textAlign || (isLeft ? actionTextAlign : dialogueTextAlign)) === 'center' ? (
                <AlignCenter size={11} />
              ) : (item.textAlign || (isLeft ? actionTextAlign : dialogueTextAlign)) === 'right' ? (
                <AlignRight size={11} />
              ) : (item.textAlign || (isLeft ? actionTextAlign : dialogueTextAlign)) === 'left' ? (
                <AlignLeft size={11} />
              ) : (
                <AlignJustify size={11} />
              )}
            </button>

            <div className={`w-[1px] h-3 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/80'}`} />

            {/* 2. Leftside jumper */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveColumn('left', item.id);
              }}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                isLeft
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isLight
                  ? 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
                  : 'text-zinc-400 hover:text-emerald-400'
              }`}
              title="Move to Left: காட்சி (Visual Action) [Alt+Left]"
            >
              <ArrowLeft size={11} className="stroke-[3]" />
            </button>

            {/* 3. Center jumper */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveColumn('center', item.id);
              }}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                isCenter
                  ? 'bg-amber-500 text-black shadow-xs'
                  : isLight
                  ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
                  : 'text-zinc-400 hover:text-amber-400'
              }`}
              title="Move to Center: தலைப்பு / Transition [Alt+C]"
            >
              <Minus size={11} className="stroke-[3]" />
            </button>

            {/* 4. Right side jumper */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveColumn('right', item.id);
              }}
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                isRight
                  ? 'bg-sky-500 text-white shadow-xs'
                  : isLight
                  ? 'text-slate-500 hover:text-sky-600 hover:bg-slate-100'
                  : 'text-zinc-400 hover:text-sky-400'
              }`}
              title="Move to Right: வசனம் (Dialogue) [Alt+Right]"
            >
              <ArrowRight size={11} className="stroke-[3]" />
            </button>

            <div className={`w-[1px] h-3 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/80'}`} />

            {/* 5. Selected paragraph text color changer */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColorPickerOpen((prev) => !prev);
                }}
                className={`p-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-0.5 ${
                  item.textColor
                    ? 'text-amber-500 font-bold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={item.textColor ? `Text Color: ${item.textColor}` : 'Change text color'}
              >
                <Palette size={11} />
                {item.textColor && (
                  <span
                    className="w-1.5 h-1.5 rounded-full border border-black/40"
                    style={{ backgroundColor: item.textColor }}
                  />
                )}
              </button>

              {/* Mini popover for essential colors */}
              {isColorPickerOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 p-2 rounded-xl border shadow-2xl z-50 flex flex-col gap-1.5 min-w-[130px] ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between text-[10px] font-mono pb-1 border-b ${
                      isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-zinc-800'
                    }`}
                  >
                    <span>Text Color</span>
                    {item.textColor && (
                      <button
                        onClick={() => {
                          onSetColor(item.id, undefined);
                          setIsColorPickerOpen(false);
                        }}
                        className="text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-0.5"
                        title="Reset to default color"
                      >
                        <RotateCcw size={9} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => {
                          onSetColor(item.id, c.hex || undefined);
                          setIsColorPickerOpen(false);
                        }}
                        style={{ backgroundColor: c.hex || (isLight ? '#0f172a' : '#f8fafc') }}
                        className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                          item.textColor === c.hex || (!item.textColor && !c.hex)
                            ? 'border-white ring-2 ring-emerald-500/60 scale-105'
                            : isLight
                            ? 'border-slate-300'
                            : 'border-zinc-700/60'
                        }`}
                        title={c.name}
                      >
                        {(!item.textColor && !c.hex) || item.textColor === c.hex ? (
                          <Check size={9} className={c.hex ? 'text-white' : isLight ? 'text-white' : 'text-black'} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CASE B1: Transition / Centered Marker */}
          {isCenter && (
            <div className="w-full text-center py-1">
              {transitionStyle === 'pill' ? (
                <span
                  data-item-id={item.id}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateText(item.id, e.currentTarget.innerText)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && (e.altKey || isCaretOnLastLine(e.currentTarget))) {
                      e.preventDefault();
                      onFocusNextRow?.(item.id, 'auto');
                      return;
                    }
                    if (e.key === 'ArrowUp' && (e.altKey || isCaretOnFirstLine(e.currentTarget))) {
                      e.preventDefault();
                      onFocusPrevRow?.(item.id, 'auto');
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.currentTarget.blur();
                      onEscapeToCard?.(item.id);
                      return;
                    }
                  }}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      onParagraphClick(item.id, e);
                      return;
                    }
                    e.stopPropagation();
                  }}
                  style={{
                    backgroundColor: `${transitionColor}18`,
                    color: item.textColor || transitionColor,
                    borderColor: `${transitionColor}50`,
                  }}
                  className={`outline-none inline-block px-3 py-1 rounded-full border text-xs focus:ring-1 focus:ring-amber-500 ${
                    transitionBold !== false ? 'font-bold' : 'font-normal'
                  }`}
                >
                  {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                </span>
              ) : (
                <span
                  data-item-id={item.id}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateText(item.id, e.currentTarget.innerText)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && (e.altKey || isCaretOnLastLine(e.currentTarget))) {
                      e.preventDefault();
                      onFocusNextRow?.(item.id, 'auto');
                      return;
                    }
                    if (e.key === 'ArrowUp' && (e.altKey || isCaretOnFirstLine(e.currentTarget))) {
                      e.preventDefault();
                      onFocusPrevRow?.(item.id, 'auto');
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.currentTarget.blur();
                      onEscapeToCard?.(item.id);
                      return;
                    }
                  }}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      onParagraphClick(item.id, e);
                      return;
                    }
                    e.stopPropagation();
                  }}
                  style={{ color: item.textColor || transitionColor }}
                  className={`outline-none italic font-serif text-sm focus:ring-1 focus:ring-amber-500 rounded px-1 ${
                    transitionBold !== false ? 'font-bold' : 'font-normal'
                  }`}
                >
                  {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                </span>
              )}
            </div>
          )}

          {/* CASE B2: Two-Column Row (Left Action vs Right Dialogue) */}
          {!isCenter && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `${columnSplitPercent}% ${100 - columnSplitPercent}%`,
                gap: `${columnGutterPx}px`,
              }}
              className="items-start relative"
            >
              {/* Optional center hairline divider */}
              {showDivider && (
                <div
                  style={{
                    left: `${columnSplitPercent}%`,
                    borderRightStyle: dividerStyle === 'dashed' ? 'dashed' : 'solid',
                  }}
                  className="absolute inset-y-0 w-0 -translate-x-1/2 border-r border-zinc-300/40 dark:border-zinc-800/60 pointer-events-none"
                />
              )}

              {/* Left Column: Visual Action OR Right-Aligned Character Name */}
              <div
                data-col="left"
                style={{ paddingRight: `${Math.round(columnGutterPx / 2)}px` }}
                className="min-h-[26px] flex flex-col justify-start"
              >
                {isRight ? (
                  (() => {
                    let char = (item.rightCharacter || '').trim();
                    let text = (item.rightDialogue || item.rawText || '').trim();
                    if (!char && text) {
                      const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                      if (m) char = m[1].trim();
                    }
                    if (char.endsWith(':')) char = char.slice(0, -1).trim();

                    return (
                      <div data-char-container={item.id} className="w-full flex items-start justify-end gap-1 pt-0.5">
                        <ScriptCharacterInput
                          value={char || ''}
                          suggestions={allKnownCharacters}
                          onChange={(val) => onUpdateCharacter(item.id, val)}
                          onManageCharacters={onOpenCharacterManager}
                          onNext={() => {
                            const diaEl = (document.querySelector(`[data-item-row-id="${item.id}"] [data-col="right"] [data-item-id="${item.id}"]`) as HTMLElement) ||
                              (document.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement);
                            if (diaEl) diaEl.focus();
                          }}
                          onPrev={() => {
                            onFocusPrevRow?.(item.id, 'dialogue');
                          }}
                          onArrowLeft={() => {
                            const leftEl = document.querySelector(`[data-item-row-id="${item.id}"] [data-col="left"] [data-item-id="${item.id}"]`) as HTMLElement;
                            if (leftEl) leftEl.focus();
                            else onFocusPrevRow?.(item.id, 'action');
                          }}
                          onEscape={() => {
                            onEscapeToCard?.(item.id);
                          }}
                          placeholder="கதாபாத்திரம்"
                          style={{ color: characterColor }}
                          className={`text-xs uppercase text-right bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-sky-400 outline-none w-auto min-w-[70px] max-w-[240px] transition-colors ${
                            characterNameBold !== false ? 'font-black' : 'font-medium'
                          }`}
                        />
                        <span
                          style={{ color: characterColor }}
                          className={`text-xs select-none ${
                            characterNameBold !== false ? 'font-black' : 'font-medium'
                          }`}
                        >
                          :
                        </span>
                      </div>
                    );
                  })()
                ) : isLeft ? (
                  (() => {
                    const actAlign = item.textAlign || actionTextAlign;
                    const alignClass =
                      actAlign === 'left'
                        ? 'text-left'
                        : actAlign === 'center'
                        ? 'text-center'
                        : actAlign === 'right'
                        ? 'text-right'
                        : 'text-justify';

                    return (
                      <div
                        data-item-id={item.id}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => onUpdateText(item.id, e.currentTarget.innerText)}
                        onKeyDown={(e) => {
                          // ArrowDown: Move to next row's action block
                          if (e.key === 'ArrowDown' && (e.altKey || isCaretOnLastLine(e.currentTarget))) {
                            e.preventDefault();
                            onFocusNextRow?.(item.id, 'action');
                            return;
                          }

                          // ArrowUp: Move to previous row's action block
                          if (e.key === 'ArrowUp' && (e.altKey || isCaretOnFirstLine(e.currentTarget))) {
                            e.preventDefault();
                            onFocusPrevRow?.(item.id, 'action');
                            return;
                          }

                          // ArrowRight: Jump across to Right column (Character or Dialogue)
                          if (e.key === 'ArrowRight' && (e.altKey || isCaretAtEnd(e.currentTarget))) {
                            e.preventDefault();
                            const diaEl =
                              (document.querySelector(`[data-char-container="${item.id}"] input`) as HTMLElement) ||
                              (document.querySelector(`[data-item-row-id="${item.id}"] [data-col="right"] [data-item-id="${item.id}"]`) as HTMLElement);
                            if (diaEl) diaEl.focus();
                            return;
                          }

                          // Escape: Return to row card selection
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            e.currentTarget.blur();
                            onEscapeToCard?.(item.id);
                            return;
                          }

                          // Tab jumps directly over gutter to Dialogue
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            const diaEl =
                              (document.querySelector(`[data-char-container="${item.id}"] input`) as HTMLElement) ||
                              (document.querySelector(`[data-item-row-id="${item.id}"] [data-col="right"] [data-item-id="${item.id}"]`) as HTMLElement);
                            if (diaEl) diaEl.focus();
                            return;
                          }

                          // Ctrl/Cmd + Enter: Insert block below/above
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) {
                              onAddAbove(item.id, 'left');
                            } else {
                              onAddBelow(item.id, 'left');
                            }
                            return;
                          }

                          // Enter splits paragraph into separate shot ending with " -"
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const sel = window.getSelection();
                            let offset = -1;
                            if (sel && sel.rangeCount > 0) {
                              const range = sel.getRangeAt(0);
                              const preCaretRange = range.cloneRange();
                              preCaretRange.selectNodeContents(e.currentTarget);
                              preCaretRange.setEnd(range.endContainer, range.endOffset);
                              offset = preCaretRange.toString().length;
                            }
                            onSplit(item.id, offset >= 0 ? offset : undefined, e.currentTarget.innerText);
                          }
                        }}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            onParagraphClick(item.id, e);
                            return;
                          }
                          if (e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            const offset = getCaretOffsetFromPoint(e.nativeEvent, e.currentTarget);
                            onSplit(item.id, offset, e.currentTarget.innerText);
                            return;
                          }
                          e.stopPropagation();
                        }}
                        style={{ textAlign: actAlign, color: item.textColor || undefined }}
                        className={`min-h-[28px] ${alignClass} leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/50 rounded p-1 transition-all ${
                          !item.leftAction && !item.rawText
                            ? 'border border-dashed border-emerald-500/40 bg-emerald-500/[0.04]'
                            : ''
                        }`}
                        title="Type to edit. Press Enter to split shot into next line ending with ' -'. Tab / ArrowRight to jump to Dialogue. Alt+Down/Up to jump rows."
                      >
                        {item.leftAction || item.rawText || ''}
                      </div>
                    );
                  })()
                ) : null}
              </div>

              {/* Right Column: Dialogue */}
              <div
                data-col="right"
                style={{ paddingLeft: `${Math.round(columnGutterPx / 2)}px` }}
                className="min-h-[26px] flex flex-col justify-start"
              >
                {isRight ? (
                  (() => {
                    let text = (item.rightDialogue || item.rawText || '').trim();
                    const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                    if (m) text = m[2].trim();

                    const diaAlign = item.textAlign || dialogueTextAlign;
                    const alignClass =
                      diaAlign === 'left'
                        ? 'text-left'
                        : diaAlign === 'center'
                        ? 'text-center'
                        : diaAlign === 'right'
                        ? 'text-right'
                        : 'text-justify';

                    return (
                      <div
                        data-item-id={item.id}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => onUpdateText(item.id, e.currentTarget.innerText)}
                        onKeyDown={(e) => {
                          // ArrowDown: Move to next row's dialogue block
                          if (e.key === 'ArrowDown' && (e.altKey || isCaretOnLastLine(e.currentTarget))) {
                            e.preventDefault();
                            onFocusNextRow?.(item.id, 'dialogue');
                            return;
                          }

                          // ArrowUp: Move to previous row's dialogue block
                          if (e.key === 'ArrowUp' && (e.altKey || isCaretOnFirstLine(e.currentTarget))) {
                            e.preventDefault();
                            onFocusPrevRow?.(item.id, 'dialogue');
                            return;
                          }

                          // ArrowLeft: Jump back across to Character input or Left column
                          if (e.key === 'ArrowLeft' && (e.altKey || isCaretAtStart(e.currentTarget))) {
                            e.preventDefault();
                            const charEl = document.querySelector(`[data-char-container="${item.id}"] input`) as HTMLElement;
                            if (charEl) {
                              charEl.focus();
                            } else {
                              const leftEl = document.querySelector(`[data-item-row-id="${item.id}"] [data-col="left"] [data-item-id="${item.id}"]`) as HTMLElement;
                              if (leftEl) leftEl.focus();
                            }
                            return;
                          }

                          // Escape: Return to row card selection
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            e.currentTarget.blur();
                            onEscapeToCard?.(item.id);
                            return;
                          }

                          // Shift + Tab jumps back across gutter to Character / Left
                          if (e.key === 'Tab' && e.shiftKey) {
                            e.preventDefault();
                            const charEl = document.querySelector(`[data-char-container="${item.id}"] input`) as HTMLElement;
                            if (charEl) {
                              charEl.focus();
                            } else {
                              const leftEl = document.querySelector(`[data-item-row-id="${item.id}"] [data-col="left"] [data-item-id="${item.id}"]`) as HTMLElement;
                              if (leftEl) leftEl.focus();
                            }
                            return;
                          }

                          // Tab jumps to next row or creates new row
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            if (onFocusNextRow) {
                              onFocusNextRow(item.id, 'dialogue');
                            } else {
                              onAddBelow(item.id, 'right');
                            }
                            return;
                          }

                          // Ctrl/Cmd + Enter: Insert block
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            if (e.shiftKey) {
                              onAddAbove(item.id, 'right');
                            } else {
                              onAddBelow(item.id, 'right');
                            }
                            return;
                          }

                          // Enter: Split dialogue
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const sel = window.getSelection();
                            let offset = -1;
                            if (sel && sel.rangeCount > 0) {
                              const range = sel.getRangeAt(0);
                              const preCaretRange = range.cloneRange();
                              preCaretRange.selectNodeContents(e.currentTarget);
                              preCaretRange.setEnd(range.endContainer, range.endOffset);
                              offset = preCaretRange.toString().length;
                            }
                            onSplit(item.id, offset >= 0 ? offset : undefined, e.currentTarget.innerText);
                          }
                        }}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            onParagraphClick(item.id, e);
                            return;
                          }
                          if (e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            const offset = getCaretOffsetFromPoint(e.nativeEvent, e.currentTarget);
                            onSplit(item.id, offset, e.currentTarget.innerText);
                            return;
                          }
                          e.stopPropagation();
                        }}
                        style={{ textAlign: diaAlign, color: item.textColor || undefined }}
                        className={`min-h-[28px] leading-relaxed outline-none focus:ring-1 focus:ring-sky-500/50 rounded p-1 ${alignClass} transition-all ${
                          !text
                            ? 'border border-dashed border-sky-500/40 bg-sky-500/[0.04]'
                            : ''
                        }`}
                        title="Type to edit. Press Enter or Alt+Click to split this dialogue. Tab to jump to next row."
                      >
                        {text}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Drag landing line indicator below */}
        {dragOverPosition === 'below' && (
          <div className="absolute -bottom-1.5 inset-x-0 h-1 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 z-35 pointer-events-none flex items-center justify-between px-1 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
          </div>
        )}

        {/* In-Between Inserter Below: Simple '+' in-between the boxes */}
        <div className="group/inbetween absolute -bottom-3 inset-x-0 h-6 z-20 flex items-center justify-between opacity-0 hover:opacity-100 group-hover/row:opacity-100 transition-opacity">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0 border-t border-dashed border-slate-300/35 dark:border-zinc-700/35 opacity-0 group-hover/inbetween:opacity-100 transition-opacity pointer-events-none" />

          {/* Left Half (Action) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAddBelow(item.id, 'left');
            }}
            style={{ width: `${columnSplitPercent}%` }}
            className="h-full flex items-center justify-start pl-2 cursor-pointer relative"
            title="Insert Action box (காட்சி) in-between"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddBelow(item.id, 'left');
              }}
              className={`absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                isLight
                  ? 'bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border-slate-300 hover:border-emerald-600 shadow-slate-200'
                  : 'bg-zinc-900 hover:bg-emerald-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-emerald-400'
              }`}
              title="Insert Action box (காட்சி) in-between"
            >
              <Plus size={13} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Right Half (Dialogue) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAddBelow(item.id, 'right');
            }}
            style={{ width: `${100 - columnSplitPercent}%` }}
            className="h-full flex items-center justify-end pr-2 cursor-pointer relative"
            title="Insert Dialogue box (வசனம்) in-between"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddBelow(item.id, 'right');
              }}
              className={`absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                isLight
                  ? 'bg-white hover:bg-sky-600 hover:text-white text-slate-700 border-slate-300 hover:border-sky-600 shadow-slate-200'
                  : 'bg-zinc-900 hover:bg-sky-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-sky-400'
              }`}
              title="Insert Dialogue box (வசனம்) in-between"
            >
              <Plus size={13} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);
