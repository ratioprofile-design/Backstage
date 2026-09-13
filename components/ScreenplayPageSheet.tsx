import React from 'react';
import { ScreenplayPage, ScreenplayToken } from '../utils/screenplayPaginationEngine';

interface ScreenplayPageSheetProps {
  page: ScreenplayPage;
  totalPages: number;
  theme: any;
  isLight: boolean;
  activeBeatId: number | null;
  onSelectBeat: (beatId: number) => void;
  onSetSceneNumber?: (beatId: number, currentNum: string) => void;
  onContextMenu?: (e: React.MouseEvent, beatId: number) => void;
  onDoubleClickBeat?: (beatId: number) => void;
}

export const ScreenplayPageSheet: React.FC<ScreenplayPageSheetProps> = ({
  page,
  totalPages,
  theme,
  isLight,
  activeBeatId,
  onSelectBeat,
  onSetSceneNumber,
  onContextMenu,
  onDoubleClickBeat,
}) => {
  return (
    <div
      className="screenplay-page-sheet relative select-text transition-all duration-200"
      style={{
        width: '794px',
        height: '1123px',
        minHeight: '1123px',
        maxHeight: '1123px',
        backgroundColor: theme.bg || '#16161a',
        color: theme.text || '#e2e8f0',
        boxShadow: theme.shadow || '0 10px 30px rgba(0,0,0,0.5)',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: "'Courier Prime', Courier, monospace",
      }}
    >
      <style>{`
        .screenplay-page-sheet .sc-line {
          font-family: 'Courier Prime', Courier, monospace;
          font-size: 12px;
          line-height: 1.4;
          box-sizing: border-box;
          word-break: break-word;
        }
        .screenplay-page-sheet .sc-action {
          width: 100%;
          margin-bottom: 0.85em;
        }
        .screenplay-page-sheet .sc-character {
          margin-left: 37%;
          width: 45%;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 0.85em;
          margin-bottom: 0.1em;
        }
        .screenplay-page-sheet .sc-dialogue {
          margin-left: 20%;
          width: 60%;
          margin-bottom: 0.85em;
        }
        .screenplay-page-sheet .sc-parenthetical {
          margin-left: 29%;
          width: 45%;
          margin-bottom: 0.1em;
          font-style: italic;
        }
        .screenplay-page-sheet .sc-transition {
          margin-left: 55%;
          width: 45%;
          font-weight: bold;
          text-transform: uppercase;
          text-align: right;
          margin-top: 0.85em;
          margin-bottom: 0.85em;
        }
        .screenplay-page-sheet .sc-shot {
          width: 100%;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 0.85em;
          margin-bottom: 0.85em;
        }
      `}</style>

      {/* Top Right Screenplay Page Number (Standard: Omitted on Page 1) */}
      {page.pageNumber > 1 && (
        <div
          className="absolute font-mono font-bold select-none pointer-events-none"
          style={{
            top: '48px',
            right: '96px',
            fontSize: '12px',
            color: theme.pageNum || '#94a3b8',
            opacity: 0.75,
            lineHeight: 1,
          }}
        >
          {page.pageNumber}.
        </div>
      )}

      {/* Screenplay Content Body with Strict 1-inch and 1.5-inch Margins */}
      <div
        className="screenplay-page-content h-full w-full"
        style={{
          paddingTop: '96px',
          paddingBottom: '96px',
          paddingLeft: '144px', // 1.5 in Left Margin for binding
          paddingRight: '96px',  // 1.0 in Right Margin
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div className="space-y-0.5">
          {page.tokens.map((token, index) => {
            const isActive = activeBeatId === token.beatId;

            if (token.type === 'slugline') {
              const slug = token.slugData;
              const sceneNum = slug?.sceneNumber || token.beatId.toString();

              return (
                <div
                  id={`beat-${token.beatId}`}
                  key={token.id || index}
                  onClick={() => onSelectBeat(token.beatId)}
                  onDoubleClick={() => onDoubleClickBeat?.(token.beatId)}
                  onContextMenu={(e) => onContextMenu?.(e, token.beatId)}
                  className={`slugline-banner group flex items-center justify-between gap-2 px-3 py-1.5 my-2.5 cursor-pointer transition-all border-l-2 ${
                    isActive ? 'font-black shadow-xs' : 'opacity-90 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isActive ? theme.activeSlugBg || '#3f3f46' : theme.slugBg || '#27272a',
                    borderColor: isActive ? theme.activeBorder || '#f5a623' : 'rgba(128,128,128,0.25)',
                    color: isActive ? theme.activeSlugText || '#ffffff' : theme.slugText || '#a1a1aa',
                  }}
                  title="Double-click to edit in Scroll mode • Right-click for options"
                >
                  {/* Left Scene Number */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSetSceneNumber) onSetSceneNumber(token.beatId, sceneNum);
                    }}
                    className={`shrink-0 px-2 py-0.5 text-xs font-mono font-black transition-all select-none ${
                      isActive
                        ? isLight
                          ? 'bg-amber-500 text-slate-950 border border-amber-600 shadow-xs'
                          : 'bg-[#f5a623] text-black border border-[#e09612] shadow-sm'
                        : isLight
                        ? 'bg-black/5 text-slate-800 border border-black/10 hover:border-amber-500 hover:text-black'
                        : 'bg-white/5 text-zinc-200 border border-white/10 hover:border-amber-400 hover:text-white'
                    }`}
                    title="Click to edit scene number"
                  >
                    {sceneNum}
                  </button>

                  {/* Slugline Heading Text */}
                  <div className="flex-1 font-screenplay font-black uppercase text-sm tracking-wide truncate">
                    {slug?.prefix} {slug?.location} — {slug?.time}
                  </div>

                  {/* Right Scene Number */}
                  <div
                    className="shrink-0 font-mono text-xs font-black select-none tracking-widest px-1.5 opacity-75"
                    style={{ color: isActive ? theme.activeSlugText : theme.slugText }}
                  >
                    {sceneNum}
                  </div>
                </div>
              );
            }

            if (token.type === 'more') {
              return (
                <div
                  key={token.id || index}
                  className="sc-line sc-more font-screenplay text-center select-none text-[12px] opacity-75 italic my-1"
                  style={{ marginLeft: '20%', width: '60%', color: theme.text }}
                >
                  (MORE)
                </div>
              );
            }

            if (token.type === 'contd') {
              return (
                <div
                  key={token.id || index}
                  onClick={() => onSelectBeat(token.beatId)}
                  onContextMenu={(e) => onContextMenu?.(e, token.beatId)}
                  className="sc-line sc-character sc-contd font-screenplay font-bold uppercase text-[12px] tracking-wide my-1 cursor-pointer"
                  style={{ marginLeft: '37%', width: '45%', color: theme.text }}
                >
                  {token.text}
                </div>
              );
            }

            // Standard screenplay element rendered with appropriate margin/width
            return (
              <div
                key={token.id || index}
                onClick={() => onSelectBeat(token.beatId)}
                onDoubleClick={() => onDoubleClickBeat?.(token.beatId)}
                onContextMenu={(e) => onContextMenu?.(e, token.beatId)}
                className={`sc-line cursor-pointer transition-opacity ${
                  isActive ? 'opacity-100 font-medium' : 'opacity-90 hover:opacity-100'
                }`}
                style={{ color: theme.text }}
                dangerouslySetInnerHTML={{ __html: token.html || token.text }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
