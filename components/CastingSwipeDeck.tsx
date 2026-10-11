import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Heart, X, Star, RotateCcw, Instagram, Phone, 
  ExternalLink, Sparkles, User, Info, Check, 
  ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, Layers, Film, Bookmark
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ArtistOption } from '../types';
import { openCompanionInspector } from '../services/companionInspector';

interface CastingSwipeDeckProps {
  onBackToDirectory: () => void;
  onOpenIgGrabber: () => void;
  roleNames: string[];
}

export const CastingSwipeDeck: React.FC<CastingSwipeDeckProps> = ({
  onBackToDirectory,
  onOpenIgGrabber,
  roleNames,
}) => {
  const { 
    talentPool, 
    shortlistTalentForCharacter, 
    passTalentForCharacter, 
    starTalentForCharacter,
    appTheme 
  } = useProject();

  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [selectedRole, setSelectedRole] = useState<string>(roleNames[0] || 'General Triage');
  const [deck, setDeck] = useState<ArtistOption[]>([]);
  const [history, setHistory] = useState<{ artist: ArtistOption; action: 'shortlist' | 'pass' | 'star'; role: string }[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Drag physics state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState<'right' | 'left' | 'up' | null>(null);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize deck based on selected role
  useEffect(() => {
    if (!talentPool) return;
    const candidates = talentPool.filter((artist) => {
      if (selectedRole === 'General Triage') return true;
      if (artist.passedForRoles?.includes(selectedRole)) return false;
      return true;
    });

    setDeck(candidates);
    setIsFlipped(false);
    setActivePhotoIdx(0);
  }, [talentPool, selectedRole]);

  const currentArtist = deck[0];
  const nextArtist = deck[1];

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [currentArtist?.id]);

  const handleSwipe = useCallback((direction: 'right' | 'left' | 'up') => {
    if (!currentArtist || isAnimatingOut) return;

    setIsAnimatingOut(direction);

    setTimeout(() => {
      if (direction === 'right') {
        shortlistTalentForCharacter(currentArtist.id, selectedRole, 'idea');
        setHistory(prev => [{ artist: currentArtist, action: 'shortlist', role: selectedRole }, ...prev]);
        try {
          confetti({
            particleCount: 25,
            spread: 50,
            origin: { x: 0.8, y: 0.7 },
          });
        } catch (e) {}
      } else if (direction === 'left') {
        passTalentForCharacter(currentArtist.id, selectedRole);
        setHistory(prev => [{ artist: currentArtist, action: 'pass', role: selectedRole }, ...prev]);
      } else if (direction === 'up') {
        starTalentForCharacter(currentArtist.id, selectedRole);
        setHistory(prev => [{ artist: currentArtist, action: 'star', role: selectedRole }, ...prev]);
        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { x: 0.5, y: 0.5 },
          });
        } catch (e) {}
      }

      setDeck(prev => prev.slice(1));
      setDragOffset({ x: 0, y: 0 });
      setIsAnimatingOut(null);
      setIsFlipped(false);
    }, 250);
  }, [currentArtist, isAnimatingOut, selectedRole, shortlistTalentForCharacter, passTalentForCharacter, starTalentForCharacter]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[0];
    setHistory(prev => prev.slice(1));
    setDeck(prev => [last.artist, ...prev]);
    setIsFlipped(false);
  }, [history]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleSwipe('up');
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsFlipped(f => !f);
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, handleUndo]);

  // Mouse / Touch Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isAnimatingOut) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 120;
    if (dragOffset.x > threshold) {
      handleSwipe('right');
    } else if (dragOffset.x < -threshold) {
      handleSwipe('left');
    } else if (dragOffset.y < -threshold) {
      handleSwipe('up');
    } else {
      // Snap back
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Stamp opacity calculation based on drag
  const shortlistOpacity = Math.min(Math.max(dragOffset.x / 100, 0), 1);
  const passOpacity = Math.min(Math.max(-dragOffset.x / 100, 0), 1);
  const starOpacity = Math.min(Math.max(-dragOffset.y / 100, 0), 1);

  // Card transform styles
  const rotation = dragOffset.x * 0.08;
  const cardTransform = isAnimatingOut === 'right'
    ? 'translateX(120vw) rotate(25deg)'
    : isAnimatingOut === 'left'
    ? 'translateX(-120vw) rotate(-25deg)'
    : isAnimatingOut === 'up'
    ? 'translateY(-120vh) rotate(0deg)'
    : isDragging
    ? `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`
    : 'translate(0px, 0px) rotate(0deg)';

  return (
    <div className={`w-full h-full flex flex-col items-center justify-between font-sans overflow-hidden select-none ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0d0e14] text-slate-100'
    }`}>
      {/* TOP HEADER & TARGET ROLE SELECTOR */}
      <div className={`w-full px-6 py-3 border-b flex items-center justify-between shrink-0 z-10 ${
        isLight ? 'bg-white border-slate-300' : 'bg-[#13151f] border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDirectory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Talent Vault</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase">Target Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-1 text-xs rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold focus:outline-none focus:border-amber-400"
            >
              <option value="General Triage">General Talent Triage</option>
              {roleNames.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Deck: <strong className="text-white font-bold">{deck.length}</strong> candidates remaining
          </span>

          <button
            onClick={onOpenIgGrabber}
            className="px-2.5 py-1 text-[11px] rounded border border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-semibold flex items-center gap-1"
          >
            <Bookmark size={12} />
            <span>IG Grabber</span>
          </button>
        </div>
      </div>

      {/* SWIPE CARD STACK CONTAINER */}
      <div className="flex-1 w-full flex items-center justify-center p-4 relative overflow-hidden">
        {currentArtist ? (
          <div className="relative w-full max-w-sm h-[580px]">
            {/* NEXT CARD PREVIEW (UNDERNEATH) */}
            {nextArtist && (
              <div className="absolute inset-0 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden scale-95 opacity-60 translate-y-3 pointer-events-none transition-transform">
                {nextArtist.photoUrl ? (
                  <img src={nextArtist.photoUrl} alt="" className="w-full h-full object-cover object-top filter blur-xs" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-500">
                      {nextArtist.name.charAt(0)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVE TOP CARD */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: cardTransform,
                transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                touchAction: 'none',
              }}
              className={`absolute inset-0 rounded-2xl shadow-2xl border cursor-grab active:cursor-grabbing overflow-hidden ${
                isLight ? 'bg-white border-slate-300' : 'bg-[#151722] border-slate-700'
              }`}
            >
              {/* STAMPS: SHORTLIST (Right), PASS (Left), STAR (Up) */}
              <div
                style={{ opacity: shortlistOpacity }}
                className="absolute top-8 left-6 z-30 pointer-events-none transform -rotate-15 border-4 border-emerald-400 bg-emerald-500/20 text-emerald-400 font-mono font-black text-2xl px-4 py-1.5 rounded-lg tracking-wider shadow-lg backdrop-blur-xs"
              >
                SHORTLIST
              </div>

              <div
                style={{ opacity: passOpacity }}
                className="absolute top-8 right-6 z-30 pointer-events-none transform rotate-15 border-4 border-rose-500 bg-rose-500/20 text-rose-400 font-mono font-black text-2xl px-4 py-1.5 rounded-lg tracking-wider shadow-lg backdrop-blur-xs"
              >
                PASS
              </div>

              <div
                style={{ opacity: starOpacity }}
                className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none border-4 border-amber-400 bg-amber-500/20 text-amber-300 font-mono font-black text-3xl px-6 py-2 rounded-xl tracking-widest shadow-2xl backdrop-blur-xs"
              >
                ★ STAR
              </div>

              {/* CARD FRONT OR BACK */}
              {!isFlipped ? (
                /* FRONT FACE: HERO PHOTO & ESSENTIAL STATS */
                <div className="w-full h-full flex flex-col justify-between relative bg-gradient-to-b from-transparent via-black/20 to-black/90">
                  {/* Photo or Monogram */}
                  <div className="absolute inset-0 -z-10 bg-slate-900">
                    {(() => {
                      const artistPhotos = Array.isArray(currentArtist.photos) && currentArtist.photos.length > 0
                        ? currentArtist.photos
                        : (currentArtist.photoUrl ? [currentArtist.photoUrl] : []);
                      const safePhotoIdx = Math.min(Math.max(activePhotoIdx, 0), Math.max(artistPhotos.length - 1, 0));
                      const displayPhoto = artistPhotos[safePhotoIdx] || currentArtist.photoUrl;

                      return displayPhoto ? (
                        <div className="relative w-full h-full">
                          <img
                            src={displayPhoto}
                            alt={currentArtist.name}
                            className="w-full h-full object-cover object-top pointer-events-none transition-opacity duration-200"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (displayPhoto?.startsWith('http') && !displayPhoto.includes('/api/talent/image-proxy')) {
                                target.src = `/api/talent/image-proxy?url=${encodeURIComponent(displayPhoto)}`;
                              }
                            }}
                          />
                          {artistPhotos.length > 1 && (
                            <div className="absolute top-16 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                              {artistPhotos.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`h-1.5 rounded-full transition-all ${
                                    idx === safePhotoIdx ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          {artistPhotos.length > 1 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePhotoIdx(prev => (prev === 0 ? artistPhotos.length - 1 : prev - 1));
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center pointer-events-auto z-20 transition-transform active:scale-90"
                                title="Previous Look"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePhotoIdx(prev => (prev + 1) % artistPhotos.length);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center pointer-events-auto z-20 transition-transform active:scale-90"
                                title="Next Look"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-950 via-[#181a26] to-slate-900 text-center p-6">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 text-white font-bold flex items-center justify-center text-4xl shadow-2xl mb-4">
                            {currentArtist.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-mono text-pink-400 font-bold">
                            {currentArtist.instagramHandle || '@actor'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Top Header overlay */}
                  <div className="p-4 flex items-center justify-between z-10">
                    {currentArtist.source && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-black/60 text-slate-300 border border-slate-700 backdrop-blur-xs">
                        Via {currentArtist.source}
                      </span>
                    )}

                    {/* Clickable Instagram direct link button */}
                    {(() => {
                      const currentIgUrl = currentArtist.instagramUrl || (currentArtist.instagramHandle ? `https://www.instagram.com/${currentArtist.instagramHandle.replace(/^@/, '')}/` : null);
                      if (!currentIgUrl) return null;
                      return (
                        <a
                          href={currentIgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              openCompanionInspector(currentIgUrl);
                            }
                          }}
                          className="p-2 rounded-full bg-black/60 hover:bg-pink-600 text-pink-400 hover:text-white backdrop-blur-xs border border-pink-500/30 transition-all shadow-md flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                          title="Open in IG Companion Inspector Window"
                        >
                          <Instagram size={14} />
                          <span>Open IG</span>
                          <ExternalLink size={11} className="opacity-70" />
                        </a>
                      );
                    })()}
                  </div>

                  {/* Bottom Info Sheet */}
                  <div className="p-5 text-white z-10 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
                    <div className="flex items-baseline gap-2 mb-1">
                      <h2 className="text-2xl font-black tracking-tight">{currentArtist.name}</h2>
                      {currentArtist.age && (
                        <span className="text-lg font-bold text-slate-300">{currentArtist.age}</span>
                      )}
                    </div>

                    {currentArtist.instagramHandle && (
                      <div className="font-mono text-xs text-pink-400 font-bold mb-2 flex items-center gap-1.5">
                        <Instagram size={13} />
                        <span>{currentArtist.instagramHandle}</span>
                      </div>
                    )}

                    {/* Stats strip */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mb-3 font-medium">
                      {currentArtist.height && (
                        <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-xs border border-white/20">
                          📏 {currentArtist.height}
                        </span>
                      )}
                      {currentArtist.gender && (
                        <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-xs border border-white/20">
                          {currentArtist.gender}
                        </span>
                      )}
                      {currentArtist.phone && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          📞 {currentArtist.phone}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {currentArtist.tags && currentArtist.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {currentArtist.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Flip card prompt */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 underline decoration-slate-600 transition-colors"
                    >
                      <Info size={12} />
                      <span>Press Spacebar or Click to read full WhatsApp message & notes</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* BACK FACE: FULL WHATSAPP FORWARD & CONTACT */
                <div className="w-full h-full p-6 flex flex-col justify-between bg-[#151724] text-slate-200 overflow-y-auto">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{currentArtist.name}</h3>
                        {currentArtist.instagramHandle && (() => {
                          const igUrl = currentArtist.instagramUrl || `https://www.instagram.com/${currentArtist.instagramHandle.replace(/^@/, '')}/`;
                          return (
                            <a
                              href={igUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                if (!e.metaKey && !e.ctrlKey) {
                                  e.preventDefault();
                                  openCompanionInspector(igUrl);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs font-mono text-pink-400 hover:text-pink-300 font-bold hover:underline cursor-pointer"
                              title="Open in IG Companion Inspector Window"
                            >
                              <Instagram size={12} />
                              <span>{currentArtist.instagramHandle}</span>
                              <ExternalLink size={10} className="opacity-70" />
                            </a>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => setIsFlipped(false)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4 text-xs font-sans">
                      {currentArtist.phone && (
                        <div>
                          <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block mb-1">Phone / WhatsApp:</span>
                          <span className="font-mono text-sm text-emerald-400 font-bold">{currentArtist.phone}</span>
                        </div>
                      )}

                      {currentArtist.auditionUrl && (
                        <div>
                          <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block mb-1">Audition / Reel Link:</span>
                          <a
                            href={currentArtist.auditionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:underline flex items-center gap-1 font-mono text-xs"
                          >
                            <ExternalLink size={12} />
                            <span>Watch Audition Video</span>
                          </a>
                        </div>
                      )}

                      {/* Raw WhatsApp notes */}
                      <div>
                        <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block mb-1">Raw WhatsApp Submission Text:</span>
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                          {currentArtist.sourceRawText || currentArtist.notes || 'No raw notes available.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsFlipped(false)}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors mt-4"
                  >
                    Flip Back to Photo
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* DECK COMPLETED SCREEN */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-2xl mb-4">
              ✓
            </div>
            <h2 className="text-xl font-bold mb-2">Casting Triage Completed!</h2>
            <p className="text-xs text-slate-400 mb-6">
              You've swiped through all available candidates for <strong>"{selectedRole}"</strong>.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDeck(talentPool || []);
                  setHistory([]);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>Reset Deck</span>
              </button>

              <button
                onClick={onBackToDirectory}
                className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
              >
                View Pipeline & Shortlist
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING ACTION CONTROL BUTTONS */}
      {currentArtist && (
        <div className="w-full max-w-sm px-6 py-4 flex items-center justify-between shrink-0 mb-3 z-10">
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 disabled:opacity-40 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer border border-slate-700"
            title="Undo last swipe (Z / Backspace)"
          >
            <RotateCcw size={18} />
          </button>

          {/* Pass (Left) */}
          <button
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 rounded-full bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border-2 border-rose-500 flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer"
            title="Pass (Left Arrow)"
          >
            <X size={30} strokeWidth={2.5} />
          </button>

          {/* Star (Up) */}
          <button
            onClick={() => handleSwipe('up')}
            className="w-12 h-12 rounded-full bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500 flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer"
            title="Super-Like / Star Finalist (Up Arrow)"
          >
            <Star size={20} fill="currentColor" />
          </button>

          {/* Shortlist (Right) */}
          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 rounded-full bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border-2 border-emerald-500 flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer"
            title="Shortlist for Role (Right Arrow)"
          >
            <Heart size={30} fill="currentColor" />
          </button>

          {/* Flip / Instagram */}
          {(() => {
            const igUrl = currentArtist.instagramUrl || (currentArtist.instagramHandle ? `https://www.instagram.com/${currentArtist.instagramHandle.replace(/^@/, '')}/` : null);
            if (igUrl) {
              return (
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      openCompanionInspector(igUrl);
                    }
                  }}
                  className="w-11 h-11 rounded-full bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-white border border-pink-500 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer"
                  title="Open in IG Companion Inspector Window"
                >
                  <Instagram size={18} />
                </a>
              );
            }
            return (
              <button
                onClick={() => setIsFlipped(f => !f)}
                className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer border border-slate-700"
                title="Flip Card"
              >
                <Info size={18} />
              </button>
            );
          })()}
        </div>
      )}

      {/* KEYBOARD SHORTCUTS HINT FOOTER */}
      <div className="pb-3 text-center text-[10.5px] font-mono text-slate-500">
        [←] Pass &nbsp;•&nbsp; [→] Shortlist &nbsp;•&nbsp; [↑] Star &nbsp;•&nbsp; [Space] Flip Bio &nbsp;•&nbsp; [Z] Undo
      </div>
    </div>
  );
};
