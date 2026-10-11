import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, Search, Filter, Instagram, Phone, ExternalLink, 
  UserCheck, Trash2, Plus, Sparkles, Check, ChevronDown, ChevronLeft, ChevronRight,
  Upload, Image as ImageIcon, Heart, Star, AlertCircle, LayoutGrid, List,
  Share2, ArrowRight, ShieldCheck, Film, Bookmark,
  Cloud, CheckCircle2, RefreshCw, HelpCircle, FileUp, Info
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ArtistOption } from '../types';
import { openCompanionInspector } from '../services/companionInspector';
import { compressHeadshot } from '../services/imageOptimizer';

interface TalentDirectoryViewProps {
  onOpenMassImport: () => void;
  onOpenIgGrabber: () => void;
  onOpenSwipeDeck?: () => void;
  roleNames: string[];
}

export const TalentDirectoryView: React.FC<TalentDirectoryViewProps> = ({
  onOpenMassImport,
  onOpenIgGrabber,
  onOpenSwipeDeck,
  roleNames,
}) => {
  const { 
    talentPool, 
    updateTalentInPool, 
    removeTalentFromPool, 
    shortlistTalentForCharacter,
    appTheme,
    supabaseUser,
    cloudSyncStatus,
    triggerCloudSync
  } = useProject();

  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'shortlisted' | 'unassigned' | 'passed'>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');
  const [activeRoleDropdownId, setActiveRoleDropdownId] = useState<string | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoInputUrl, setPhotoInputUrl] = useState('');
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [showCompanionGuide, setShowCompanionGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetArtistIdForUpload, setTargetArtistIdForUpload] = useState<string | null>(null);

  const handleTriggerFileUpload = (artistId: string) => {
    setTargetArtistIdForUpload(artistId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDirectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetArtistIdForUpload) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const rawBase64 = evt.target?.result as string;
      if (rawBase64) {
        const compressed = await compressHeadshot(rawBase64, 400, 0.72);
        const artist = talentPool?.find(t => t.id === targetArtistIdForUpload);
        const existingPhotos = Array.isArray(artist?.photos) ? artist!.photos : (artist?.photoUrl ? [artist!.photoUrl] : []);
        updateTalentInPool(targetArtistIdForUpload, {
          photoUrl: compressed,
          photos: [compressed, ...existingPhotos]
        });
        setEditingPhotoId(null);
        await triggerCloudSync();
      }
    };
    reader.readAsDataURL(file);
  };

  // Filtering
  const filteredTalent = useMemo(() => {
    return (talentPool || []).filter((artist) => {
      if (selectedGender !== 'all' && artist.gender?.toLowerCase() !== selectedGender.toLowerCase()) {
        return false;
      }

      if (selectedStatus === 'shortlisted') {
        if (!artist.shortlistedForRoles || artist.shortlistedForRoles.length === 0) return false;
      } else if (selectedStatus === 'unassigned') {
        if (artist.shortlistedForRoles && artist.shortlistedForRoles.length > 0) return false;
        if (artist.passedForRoles && artist.passedForRoles.length > 0) return false;
      } else if (selectedStatus === 'passed') {
        if (!artist.passedForRoles || artist.passedForRoles.length === 0) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = artist.name.toLowerCase().includes(q);
        const matchHandle = (artist.instagramHandle || '').toLowerCase().includes(q);
        const matchPhone = (artist.phone || '').includes(q);
        const matchTags = (artist.tags || []).some((t) => t.toLowerCase().includes(q));
        const matchRoles = (artist.shortlistedForRoles || []).some((r) => r.toLowerCase().includes(q));
        if (!matchName && !matchHandle && !matchPhone && !matchTags && !matchRoles) return false;
      }

      return true;
    });
  }, [talentPool, selectedGender, selectedStatus, searchTerm]);

  // Quick clipboard sync from Option 3 IG Grabber
  const handleSyncFromClipboard = async (artistId: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert('Clipboard is empty. Use the Backstage IG Grabber bookmarklet on Instagram first!');
        return;
      }

      try {
        const data = JSON.parse(text);
        if (data.source === 'backstage_ig_grabber' || data.photoUrl || data.bio) {
          updateTalentInPool(artistId, {
            photoUrl: data.photoUrl || undefined,
            name: data.name || undefined,
            notes: data.bio ? `${data.bio}\n\n${data.notes || ''}`.trim() : undefined,
          });
          await triggerCloudSync();
          alert(`Successfully synced photo and bio for ${data.name || 'actor'}!`);
          return;
        }
      } catch (jsonErr) {
        // Plain photo URL pasted
        if (text.startsWith('http')) {
          updateTalentInPool(artistId, { photoUrl: text.trim() });
          await triggerCloudSync();
          alert('Photo URL updated & synced to Cloud!');
          return;
        }
      }

      alert('No Instagram Grabber data found in clipboard. Use the bookmarklet on Instagram to grab photo & bio.');
    } catch (err: any) {
      alert(`Could not access clipboard: ${err.message}. Please allow clipboard permission or paste manually.`);
    }
  };

  const handleManualPhotoSave = async (artistId: string) => {
    const trimmed = photoInputUrl.trim();
    if (trimmed) {
      const artist = talentPool?.find(t => t.id === artistId);
      const existingPhotos = Array.isArray(artist?.photos) ? artist!.photos : (artist?.photoUrl ? [artist!.photoUrl] : []);
      updateTalentInPool(artistId, { 
        photoUrl: trimmed,
        photos: [trimmed, ...existingPhotos]
      });
      await triggerCloudSync();
    }
    setEditingPhotoId(null);
    setPhotoInputUrl('');
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden text-xs ${
      isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#0b0c10] text-slate-200'
    }`}>
      {/* TOOLBAR & METRICS HEADER */}
      <div className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
        isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/10 text-pink-500 border border-pink-500/30 shrink-0 rounded-lg">
            <Users size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500">
                MASTER TALENT VAULT
              </span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                {talentPool?.length || 0} TOTAL ACTORS
              </span>
            </div>
            <h1 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Instagram Actor Database & Roster
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {onOpenSwipeDeck && (
            <button
              onClick={onOpenSwipeDeck}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-pink-500/20 hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <Heart size={15} />
              <span>Launch Swipe Deck (Tinder Mode) 🔥</span>
            </button>
          )}

          <button
            onClick={() => openCompanionInspector()}
            className="px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Docked Phone-Sized Instagram Inspector Popup Window"
          >
            <ExternalLink size={14} />
            <span>IG Companion Window 📱</span>
          </button>

          <button
            onClick={() => setShowCompanionGuide(true)}
            className="px-2.5 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            title="How Instagram companion window and photo grabbing works"
          >
            <HelpCircle size={14} />
            <span>How it works</span>
          </button>

          <button
            onClick={onOpenIgGrabber}
            className="px-3 py-2 rounded-lg border border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Setup 1-Click Bookmarklet for Instagram"
          >
            <Bookmark size={14} />
            <span>IG Grabber Helper</span>
          </button>

          <button
            onClick={onOpenMassImport}
            className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Upload size={14} />
            <span>Mass Import (+Add)</span>
          </button>
        </div>
      </div>

      {/* HIDDEN FILE INPUT FOR DIRECT HEADSHOT UPLOADS */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDirectFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* CLOUD UPLOAD PROGRESS BAR & LIVE SYNC STATUS BANNER */}
      <div className={`px-6 py-2.5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-all ${
        cloudSyncStatus.isUploading 
          ? 'bg-amber-500/10 border-amber-500/30' 
          : cloudSyncStatus.status === 'synced'
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : cloudSyncStatus.status === 'error'
              ? 'bg-rose-500/10 border-rose-500/30'
              : isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12141c] border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            {cloudSyncStatus.isUploading ? (
              <RefreshCw size={16} className="animate-spin text-amber-400" />
            ) : cloudSyncStatus.status === 'synced' ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : cloudSyncStatus.status === 'error' ? (
              <AlertCircle size={16} className="text-rose-400" />
            ) : (
              <Cloud size={16} className={supabaseUser ? "text-emerald-400" : "text-amber-400"} />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[11px] uppercase tracking-wider font-mono">
                {cloudSyncStatus.isUploading ? '☁️ Uploading to Cloud...' : 'Cloud Status:'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold font-mono ${
                cloudSyncStatus.isUploading 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
                  : cloudSyncStatus.status === 'synced' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {cloudSyncStatus.message}
              </span>

              {cloudSyncStatus.status === 'error' && (
                <a
                  href="https://supabase.com/dashboard/project/scvdsajwsuzstagjjltg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-0.5 rounded text-[10.5px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  title="Open Supabase Dashboard to unpause project"
                >
                  <span>Restore Project at Supabase.com ↗</span>
                </a>
              )}
              {supabaseUser && (
                <span className="text-[10px] text-slate-400 font-mono">
                  (Live on Supabase: {supabaseUser.email || 'Connected'})
                </span>
              )}
            </div>

            {/* Real-time Upload Progress Bar */}
            {cloudSyncStatus.isUploading && (
              <div className="w-72 sm:w-96 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 relative border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.max(cloudSyncStatus.progress, 20)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => triggerCloudSync()}
            disabled={cloudSyncStatus.isUploading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            title="Force instant sync of talent pool and headshots to Supabase Cloud"
          >
            <RefreshCw size={12} className={cloudSyncStatus.isUploading ? "animate-spin" : ""} />
            <span>{cloudSyncStatus.isUploading ? "Uploading..." : "Sync to Cloud Now"}</span>
          </button>
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS BAR */}
      <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#161822] border-slate-800'
      }`}>
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by actor name, @instagram, phone, or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-500 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#101217] border-slate-700 text-white'
              }`}
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-3">
          {/* Gender Filter */}
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-500 font-medium ${
              isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#101217] border-slate-700 text-slate-300'
            }`}
          >
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          {/* Shortlist Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-500 font-medium ${
              isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#101217] border-slate-700 text-slate-300'
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="shortlisted">Shortlisted for Script Role</option>
            <option value="unassigned">Unassigned / Pending Triage</option>
            <option value="passed">Passed</option>
          </select>

          {/* Grid vs Table Toggle */}
          <div className={`flex border rounded-lg overflow-hidden ${isLight ? 'border-slate-300' : 'border-slate-700'}`}>
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 transition-colors ${
                viewLayout === 'grid'
                  ? isLight ? 'bg-slate-900 text-white' : 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewLayout('table')}
              className={`p-1.5 transition-colors ${
                viewLayout === 'table'
                  ? isLight ? 'bg-slate-900 text-white' : 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTalent.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">
              {talentPool?.length === 0 ? 'No Actors in Talent Pool Yet' : 'No Matching Actors Found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mb-6">
              {talentPool?.length === 0
                ? 'Mass import your 700+ WhatsApp casting group submissions and spreadsheet profiles in seconds.'
                : 'Try adjusting your search query or gender/status filters.'}
            </p>
            {talentPool?.length === 0 && (
              <button
                onClick={onOpenMassImport}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Upload size={16} />
                <span>Mass Import 700+ Actor Profiles</span>
              </button>
            )}
          </div>
        ) : viewLayout === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTalent.map((artist) => {
              const isShortlisted = artist.shortlistedForRoles && artist.shortlistedForRoles.length > 0;
              const isDropdownOpen = activeRoleDropdownId === artist.id;
              const isEditingPhoto = editingPhotoId === artist.id;
              const photosList = Array.isArray(artist.photos) && artist.photos.length > 0
                ? artist.photos
                : (artist.photoUrl ? [artist.photoUrl] : []);
              const photoIdx = photoIndices[artist.id] || 0;
              const safeIdx = Math.min(Math.max(photoIdx, 0), Math.max(photosList.length - 1, 0));
              const activePhoto = photosList[safeIdx] || artist.photoUrl;

              return (
                <div
                  key={artist.id}
                  className={`rounded-xl border flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-[#151720] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Photo / Monogram Header */}
                  <div className="relative aspect-[4/3] bg-gradient-to-tr from-slate-900 to-slate-800 overflow-hidden flex items-center justify-center group">
                    {activePhoto ? (
                      <img
                        src={activePhoto}
                        alt={artist.name}
                        className="w-full h-full object-cover object-top transition-opacity duration-200"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (activePhoto?.startsWith('http') && !activePhoto.includes('/api/talent/image-proxy')) {
                            target.src = `/api/talent/image-proxy?url=${encodeURIComponent(activePhoto)}`;
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-600 to-amber-500 text-white font-bold flex items-center justify-center text-xl shadow-md mb-2">
                          {artist.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {artist.instagramHandle || 'Actor'}
                        </span>
                      </div>
                    )}

                    {/* Multi-Photo Carousel Controls */}
                    {photosList.length > 1 && (
                      <>
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-black/80 text-amber-400 border border-amber-500/30 z-10 backdrop-blur-xs flex items-center gap-1">
                          <span>📷</span>
                          <span>{safeIdx + 1}/{photosList.length}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoIndices(prev => ({
                              ...prev,
                              [artist.id]: safeIdx === 0 ? photosList.length - 1 : safeIdx - 1
                            }));
                          }}
                          className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          title="Previous Photo"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoIndices(prev => ({
                              ...prev,
                              [artist.id]: (safeIdx + 1) % photosList.length
                            }));
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          title="Next Photo"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </>
                    )}

                    {/* Quick photo URL edit on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPhotoId(artist.id);
                        setPhotoInputUrl(artist.photoUrl || '');
                      }}
                      className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-xs border border-slate-700 shadow-sm"
                      title="Edit / Paste Photo URL"
                    >
                      <ImageIcon size={12} />
                    </button>

                    {/* Shortlisted Badge */}
                    {isShortlisted && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9.5px] font-bold font-mono bg-emerald-500 text-slate-950 shadow-md z-10">
                        SHORTLISTED
                      </div>
                    )}

                    {/* Cloud Synced Badge on Photo */}
                    {activePhoto && (
                      <div 
                        className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold bg-black/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 backdrop-blur-xs z-10"
                        title="Headshot is saved and synced to Supabase Cloud"
                      >
                        <Cloud size={9} />
                        <span>Cloud</span>
                      </div>
                    )}

                    {/* Instagram direct link badge on photo */}
                    {(() => {
                      const igUrl = artist.instagramUrl || (artist.instagramHandle ? `https://www.instagram.com/${artist.instagramHandle.replace(/^@/, '')}/` : null);
                      if (!igUrl) return null;
                      return (
                        <a
                          href={igUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              openCompanionInspector(igUrl);
                            }
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-pink-600 text-pink-400 hover:text-white backdrop-blur-xs transition-all shadow-md z-20 cursor-pointer flex items-center justify-center border border-pink-500/20 hover:border-pink-500"
                          title={`Open ${artist.instagramHandle || artist.name} in Companion Inspector`}
                        >
                          <Instagram size={13} />
                        </a>
                      );
                    })()}
                  </div>

                  {/* Photo Upload & Change Bar */}
                  {isEditingPhoto && (
                    <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">Change Headshot</span>
                        <button
                          onClick={() => setEditingPhotoId(null)}
                          className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTriggerFileUpload(artist.id)}
                          className="flex-1 py-1.5 px-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        >
                          <FileUp size={12} />
                          <span>Upload from Computer</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Or paste Image URL..."
                          value={photoInputUrl}
                          onChange={(e) => setPhotoInputUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleManualPhotoSave(artist.id);
                          }}
                          className="flex-1 px-2 py-1 text-[11px] rounded bg-[#101217] border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                        <button
                          onClick={() => handleManualPhotoSave(artist.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Body Info */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="font-bold text-xs truncate" title={artist.name}>
                          {artist.name}
                        </h4>
                        <button
                          onClick={() => removeTalentFromPool(artist.id)}
                          className="text-slate-500 hover:text-red-400 p-0.5 transition-colors"
                          title="Remove from Talent Pool"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Clickable Instagram Link & Icon */}
                      {artist.instagramHandle && (() => {
                        const igUrl = artist.instagramUrl || `https://www.instagram.com/${artist.instagramHandle.replace(/^@/, '')}/`;
                        return (
                          <a
                            href={igUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (!e.metaKey && !e.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                openCompanionInspector(igUrl);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-pink-400 hover:text-pink-300 font-bold mb-2 px-2 py-0.5 rounded-md bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 hover:border-pink-500/40 transition-all w-fit cursor-pointer group/ig"
                            title={`Open ${artist.instagramHandle} in Companion Inspector`}
                          >
                            <Instagram size={11} className="shrink-0 group-hover/ig:scale-110 transition-transform" />
                            <span className="truncate">{artist.instagramHandle}</span>
                            <ExternalLink size={10} className="shrink-0 opacity-60 group-hover/ig:opacity-100 transition-opacity" />
                          </a>
                        );
                      })()}

                      {/* Stats & Phone */}
                      <div className="text-[11px] text-slate-400 space-y-1 mb-3">
                        {(artist.age || artist.height || artist.gender) && (
                          <div className="flex items-center gap-1.5">
                            {artist.age && <span>{artist.age} yrs</span>}
                            {artist.height && <span>• {artist.height}</span>}
                            {artist.gender && <span>• {artist.gender}</span>}
                          </div>
                        )}

                        {artist.phone && (
                          <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-slate-300">
                            <Phone size={11} className="text-emerald-400 shrink-0" />
                            <span>{artist.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Shortlisted for roles list */}
                      {artist.shortlistedForRoles && artist.shortlistedForRoles.length > 0 && (
                        <div className="mb-3">
                          <div className="text-[9.5px] font-mono uppercase text-slate-500 font-bold mb-1">Shortlisted for:</div>
                          <div className="flex flex-wrap gap-1">
                            {artist.shortlistedForRoles.map((role, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shortlist Action Dropdown */}
                    <div className="relative pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => setActiveRoleDropdownId(isDropdownOpen ? null : artist.id)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-bold text-[11px] flex items-center justify-between transition-colors border border-amber-500/30"
                      >
                        <span className="flex items-center gap-1.5">
                          <Plus size={13} />
                          <span>Shortlist for Role...</span>
                        </span>
                        <ChevronDown size={12} />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg bg-[#1a1d28] border border-slate-700 shadow-xl z-20 py-1 max-h-48 overflow-y-auto">
                          <div className="px-2.5 py-1 text-[9.5px] font-mono text-slate-400 uppercase font-bold border-b border-slate-800">
                            Select Script Character:
                          </div>
                          {roleNames.map((role) => (
                            <button
                              key={role}
                              onClick={() => {
                                shortlistTalentForCharacter(artist.id, role, 'idea');
                                setActiveRoleDropdownId(null);
                              }}
                              className="w-full px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-amber-500 hover:text-slate-950 transition-colors flex items-center justify-between"
                            >
                              <span>{role}</span>
                              {artist.shortlistedForRoles?.includes(role) && (
                                <Check size={12} className="text-emerald-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-[#151720] border-slate-800'}`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`font-mono text-[10.5px] uppercase tracking-wider border-b ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#1a1d26] border-slate-800 text-slate-400'
              }`}>
                <tr>
                  <th className="p-3 w-56">Actor / Name</th>
                  <th className="p-3 w-44">Instagram</th>
                  <th className="p-3 w-36">Phone</th>
                  <th className="p-3 w-32">Stats</th>
                  <th className="p-3">Shortlisted Roles</th>
                  <th className="p-3 w-40 text-center">Shortlist to Role</th>
                  <th className="p-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredTalent.map((artist) => (
                  <tr key={artist.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 to-amber-500 text-white font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                          {artist.photoUrl ? (
                            <img src={artist.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            artist.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-semibold">{artist.name}</span>
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      {artist.instagramHandle ? (() => {
                        const igUrl = artist.instagramUrl || `https://www.instagram.com/${artist.instagramHandle.replace(/^@/, '')}/`;
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
                            className="inline-flex items-center gap-1.5 text-pink-400 hover:text-pink-300 font-bold hover:underline cursor-pointer"
                            title={`Open ${artist.instagramHandle} in Companion Inspector`}
                          >
                            <Instagram size={12} />
                            <span>{artist.instagramHandle}</span>
                            <ExternalLink size={10} className="opacity-60" />
                          </a>
                        );
                      })() : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-300">
                      {artist.phone || '—'}
                    </td>

                    <td className="p-3 text-[11px] text-slate-400">
                      {[artist.age ? `${artist.age}y` : '', artist.height, artist.gender].filter(Boolean).join(' • ') || '—'}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {artist.shortlistedForRoles?.map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            shortlistTalentForCharacter(artist.id, e.target.value, 'idea');
                          }
                        }}
                        defaultValue=""
                        className={`px-2 py-1 text-xs rounded border focus:outline-none focus:border-amber-500 font-sans ${
                          isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#101217] border-slate-700 text-slate-200'
                        }`}
                      >
                        <option value="" disabled>+ Add to role...</option>
                        {roleNames.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => removeTalentFromPool(artist.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPANION & CLOUD GUIDE MODAL */}
      {showCompanionGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#151722] border-slate-700 text-white'
          }`}>
            <div className="p-5 border-b border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <ExternalLink size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">How Instagram Companion & Cloud Photos Work</h3>
                  <p className="text-xs text-slate-400">Everything you need to know about grabbing actor photos and cloud collaboration</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompanionGuide(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] text-xs">
              {/* STEP 1 */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-sm text-purple-400">
                  <span className="w-5 h-5 rounded-full bg-purple-500 text-slate-950 text-xs flex items-center justify-center font-black">1</span>
                  <h4>The Docked IG Companion Window (Zero Tab Clutter)</h4>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">
                  Instagram blocks apps from embedding their website inside an iframe. So Backstage opens a dedicated, phone-sized popup window (490×840px) docked right next to your app.
                </p>
                <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800 font-mono text-[11px] text-amber-300">
                  👉 <strong>Tip:</strong> Clicking on any actor's <span className="text-pink-400 font-bold">@handle</span> in Backstage instantly jumps the companion window to that actor's profile! It reuses the same window instead of opening 50 new browser tabs.
                </div>
              </div>

              {/* STEP 2 */}
              <div className="p-4 rounded-xl border border-pink-500/20 bg-pink-500/5">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-sm text-pink-400">
                  <span className="w-5 h-5 rounded-full bg-pink-500 text-slate-950 text-xs flex items-center justify-center font-black">2</span>
                  <h4>3 Ways to Add Actor Headshots</h4>
                </div>
                <div className="space-y-2 mt-2">
                  <div className="p-2 rounded bg-black/40 border border-slate-800">
                    <span className="font-bold text-amber-400">Method A: Chrome Extension (1-Click)</span>
                    <p className="text-slate-300 mt-0.5">When viewing any post on Instagram, hover over the photo to see the <strong className="text-pink-400">[🎬 Backstage]</strong> badge. Click it, and the photo is sent to Backstage instantly!</p>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-slate-800">
                    <span className="font-bold text-emerald-400">Method B: Direct Upload (No Extension Needed!)</span>
                    <p className="text-slate-300 mt-0.5">On any actor card in Backstage, click the camera icon <strong className="text-white">📷</strong>, then click <strong className="text-amber-400">Upload from Computer</strong>. Pick any headshot file (.jpg, .png, .webp) from your Mac or PC.</p>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-slate-800">
                    <span className="font-bold text-blue-400">Method C: Copy & Paste Image Link</span>
                    <p className="text-slate-300 mt-0.5">Right-click any photo on Instagram &rarr; "Copy Image Address", paste it into the actor card's URL box, and click Save.</p>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-sm text-emerald-400">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs flex items-center justify-center font-black">3</span>
                  <h4>Live Cloud Upload & Real-Time Collaboration</h4>
                </div>
                <p className="text-slate-300 leading-relaxed mb-2">
                  Whenever a headshot is added, Backstage saves it permanently into <strong className="text-emerald-400">Supabase Cloud</strong>.
                </p>
                <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800 flex items-center gap-2 text-slate-300">
                  <Cloud size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    Look at the <strong>Cloud Status Bar</strong> at the top of the talent directory. It shows the animated upload progress bar and confirms when photos are live in the cloud for all collaborators!
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-black/20">
              <span className="text-[11px] text-slate-400">Need to force a cloud refresh? Click <strong>Sync to Cloud Now</strong> anytime.</span>
              <button
                onClick={() => setShowCompanionGuide(false)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
