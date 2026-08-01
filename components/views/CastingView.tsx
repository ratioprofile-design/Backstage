import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CharacterData, ArtistOption } from '../../types';
import { generateImage } from '../../services/gemini';
import { 
  UserCheck, Users, Search, Sliders, FileText, Plus, CheckCircle2, 
  Trash2, Upload, ExternalLink, Star, ArrowUp, ArrowDown, Check, X,
  IndianRupee, Clock, Calendar, ShieldCheck, Film, Layers, Award, Sparkles, Filter,
  Edit3, UserPlus, Phone, Mail, Building2, Link2, Eye, Play, ChevronRight, CheckSquare,
  AlertCircle, Brain, Fingerprint, RefreshCw, Wand2, Heart, User, Image as ImageIcon, GripVertical
} from 'lucide-react';
import { 
  CHARACTER_GENDERS, CHARACTER_HAIR, CHARACTER_EYES, 
  CHARACTER_BUILDS, CHARACTER_ARCHETYPES, RELATIONSHIP_TYPES
} from '../../constants';

const BILLING_TIERS = [
  { id: 'lead', label: 'Lead Role', color: 'bg-[#f5a623]/20 border-[#f5a623]/60 text-[#f5a623]' },
  { id: 'supporting', label: 'Supporting Role', color: 'bg-cyan-500/20 border-cyan-500/60 text-cyan-400' },
  { id: 'day_player', label: 'Day Player', color: 'bg-purple-500/20 border-purple-500/60 text-purple-300' },
  { id: 'voiceover', label: 'Voice Over', color: 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300' },
  { id: 'stunt', label: 'Stunt / Action', color: 'bg-rose-500/20 border-rose-500/60 text-rose-300' },
  { id: 'extra', label: 'Featured Extra', color: 'bg-neutral-800 border-neutral-700 text-neutral-400' },
] as const;

const PIPELINE_STAGES = [
  { id: 'idea', label: 'Wishlist / Idea', badgeClass: 'bg-neutral-800/90 text-neutral-300 border-neutral-700', color: '#737373' },
  { id: 'in_talks', label: 'In Discussions', badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/80', color: '#f59e0b' },
  { id: 'audition_requested', label: 'Audition Requested', badgeClass: 'bg-blue-950/90 text-blue-300 border-blue-700/80', color: '#3b82f6' },
  { id: 'self_tape_received', label: 'Self-Tape Received', badgeClass: 'bg-purple-950/90 text-purple-300 border-purple-700/80', color: '#a855f7' },
  { id: 'callback', label: 'Callback Invited', badgeClass: 'bg-indigo-950/90 text-indigo-300 border-indigo-700/80', color: '#6366f1' },
  { id: 'chemistry_read', label: 'Chemistry Read', badgeClass: 'bg-fuchsia-950/90 text-fuchsia-300 border-fuchsia-700/80', color: '#d946ef' },
  { id: 'offer_sent', label: 'Formal Offer Out', badgeClass: 'bg-yellow-950/90 text-yellow-300 border-yellow-700/80', color: '#eab308' },
  { id: 'hold', label: 'On Hold', badgeClass: 'bg-neutral-700 border-neutral-600 text-neutral-300', color: '#a3a3a3' },
  { id: 'contract_signed', label: 'Contract Signed', badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-600/90 font-bold', color: '#10b981' },
  { id: 'on_board', label: 'Cast Confirmed', badgeClass: 'bg-emerald-500 border-emerald-400 text-black font-black', color: '#059669' },
  { id: 'passed', label: 'Passed / Declined', badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-700/80', color: '#f43f5e' },
] as const;

const FEE_TYPES = [
  { id: 'weekly', label: 'Per Week (₹/Wk)' },
  { id: 'daily', label: 'Per Day (₹/Day)' },
  { id: 'flat', label: 'Flat Guarantee (₹)' },
  { id: 'scale', label: 'Guild / Minimum Scale (₹)' },
] as const;

const SAG_TIERS = [
  'Guild / CINTAA Basic Agreement',
  'Tier 1 High Budget (₹2 Cr - ₹10 Cr+)',
  'Tier 2 Mid Budget (₹50 Lakhs - ₹2 Cr)',
  'Tier 3 Low Budget (< ₹50 Lakhs)',
  'Short Film / Independent Agreement',
  'OTT / Digital Series Contract',
  'Buyout / Non-Union Agreement',
] as const;

export const CastingView: React.FC = () => {
  const { characterData, setCharacterData, beats } = useProject();

  // Navigation & View Mode State
  const [activeViewMode, setActiveViewMode] = useState<'catalogue' | 'dossier' | 'pipeline' | 'matrix' | 'comparison'>('catalogue');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Candidate Modal State
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingArtistData, setEditingArtistData] = useState<{
    charName: string;
    artist: ArtistOption;
    isNew: boolean;
  } | null>(null);

  // New Role Creation State
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleInputName, setNewRoleInputName] = useState('');

  // AI Lookbook Generation State
  const [isGeneratingLookbook, setIsGeneratingLookbook] = useState(false);
  const [lookbookPromptCustom, setLookbookPromptCustom] = useState('');
  const [newWebPhotoUrl, setNewWebPhotoUrl] = useState('');

  // Relationship Creation State
  const [newRelationTarget, setNewRelationTarget] = useState('');
  const [newRelationType, setNewRelationType] = useState('Friend');

  // Matrix Settings
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);
  const [draggingArtistInfo, setDraggingArtistInfo] = useState<{ charName: string; artistId: string } | null>(null);

  const [matrixSort, setMatrixSort] = useState<{ field: 'tier' | 'name' | 'scenes' | 'fee'; direction: 'asc' | 'desc' }>({
    field: 'tier',
    direction: 'asc'
  });

  const [copiedMemo, setCopiedMemo] = useState(false);

  // Role Names List
  const roleNames = useMemo(() => Object.keys(characterData), [characterData]);
  const activeRoleName = selectedRole && characterData[selectedRole] ? selectedRole : (roleNames[0] || '');

  // Script metrics computation
  const characterMetrics = useMemo(() => {
    const metrics: Record<string, { sceneCount: number; dialogueWords: number }> = {};
    roleNames.forEach(name => {
      metrics[name] = { sceneCount: 0, dialogueWords: 0 };
    });

    beats.forEach(beat => {
      if (!beat.content) return;
      const temp = document.createElement('div');
      temp.innerHTML = beat.content;
      const charElements = temp.querySelectorAll('.sc-line-character');

      charElements.forEach(charEl => {
        const rawName = (charEl.textContent || '').trim().toUpperCase();
        if (!rawName) return;
        const matchedKey = roleNames.find(k => k.toUpperCase() === rawName || rawName.includes(k.toUpperCase()));
        
        if (matchedKey && metrics[matchedKey]) {
          metrics[matchedKey].sceneCount += 1;
          let nextEl = charEl.nextElementSibling;
          while (nextEl && !nextEl.classList.contains('sc-line-character') && !nextEl.classList.contains('sc-line-slugline')) {
            if (nextEl.classList.contains('sc-line-dialogue')) {
              const text = (nextEl.textContent || '').trim();
              if (text) {
                metrics[matchedKey].dialogueWords += text.split(/\s+/).length;
              }
            }
            nextEl = nextEl.nextElementSibling;
          }
        }
      });
    });

    return metrics;
  }, [beats, roleNames]);

  // Overall Casting Department Statistics
  const stats = useMemo(() => {
    const totalRoles = roleNames.length;
    let confirmedCast = 0;
    let totalCandidates = 0;
    let offersOut = 0;
    let leadsCount = 0;

    roleNames.forEach(name => {
      const char = characterData[name];
      if (!char) return;
      const artists = char.artists || [];
      totalCandidates += artists.length;

      if (char.billingTier === 'lead') leadsCount++;
      if (char.confirmedArtistId || artists.some(a => a.status === 'on_board' || a.status === 'contract_signed')) {
        confirmedCast++;
      }
      if (artists.some(a => a.status === 'offer_sent')) {
        offersOut++;
      }
    });

    return {
      totalRoles,
      confirmedCast,
      uncastRoles: totalRoles - confirmedCast,
      totalCandidates,
      offersOut,
      leadsCount,
      percentCast: totalRoles > 0 ? Math.round((confirmedCast / totalRoles) * 100) : 0
    };
  }, [characterData, roleNames]);

  // All Talent Prospects across all characters
  const allTalentRoster = useMemo(() => {
    const list: { charName: string; artist: ArtistOption; charTier: string }[] = [];
    roleNames.forEach(cName => {
      const char = characterData[cName];
      if (char && char.artists) {
        char.artists.forEach(art => {
          list.push({
            charName: cName,
            artist: art,
            charTier: char.billingTier || 'supporting'
          });
        });
      }
    });
    return list;
  }, [roleNames, characterData]);

  // Filtered Cast List for Matrix
  const castList = useMemo(() => {
    return roleNames.map(name => {
      const char = characterData[name];
      const metrics = characterMetrics[name] || { sceneCount: 0, dialogueWords: 0 };
      return {
        ...char,
        name,
        sceneCount: metrics.sceneCount,
        dialogueWords: metrics.dialogueWords
      };
    }).filter(char => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = char.name.toLowerCase().includes(query);
        const matchesAccent = (char.accent || '').toLowerCase().includes(query);
        const matchesTalent = (char.artists || []).some(a => 
          a.name.toLowerCase().includes(query) || 
          (a.contact?.agency || '').toLowerCase().includes(query) ||
          (a.contact?.agentName || '').toLowerCase().includes(query)
        );
        if (!matchesName && !matchesAccent && !matchesTalent) return false;
      }

      if (filterTier !== 'all' && char.billingTier !== filterTier) return false;

      if (filterStatus !== 'all') {
        const isCast = Boolean(char.confirmedArtistId || char.artists?.some(a => a.status === 'on_board' || a.status === 'contract_signed'));
        if (filterStatus === 'cast' && !isCast) return false;
        if (filterStatus === 'uncast' && isCast) return false;
      }

      return true;
    });
  }, [roleNames, characterData, characterMetrics, searchTerm, filterTier, filterStatus]);

  const sortedCastList = useMemo(() => {
    return [...castList].sort((a, b) => {
      const dir = matrixSort.direction === 'asc' ? 1 : -1;
      if (matrixSort.field === 'name') return a.name.localeCompare(b.name) * dir;
      if (matrixSort.field === 'scenes') return (a.sceneCount - b.sceneCount) * dir;
      if (matrixSort.field === 'tier') {
        const tierOrder = { lead: 1, supporting: 2, day_player: 3, voiceover: 4, stunt: 5, extra: 6 };
        const orderA = tierOrder[a.billingTier || 'supporting'] || 99;
        const orderB = tierOrder[b.billingTier || 'supporting'] || 99;
        return (orderA - orderB) * dir;
      }
      return 0;
    });
  }, [castList, matrixSort]);

  // State Updates
  const updateCharacter = (charName: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({
      ...prev,
      [charName]: {
        ...(prev[charName] || {
          name: charName,
          age: 30,
          gender: 'Unspecified',
          ethnicity: '',
          hair: '',
          eyes: '',
          build: '',
          occupation: '',
          archetype: '',
          physiology: '',
          sociology: '',
          psychology: '',
          backstory: '',
          images: [],
          relationships: [],
          artists: []
        }),
        ...updates
      }
    }));
  };

  const handleAddNewRole = () => {
    const trimmed = newRoleInputName.trim().toUpperCase();
    if (!trimmed) return;
    updateCharacter(trimmed, {
      name: trimmed,
      billingTier: 'supporting',
      age: 30,
      gender: 'Unspecified',
      artists: []
    });
    setSelectedRole(trimmed);
    setNewRoleInputName('');
    setIsCreatingRole(false);
  };

  const handleDeleteRole = (charName: string) => {
    if (!confirm(`Are you sure you want to delete character role "${charName}" and all associated candidates?`)) return;
    setCharacterData(prev => {
      const copy = { ...prev };
      delete copy[charName];
      return copy;
    });
    if (selectedRole === charName) {
      setSelectedRole('');
    }
  };

  // ROBUST ADD CANDIDATE MODAL HANDLER
  const handleOpenNewCandidateModal = (targetRole?: string) => {
    let roleToUse = targetRole || activeRoleName || roleNames[0];

    // If no roles exist at all, auto-create a default role so candidate can be added immediately
    if (!roleToUse) {
      roleToUse = 'LEAD CHARACTER 1';
      updateCharacter(roleToUse, {
        name: roleToUse,
        billingTier: 'lead',
        age: 30,
        gender: 'Unspecified',
        artists: []
      });
      setSelectedRole(roleToUse);
    }

    const char = characterData[roleToUse];
    const existingCount = char?.artists?.length || 0;

    const newArtist: ArtistOption = {
      id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Actor Candidate ${existingCount + 1}`,
      rank: existingCount + 1,
      status: 'idea',
      rating: 4,
      dealTerms: { feeQuote: '', feeType: 'weekly', sagTier: 'SAG Basic Theatrical' },
      contact: { agency: '', agentName: '', phone: '', email: '' },
      notes: ''
    };

    setEditingArtistData({
      charName: roleToUse,
      artist: newArtist,
      isNew: true
    });
    setIsCandidateModalOpen(true);
  };

  const handleOpenEditCandidateModal = (charName: string, artist: ArtistOption) => {
    const photos = artist.photos && artist.photos.length > 0
      ? artist.photos
      : (artist.photoUrl ? [artist.photoUrl] : []);
    const mainPhoto = artist.photoUrl || photos[0] || '';

    setEditingArtistData({
      charName,
      artist: {
        ...artist,
        photos,
        photoUrl: mainPhoto
      },
      isNew: false
    });
    setIsCandidateModalOpen(true);
  };

  const handleSaveCandidateModal = () => {
    if (!editingArtistData) return;
    const { charName, artist, isNew } = editingArtistData;
    const char = characterData[charName];
    const existing = char?.artists || [];

    const photos = artist.photos && artist.photos.length > 0
      ? artist.photos
      : (artist.photoUrl ? [artist.photoUrl] : []);
    const mainPhoto = artist.photoUrl || photos[0] || '';

    const normalizedArtist: ArtistOption = {
      ...artist,
      photos,
      photoUrl: mainPhoto
    };

    let updatedArtists: ArtistOption[];
    if (isNew) {
      updatedArtists = [...existing, normalizedArtist];
    } else {
      updatedArtists = existing.map(a => a.id === artist.id ? normalizedArtist : a);
    }

    updateCharacter(charName, { artists: updatedArtists });
    setIsCandidateModalOpen(false);
    setEditingArtistData(null);
  };

  const handleDeleteArtist = (charName: string, artistId: string) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const updated = char.artists.filter(art => art.id !== artistId);
    const reordered = updated.map((art, idx) => ({ ...art, rank: idx + 1 }));
    updateCharacter(charName, { 
      artists: reordered,
      confirmedArtistId: char.confirmedArtistId === artistId ? undefined : char.confirmedArtistId
    });
  };

  const handleConfirmArtist = (charName: string, artistId: string) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const isAlreadyConfirmed = char.confirmedArtistId === artistId;
    const updatedArtists = char.artists.map(art => {
      if (art.id === artistId) {
        return { ...art, status: isAlreadyConfirmed ? 'idea' : 'on_board' as const };
      }
      return art;
    });

    updateCharacter(charName, {
      artists: updatedArtists,
      confirmedArtistId: isAlreadyConfirmed ? undefined : artistId
    });
  };

  const handleMoveCandidateStage = (charName: string, artistId: string, newStage: ArtistOption['status']) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const updated = char.artists.map(art => art.id === artistId ? { ...art, status: newStage } : art);
    updateCharacter(charName, { 
      artists: updated,
      confirmedArtistId: (newStage === 'on_board' || newStage === 'contract_signed') ? artistId : char.confirmedArtistId
    });
  };

  // AI CONCEPT LOOKBOOK GENERATOR
  const handleGenerateLookbookImage = async (charName: string) => {
    const char = characterData[charName];
    if (!char) return;

    setIsGeneratingLookbook(true);
    try {
      const prompt = lookbookPromptCustom.trim() || `Cinematic film still concept art of character named ${char.name}, age ${char.playingAge || char.age || '30'}, ${char.gender || ''}, ${char.ethnicity || ''}, ${char.build || ''}, hair ${char.hair || ''}, eyes ${char.eyes || ''}, archetype ${char.archetype || ''}, ${char.backstory || ''}. Photorealistic, 8k resolution, cinematic movie lighting, high detail studio photography.`;
      
      const imageUrl = await generateImage({
        prompt,
        model: 'gemini-2.5-flash-image',
        aspectRatio: '16:9'
      });

      if (imageUrl) {
        const existingImages = char.images || [];
        updateCharacter(charName, {
          images: [imageUrl, ...existingImages]
        });
        setLookbookPromptCustom('');
      } else {
        alert("Failed to generate concept art. Please verify Gemini API key configuration.");
      }
    } catch (err) {
      console.error("Lookbook generation failed", err);
      alert("Error generating concept image with AI.");
    } finally {
      setIsGeneratingLookbook(false);
    }
  };

  // LOCAL TALENT PHOTO MANAGEMENT HANDLERS
  const handleArtistPhotosUpload = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const newPhotos: string[] = [];
    let processed = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          newPhotos.push(result);
        }
        processed++;
        if (processed === fileArray.length) {
          setEditingArtistData(prev => {
            if (!prev) return null;
            const currentPhotos = prev.artist.photos && prev.artist.photos.length > 0
              ? prev.artist.photos
              : (prev.artist.photoUrl ? [prev.artist.photoUrl] : []);
            const combinedPhotos = [...currentPhotos, ...newPhotos];
            const currentMain = prev.artist.photoUrl || combinedPhotos[0] || '';
            return {
              ...prev,
              artist: {
                ...prev.artist,
                photos: combinedPhotos,
                photoUrl: currentMain
              }
            };
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSetMainArtistPhoto = (photoUrlToSet: string) => {
    setEditingArtistData(prev => {
      if (!prev) return null;
      const currentPhotos = prev.artist.photos && prev.artist.photos.length > 0
        ? prev.artist.photos
        : (prev.artist.photoUrl ? [prev.artist.photoUrl] : []);
      const filtered = currentPhotos.filter(p => p !== photoUrlToSet);
      const reorderedPhotos = [photoUrlToSet, ...filtered];
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photoUrl: photoUrlToSet,
          photos: reorderedPhotos
        }
      };
    });
  };

  const handleRemoveArtistPhoto = (photoUrlToRemove: string) => {
    setEditingArtistData(prev => {
      if (!prev) return null;
      const currentPhotos = prev.artist.photos && prev.artist.photos.length > 0
        ? prev.artist.photos
        : (prev.artist.photoUrl ? [prev.artist.photoUrl] : []);
      const updatedPhotos = currentPhotos.filter(p => p !== photoUrlToRemove);
      let newMain = prev.artist.photoUrl;
      if (newMain === photoUrlToRemove) {
        newMain = updatedPhotos[0] || '';
      }
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photos: updatedPhotos,
          photoUrl: newMain
        }
      };
    });
  };

  const handleAddPhotoFromUrl = (url: string) => {
    if (!url.trim()) return;
    const trimmed = url.trim();
    setEditingArtistData(prev => {
      if (!prev) return null;
      const currentPhotos = prev.artist.photos && prev.artist.photos.length > 0
        ? prev.artist.photos
        : (prev.artist.photoUrl ? [prev.artist.photoUrl] : []);
      const combinedPhotos = [...currentPhotos, trimmed];
      const newMain = prev.artist.photoUrl || trimmed;
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photos: combinedPhotos,
          photoUrl: newMain
        }
      };
    });
  };

  const handleDirectCandidatePhotosUpload = (charName: string, artistId: string, files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const newPhotos: string[] = [];
    let processed = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          newPhotos.push(result);
        }
        processed++;
        if (processed === fileArray.length) {
          const char = characterData[charName];
          if (!char || !char.artists) return;
          const updated = char.artists.map(art => {
            if (art.id !== artistId) return art;
            const currentPhotos = art.photos && art.photos.length > 0
              ? art.photos
              : (art.photoUrl ? [art.photoUrl] : []);
            const combinedPhotos = [...currentPhotos, ...newPhotos];
            const currentMain = art.photoUrl || combinedPhotos[0] || '';
            return {
              ...art,
              photos: combinedPhotos,
              photoUrl: currentMain
            };
          });
          updateCharacter(charName, { artists: updated });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDirectCandidateSetMainPhoto = (charName: string, artistId: string, photoUrlToSet: string) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const updated = char.artists.map(art => {
      if (art.id !== artistId) return art;
      const currentPhotos = art.photos && art.photos.length > 0
        ? art.photos
        : (art.photoUrl ? [art.photoUrl] : []);
      const filtered = currentPhotos.filter(p => p !== photoUrlToSet);
      const reordered = [photoUrlToSet, ...filtered];
      return {
        ...art,
        photoUrl: photoUrlToSet,
        photos: reordered
      };
    });
    updateCharacter(charName, { artists: updated });
  };

  const handleCharacterImageFilesUpload = (charName: string, files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const char = characterData[charName];
    if (!char) return;

    const fileArray = Array.from(files);
    const newImages: string[] = [];
    let processed = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          newImages.push(result);
        }
        processed++;
        if (processed === fileArray.length) {
          updateCharacter(charName, {
            images: [...newImages, ...(char.images || [])]
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddRelationship = (charName: string) => {
    if (!newRelationTarget) return;
    const char = characterData[charName];
    if (!char) return;
    const existing = char.relationships || [];
    const updated = [...existing, { characterName: newRelationTarget, relation: newRelationType }];
    updateCharacter(charName, { relationships: updated });
    setNewRelationTarget('');
  };

  const handleRemoveRelationship = (charName: string, idx: number) => {
    const char = characterData[charName];
    if (!char || !char.relationships) return;
    const updated = char.relationships.filter((_, i) => i !== idx);
    updateCharacter(charName, { relationships: updated });
  };

  const handleExportMatrixCSV = () => {
    let csv = `Character Name,Billing Tier,Vitals,Scene Count,Dialogue Words,Top Talent Candidate,Casting Status,Fee Quote,Agency Representation,Agent Phone,Agent Email,Self-Tape URL\n`;
    sortedCastList.forEach(char => {
      const topArtist = (char.artists || []).find(a => a.id === char.confirmedArtistId) || (char.artists || [])[0];
      const tier = char.billingTier || 'supporting';
      const vitals = `${char.playingAge || char.age || ''} / ${char.gender || ''} / ${char.accent || ''}`.replace(/,/g, ' ');
      const talentName = topArtist ? topArtist.name.replace(/,/g, ' ') : 'Unassigned';
      const status = topArtist ? topArtist.status : 'unassigned';
      const quote = topArtist ? (topArtist.dealTerms?.feeQuote || topArtist.feeQuote || '').replace(/,/g, ' ') : '';
      const agency = topArtist ? (topArtist.contact?.agency || '').replace(/,/g, ' ') : '';
      const agentPhone = topArtist ? (topArtist.contact?.phone || '').replace(/,/g, ' ') : '';
      const agentEmail = topArtist ? (topArtist.contact?.email || '').replace(/,/g, ' ') : '';
      const tape = topArtist?.auditionUrl || '';

      csv += `"${char.name}","${tier}","${vitals}",${char.sceneCount},${char.dialogueWords},"${talentName}","${status}","${quote}","${agency}","${agentPhone}","${agentEmail}","${tape}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Master_Casting_Catalogue_Matrix_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyDealMemo = (charName: string) => {
    const char = characterData[charName];
    if (!char) return;
    const artists = char.artists || [];

    let memoText = `CASTING BREAKDOWN SHEET: ${charName.toUpperCase()}\n`;
    memoText += `Role Billing Tier: ${char.billingTier || 'Supporting'}\n`;
    memoText += `Vitals: ${char.playingAge || char.age || '30'} yrs • ${char.gender || 'Unspecified'} • ${char.accent || 'Standard Accent'}\n\n`;
    memoText += `SHORTLISTED CANDIDATES (${artists.length}):\n`;
    memoText += `----------------------------------------------\n`;

    artists.forEach((art, idx) => {
      memoText += `OPTION ${idx + 1}: ${art.name} [Status: ${art.status?.toUpperCase() || 'IDEA'}]\n`;
      memoText += `  Fee Quote (₹): ${art.dealTerms?.feeQuote || art.feeQuote || 'N/A'}\n`;
      memoText += `  Guild Tier: ${art.dealTerms?.sagTier || 'N/A'}\n`;
      memoText += `  Agency: ${art.contact?.agency || 'N/A'} (Agent: ${art.contact?.agentName || 'N/A'})\n`;
      if (art.contact?.phone) memoText += `  Phone: ${art.contact.phone}\n`;
      if (art.contact?.email) memoText += `  Email: ${art.contact.email}\n`;
      if (art.auditionUrl) memoText += `  Reel/Tape: ${art.auditionUrl}\n`;
      if (art.notes) memoText += `  Notes: ${art.notes}\n`;
      memoText += `\n`;
    });

    navigator.clipboard.writeText(memoText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 3000);
  };

  return (
    <div className="w-full h-full bg-[#050508] text-neutral-100 flex flex-col overflow-hidden font-sans">
      
      {/* =========================================================================
          CASTING & ARTIST MANAGEMENT HEADER
      ========================================================================= */}
      <header className="bg-[#0b0b0f] border-b border-neutral-800 px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shrink-0 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 via-amber-600/20 to-amber-900/10 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-xl shrink-0">
            <UserCheck size={24} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400">
                CASTING CATALOGUE & ARTIST MANAGEMENT
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {stats.confirmedCast} / {stats.totalRoles} Roles Cast ({stats.percentCast}%)
              </span>
            </div>
            <h1 className="text-xl font-mono font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Production Talent Roster</span>
            </h1>
          </div>
        </div>

        {/* METRICS & NAVIGATION CONTROLS */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center bg-[#121217] border border-neutral-800 px-3.5 py-1.5 rounded-xl text-xs font-mono gap-3">
            <div>
              <div className="text-[9px] uppercase text-neutral-500 font-bold">Roles</div>
              <div className="text-xs font-bold text-white">{stats.totalRoles} Total</div>
            </div>
            <div className="h-6 w-px bg-neutral-800" />
            <div>
              <div className="text-[9px] uppercase text-neutral-500 font-bold">Cast Confirmed</div>
              <div className="text-xs font-bold text-emerald-400">{stats.confirmedCast} Attached</div>
            </div>
            <div className="h-6 w-px bg-neutral-800" />
            <div>
              <div className="text-[9px] uppercase text-neutral-500 font-bold">Candidates</div>
              <div className="text-xs font-bold text-amber-400">{stats.totalCandidates} Actors</div>
            </div>
          </div>

          {/* ADD CANDIDATE MAIN TRIGGER BUTTON - GUARANTEED WORKING */}
          <button
            onClick={() => handleOpenNewCandidateModal()}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-bold text-xs uppercase rounded-xl flex items-center gap-2 shadow-lg transition-all transform active:scale-95"
          >
            <UserPlus size={16} />
            <span>Add Candidate</span>
          </button>

          {/* VIEW SWITCHER */}
          <div className="flex items-center bg-[#141419] border border-neutral-800 p-1 rounded-2xl text-xs font-mono font-bold shadow-inner">
            <button
              onClick={() => setActiveViewMode('catalogue')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === 'catalogue' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users size={14} />
              <span>Role Catalogue</span>
            </button>
            <button
              onClick={() => setActiveViewMode('dossier')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === 'dossier' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Brain size={14} />
              <span>Character Dossier</span>
            </button>
            <button
              onClick={() => setActiveViewMode('pipeline')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === 'pipeline' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>Casting Pipeline</span>
            </button>
            <button
              onClick={() => setActiveViewMode('matrix')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === 'matrix' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sliders size={14} />
              <span>Master Matrix</span>
            </button>
            <button
              onClick={() => setActiveViewMode('comparison')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === 'comparison' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Award size={14} />
              <span>Talent Evaluator</span>
            </button>
          </div>

        </div>
      </header>

      {/* =========================================================================
          VIEW 1: ROLE CATALOGUE & CANDIDATE ROSTER
      ========================================================================= */}
      {activeViewMode === 'catalogue' && (
        <div className="flex-1 flex overflow-hidden bg-[#08080a]">
          
          {/* LEFT SIDEBAR ROLE SELECTOR */}
          <div className="w-80 bg-[#0d0d11] border-r border-neutral-800 p-4 flex flex-col space-y-4 shrink-0 overflow-y-auto custom-scrollbar">
            
            {/* SEARCH & ADD ROLE BUTTON */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                <span>Production Roles ({roleNames.length})</span>
                <button
                  onClick={() => setIsCreatingRole(true)}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus size={12} /> Add Role
                </button>
              </div>

              {isCreatingRole && (
                <div className="p-2.5 bg-[#141419] border border-amber-500/50 rounded-xl space-y-2">
                  <input
                    type="text"
                    placeholder="Role Name e.g. DETECTIVE MILLER"
                    value={newRoleInputName}
                    onChange={(e) => setNewRoleInputName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewRole()}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500 uppercase font-mono"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2 text-[10px] font-mono">
                    <button
                      onClick={() => setIsCreatingRole(false)}
                      className="text-neutral-400 hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNewRole}
                      className="bg-amber-500 text-black font-bold px-3 py-1 rounded-lg"
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-neutral-500" size={14} />
                <input
                  type="text"
                  placeholder="Filter roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#141418] border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* ROLE LIST */}
            <div className="space-y-2">
              {roleNames.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-neutral-800 rounded-xl text-xs font-mono text-neutral-500">
                  No character roles created yet. Click "+ Add Role" above or click "Add Candidate".
                </div>
              ) : (
                roleNames.map(name => {
                  const char = characterData[name];
                  const isSelected = activeRoleName === name;
                  const isCast = Boolean(char?.confirmedArtistId || char?.artists?.some(a => a.status === 'on_board' || a.status === 'contract_signed'));
                  const candidates = char?.artists || [];
                  const confirmedArtist = candidates.find(a => a.id === char?.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');

                  return (
                    <div
                      key={name}
                      onClick={() => setSelectedRole(name)}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all border cursor-pointer relative group ${
                        isSelected 
                          ? 'bg-gradient-to-r from-amber-500/20 to-amber-900/10 border-amber-500/60 shadow-lg' 
                          : 'bg-[#121217] border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0">
                            {char?.images && char.images.length > 0 ? (
                              <img src={char.images[0]} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-mono font-bold text-neutral-600 text-xs">
                                {name.substring(0, 2)}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="font-mono font-bold text-sm uppercase text-white flex items-center gap-1.5">
                              <span>{name}</span>
                              {isCast && <CheckCircle2 size={13} className="text-emerald-400" title="Cast Confirmed" />}
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400">
                              {char?.billingTier || 'Supporting'} • {candidates.length} Prospects
                            </div>
                          </div>
                        </div>

                        <ChevronRight size={16} className={`transition-transform ${isSelected ? 'text-amber-400 translate-x-1' : 'text-neutral-600'}`} />
                      </div>

                      {confirmedArtist && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                          <span className="truncate">Cast: <strong className="text-white">{confirmedArtist.name}</strong></span>
                          <span className="text-[9px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700 uppercase font-bold">Confirmed</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* RIGHT MAIN PANEL: ACTIVE ROLE SHORTLIST & CANDIDATE CARDS */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {activeRoleName && characterData[activeRoleName] ? (
              (() => {
                const char = characterData[activeRoleName];
                const artists = char.artists || [];

                return (
                  <div className="space-y-6">
                    
                    {/* ROLE HEADER BANNER */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 shadow-inner">
                          {char.images && char.images.length > 0 ? (
                            <img src={char.images[0]} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-mono font-bold text-neutral-600 text-lg">
                              {char.name.substring(0, 2)}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-amber-500/20 border-amber-500/40 text-amber-300">
                              {char.billingTier || 'Supporting Role'}
                            </span>
                            <span className="text-xs font-mono text-neutral-400">
                              ({artists.length} Candidates Shortlisted)
                            </span>
                          </div>

                          <h2 className="text-2xl font-mono font-bold text-white uppercase tracking-tight mt-1">
                            {char.name}
                          </h2>
                          <p className="text-xs font-mono text-neutral-400 mt-0.5">
                            Specs: Age {char.playingAge || char.age || '30'} • {char.gender || 'Unspecified'} • {char.accent || 'Standard Accent'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedRole(char.name);
                            setActiveViewMode('dossier');
                          }}
                          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono font-bold rounded-xl flex items-center gap-2 border border-neutral-700"
                        >
                          <Brain size={14} />
                          <span>Edit Character Dossier</span>
                        </button>

                        <button
                          onClick={() => copyDealMemo(char.name)}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-all shadow-md"
                        >
                          <FileText size={15} />
                          <span>{copiedMemo ? 'Breakdown Copied!' : 'Export Deal Sheet'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenNewCandidateModal(char.name)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded-xl flex items-center gap-2 shadow-lg transition-all transform active:scale-95"
                        >
                          <UserPlus size={16} />
                          <span>Add Candidate to {char.name}</span>
                        </button>
                      </div>
                    </div>

                    {/* CANDIDATES GRID */}
                    {artists.length === 0 ? (
                      <div className="p-16 text-center bg-[#0d0d11] border border-neutral-800 rounded-3xl space-y-4 shadow-xl">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-amber-400">
                          <Users size={32} />
                        </div>
                        <div>
                          <h3 className="text-lg font-mono font-bold text-white">No Talent Candidates Shortlisted Yet</h3>
                          <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
                            Start adding actors, headshots, agency contacts, and audition reels for <strong className="text-amber-400">{char.name}</strong>.
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenNewCandidateModal(char.name)}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs uppercase rounded-xl inline-flex items-center gap-2 shadow-lg"
                        >
                          <UserPlus size={16} />
                          <span>Add Candidate Now</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {artists.map((artist, idx) => {
                          const isConfirmed = char.confirmedArtistId === artist.id || artist.status === 'on_board' || artist.status === 'contract_signed';
                          const stageInfo = PIPELINE_STAGES.find(s => s.id === artist.status) || PIPELINE_STAGES[0];

                          return (
                            <div 
                              key={artist.id}
                              className={`bg-[#0d0d11] border rounded-2xl p-5 space-y-4 shadow-2xl transition-all relative flex flex-col justify-between ${
                                isConfirmed ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              <div className="space-y-4">
                                
                                {/* TOP CARD BAR */}
                                <div className="flex items-center justify-between">
                                  <span className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono font-bold flex items-center gap-1.5">
                                    <Star size={12} className="text-amber-400 fill-amber-400" />
                                    OPTION {idx + 1}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border ${stageInfo.badgeClass}`}>
                                      {stageInfo.label}
                                    </span>

                                    <button
                                      onClick={() => handleOpenEditCandidateModal(char.name, artist)}
                                      className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors"
                                      title="Edit Candidate Details"
                                    >
                                      <Edit3 size={14} />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteArtist(char.name, artist.id)}
                                      className="p-1.5 bg-neutral-900 hover:bg-rose-950 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"
                                      title="Remove Candidate"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* ARTIST PROFILE & HEADSHOT */}
                                <div className="flex items-center gap-4">
                                  <div className="w-20 h-20 rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 relative shadow-inner group/photo">
                                    {artist.photoUrl ? (
                                      <img src={artist.photoUrl} alt={artist.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 space-y-1">
                                        <UserCheck size={28} />
                                        <span className="text-[9px] font-mono text-neutral-500">No Photo</span>
                                      </div>
                                    )}
                                    <label className="absolute inset-0 bg-black/75 opacity-0 group-hover/photo:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer">
                                      <Upload size={16} className="text-amber-400" />
                                      <span className="text-[8px] font-mono font-bold mt-1 uppercase text-center px-1">Upload Photos</span>
                                      <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          if (e.target.files) handleDirectCandidatePhotosUpload(char.name, artist.id, e.target.files);
                                        }}
                                      />
                                    </label>
                                  </div>

                                  <div className="space-y-1">
                                    <h3 className="text-base font-mono font-bold text-white uppercase">{artist.name}</h3>
                                    
                                    {/* RATING STARS */}
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} size={12} className={star <= (artist.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-neutral-800'} />
                                      ))}
                                    </div>

                                    {artist.dealTerms?.feeQuote || artist.feeQuote ? (
                                      <div className="text-xs font-mono font-bold text-emerald-400">
                                        {artist.dealTerms?.feeQuote || artist.feeQuote}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] font-mono text-neutral-500 italic">No Quote Set</div>
                                    )}
                                  </div>
                                </div>

                                {/* CANDIDATE MULTI-PHOTO STRIP & MAIN PICTURE SWITCHER */}
                                {(() => {
                                  const artistPhotos = artist.photos && artist.photos.length > 0
                                    ? artist.photos
                                    : (artist.photoUrl ? [artist.photoUrl] : []);
                                  
                                  if (artistPhotos.length === 0) return null;

                                  return (
                                    <div className="p-2.5 bg-[#121217] rounded-xl border border-neutral-800/80 space-y-1.5">
                                      <div className="flex items-center justify-between text-[9px] font-mono font-bold uppercase text-neutral-400">
                                        <span className="flex items-center gap-1 text-amber-400">
                                          <ImageIcon size={11} /> Photo Portfolio ({artistPhotos.length})
                                        </span>
                                        <span className="text-[8px] text-neutral-500">Click to set Main</span>
                                      </div>

                                      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                                        {artistPhotos.map((p, pIdx) => {
                                          const isMain = p === artist.photoUrl;
                                          return (
                                            <button
                                              key={pIdx}
                                              type="button"
                                              onClick={() => handleDirectCandidateSetMainPhoto(char.name, artist.id, p)}
                                              className={`relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border transition-all ${
                                                isMain
                                                  ? 'border-amber-400 ring-2 ring-amber-500/50 scale-105 shadow-md'
                                                  : 'border-neutral-800 opacity-70 hover:opacity-100 hover:border-neutral-600'
                                              }`}
                                              title={isMain ? 'Current Main Picture' : 'Click to set as Main Picture'}
                                            >
                                              <img src={p} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                              {isMain && (
                                                <div className="absolute top-0 right-0 bg-amber-400 text-black p-0.5 rounded-bl shadow-sm">
                                                  <Star size={7} className="fill-black" />
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })}

                                        <label className="w-10 h-10 rounded-lg border border-dashed border-neutral-700 hover:border-amber-500/60 bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-amber-400 cursor-pointer shrink-0 transition-colors" title="Add More Photos">
                                          <Plus size={14} />
                                          <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              if (e.target.files) handleDirectCandidatePhotosUpload(char.name, artist.id, e.target.files);
                                            }}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* CONTACT / AGENCY & REEL QUICK STATS */}
                                <div className="space-y-2 bg-[#121217] p-3 rounded-xl border border-neutral-800/80 text-xs font-mono text-neutral-300">
                                  <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 text-[10px] uppercase">Agency</span>
                                    <span className="font-bold text-white truncate max-w-[140px]">{artist.contact?.agency || 'Unassigned'}</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 text-[10px] uppercase">Agent</span>
                                    <span className="text-neutral-300 truncate max-w-[140px]">{artist.contact?.agentName || 'No Contact'}</span>
                                  </div>

                                  {artist.auditionUrl && (
                                    <div className="pt-1.5 border-t border-neutral-800/80 flex items-center justify-between">
                                      <span className="text-neutral-500 text-[10px] uppercase">Reel / Tape</span>
                                      <a
                                        href={artist.auditionUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1"
                                      >
                                        <Play size={11} /> Watch Tape
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {artist.notes && (
                                  <p className="text-xs text-neutral-400 line-clamp-2 italic">
                                    "{artist.notes}"
                                  </p>
                                )}

                              </div>

                              {/* ATTACH TALENT BUTTON */}
                              <button
                                onClick={() => handleConfirmArtist(char.name, artist.id)}
                                className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                  isConfirmed 
                                    ? 'bg-emerald-500 text-black shadow-lg' 
                                    : 'bg-neutral-900 text-emerald-400 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-800'
                                }`}
                              >
                                {isConfirmed ? (
                                  <>
                                    <CheckCircle2 size={16} />
                                    <span>Cast Confirmed</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck size={16} />
                                    <span>Attach Talent to Role</span>
                                  </>
                                )}
                              </button>

                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })()
            ) : (
              <div className="p-16 text-center text-neutral-500 font-mono">
                Select a production character role from the left sidebar to view talent candidates.
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 2: CHARACTER DOSSIER & SPECS & AI LOOKBOOK (INTEGRATED)
      ========================================================================= */}
      {activeViewMode === 'dossier' && (
        <div className="flex-1 flex overflow-hidden bg-[#08080a]">
          
          {/* ROLE SELECTOR SIDEBAR */}
          <div className="w-80 bg-[#0d0d11] border-r border-neutral-800 p-4 flex flex-col space-y-4 shrink-0 overflow-y-auto custom-scrollbar">
            <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
              Select Character Role
            </div>

            <div className="space-y-2">
              {roleNames.map(name => {
                const isSelected = activeRoleName === name;
                const char = characterData[name];

                return (
                  <button
                    key={name}
                    onClick={() => setSelectedRole(name)}
                    className={`w-full text-left p-3 rounded-xl font-mono text-xs uppercase font-bold transition-all flex items-center justify-between border ${
                      isSelected ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-[#121217] border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>{name}</span>
                    <span className="text-[10px] text-neutral-500 font-normal">{char?.billingTier || 'Supporting'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MAIN DOSSIER EDITOR */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {activeRoleName && characterData[activeRoleName] ? (
              (() => {
                const char = characterData[activeRoleName];

                return (
                  <div className="max-w-5xl mx-auto space-y-8">
                    
                    {/* ROLE HEADER */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase border border-amber-500/30">
                            CHARACTER SPECS & SPECTRUM
                          </span>
                        </div>
                        <h2 className="text-2xl font-mono font-bold text-white uppercase">{char.name}</h2>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDeleteRole(char.name)}
                          className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5"
                        >
                          <Trash2 size={14} /> Delete Role
                        </button>
                      </div>
                    </div>

                    {/* BASIC SPECS & VITALS */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl space-y-4 shadow-xl">
                      <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                        <Fingerprint size={16} />
                        <span>Basic Character Vitals & Specs</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Billing Tier</label>
                          <select
                            value={char.billingTier || 'supporting'}
                            onChange={(e) => updateCharacter(char.name, { billingTier: e.target.value as any })}
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          >
                            {BILLING_TIERS.map(b => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Age / Playing Age</label>
                          <input
                            type="text"
                            value={char.playingAge || char.age || ''}
                            onChange={(e) => updateCharacter(char.name, { playingAge: e.target.value })}
                            placeholder="e.g. 28-35"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Gender</label>
                          <input
                            type="text"
                            value={char.gender || ''}
                            onChange={(e) => updateCharacter(char.name, { gender: e.target.value })}
                            placeholder="Female / Male / Non-Binary"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Accent / Dialect</label>
                          <input
                            type="text"
                            value={char.accent || ''}
                            onChange={(e) => updateCharacter(char.name, { accent: e.target.value })}
                            placeholder="e.g. Standard RP British, Brooklyn"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Archetype</label>
                          <input
                            type="text"
                            value={char.archetype || ''}
                            onChange={(e) => updateCharacter(char.name, { archetype: e.target.value })}
                            placeholder="e.g. The Ruler, Reluctant Hero"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Occupation</label>
                          <input
                            type="text"
                            value={char.occupation || ''}
                            onChange={(e) => updateCharacter(char.name, { occupation: e.target.value })}
                            placeholder="e.g. Lead Investigator"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Hair / Eyes</label>
                          <input
                            type="text"
                            value={`${char.hair || ''} ${char.eyes ? `/ ${char.eyes}` : ''}`}
                            onChange={(e) => updateCharacter(char.name, { hair: e.target.value })}
                            placeholder="Dark Brown / Hazel"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Build / Stature</label>
                          <input
                            type="text"
                            value={char.build || ''}
                            onChange={(e) => updateCharacter(char.name, { build: e.target.value })}
                            placeholder="Athletic / Tall"
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-500 mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3D PSYCHOLOGY & BACKSTORY */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl space-y-4 shadow-xl">
                      <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                        <Brain size={16} />
                        <span>3-Dimensional Character Profile & Backstory</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Physiology (Voice, Posture, Gait)</label>
                          <textarea
                            rows={3}
                            value={char.physiology || ''}
                            onChange={(e) => updateCharacter(char.name, { physiology: e.target.value })}
                            placeholder="Raspy voice, rigid posture, deliberate slow cadence..."
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs p-3 rounded-xl outline-none focus:border-amber-500 resize-none mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Sociology (Lineage, Class, Rank)</label>
                          <textarea
                            rows={3}
                            value={char.sociology || ''}
                            onChange={(e) => updateCharacter(char.name, { sociology: e.target.value })}
                            placeholder="Ivy League educated, high syndicate authority..."
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs p-3 rounded-xl outline-none focus:border-amber-500 resize-none mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Psychology (Drives, Flaws, Need)</label>
                          <textarea
                            rows={3}
                            value={char.psychology || ''}
                            onChange={(e) => updateCharacter(char.name, { psychology: e.target.value })}
                            placeholder="Calculating, obsessed with justice over civil law..."
                            className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs p-3 rounded-xl outline-none focus:border-amber-500 resize-none mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono text-neutral-400 uppercase">Full Character Backstory</label>
                        <textarea
                          rows={4}
                          value={char.backstory || ''}
                          onChange={(e) => updateCharacter(char.name, { backstory: e.target.value })}
                          placeholder="Comprehensive character backstory and narrative origins..."
                          className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 text-xs p-3 rounded-xl outline-none focus:border-amber-500 resize-none mt-1"
                        />
                      </div>
                    </div>

                    {/* AI CONCEPT LOOKBOOK & GALLERY WITH ATTACHMENTS */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                          <Wand2 size={16} />
                          <span>Character Visual Lookbook & Reference Photos</span>
                        </div>

                        <label className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors shadow-md">
                          <Upload size={14} />
                          <span>Upload Image Files</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) handleCharacterImageFilesUpload(char.name, e.target.files);
                            }}
                          />
                        </label>
                      </div>

                      <div className="p-4 bg-[#121217] border border-neutral-800/80 rounded-2xl space-y-3">
                        <div className="text-xs font-mono text-neutral-300">
                          Generate photorealistic studio artwork or attach reference photos for <strong className="text-amber-400">{char.name}</strong>:
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                          <input
                            type="text"
                            placeholder="Custom AI prompt override or leave empty to auto-generate from character backstory & specs..."
                            value={lookbookPromptCustom}
                            onChange={(e) => setLookbookPromptCustom(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs px-3 py-2.5 rounded-xl outline-none focus:border-amber-500"
                          />

                          <button
                            onClick={() => handleGenerateLookbookImage(char.name)}
                            disabled={isGeneratingLookbook}
                            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-mono font-bold uppercase rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shrink-0"
                          >
                            {isGeneratingLookbook ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Generating Concept...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 size={14} />
                                <span>Generate Concept Art</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* IMAGE GALLERY & DROPZONE */}
                      <div className="space-y-3 pt-1">
                        {char.images && char.images.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {char.images.map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative group aspect-video bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden shadow-lg">
                                <img src={imgUrl} alt="Concept Reference" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => {
                                    const updated = char.images?.filter((_, i) => i !== imgIdx);
                                    updateCharacter(char.name, { images: updated });
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-rose-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                  title="Remove image"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-800 hover:border-amber-500/50 bg-[#121217] rounded-2xl cursor-pointer transition-all text-center group">
                            <Upload size={28} className="text-neutral-600 group-hover:text-amber-400 mb-2 transition-colors" />
                            <span className="text-xs font-mono font-bold text-neutral-300 group-hover:text-white uppercase">
                              No Reference Photos or AI Art Yet
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 mt-1">
                              Click or drag local image files here to attach reference photos, headshots, or moodboards for {char.name}
                            </span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files) handleCharacterImageFilesUpload(char.name, e.target.files);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* CHARACTER RELATIONSHIPS */}
                    <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl space-y-4 shadow-xl">
                      <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                        <Heart size={16} />
                        <span>Character Relationships</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={newRelationTarget}
                          onChange={(e) => setNewRelationTarget(e.target.value)}
                          className="bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none"
                        >
                          <option value="">Select Target Character...</option>
                          {roleNames.filter(r => r !== char.name).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>

                        <select
                          value={newRelationType}
                          onChange={(e) => setNewRelationType(e.target.value)}
                          className="bg-[#141419] border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-xl outline-none"
                        >
                          {RELATIONSHIP_TYPES.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleAddRelationship(char.name)}
                          disabled={!newRelationTarget}
                          className="px-4 py-2 bg-neutral-800 hover:bg-amber-500 hover:text-black text-neutral-300 text-xs font-mono font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          Link Relationship
                        </button>
                      </div>

                      {char.relationships && char.relationships.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {char.relationships.map((rel, idx) => (
                            <div key={idx} className="bg-[#141419] border border-neutral-800 px-3 py-1.5 rounded-xl text-xs font-mono text-neutral-300 flex items-center gap-2">
                              <span><strong>{char.name}</strong> is <em>{rel.relation}</em> of <strong>{rel.characterName}</strong></span>
                              <button onClick={() => handleRemoveRelationship(char.name, idx)} className="text-neutral-500 hover:text-rose-400">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()
            ) : (
              <div className="p-16 text-center font-mono text-neutral-500">
                Select a character role from the left sidebar to edit its dossier specs.
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 3: CASTING PIPELINE (KANBAN STAGE COLUMNS)
      ========================================================================= */}
      {activeViewMode === 'pipeline' && (
        <div className="flex-1 p-6 overflow-x-auto custom-scrollbar bg-[#08080a] flex gap-5">
          {PIPELINE_STAGES.map(stage => {
            const stageArtists = allTalentRoster.filter(item => item.artist.status === stage.id);
            const isDraggedOver = draggedOverStage === stage.id;

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggedOverStage !== stage.id) {
                    setDraggedOverStage(stage.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDraggedOverStage(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggedOverStage(null);
                  try {
                    const rawData = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
                    if (rawData) {
                      const { charName, artistId } = JSON.parse(rawData);
                      if (charName && artistId) {
                        handleMoveCandidateStage(charName, artistId, stage.id as any);
                      }
                    }
                  } catch (err) {
                    console.error('Drop parse error:', err);
                  }
                  setDraggingArtistInfo(null);
                }}
                className={`w-80 bg-[#0d0d11] border rounded-2xl p-4 flex flex-col shrink-0 space-y-4 max-h-full shadow-xl transition-all duration-200 ${
                  isDraggedOver
                    ? 'border-amber-400 ring-2 ring-amber-500/30 bg-[#14141d] scale-[1.01]'
                    : 'border-neutral-800'
                }`}
              >
                
                {/* STAGE HEADER */}
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">{stage.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold transition-colors ${
                    isDraggedOver
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}>
                    {stageArtists.length}
                  </span>
                </div>

                {/* STAGE CARDS CONTAINER */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 min-h-[180px]">
                  {stageArtists.length === 0 ? (
                    <div className={`p-8 text-center border-2 border-dashed rounded-xl text-[11px] font-mono transition-colors flex flex-col items-center justify-center gap-2 ${
                      isDraggedOver
                        ? 'border-amber-400/80 bg-amber-500/10 text-amber-300'
                        : 'border-neutral-800/80 text-neutral-600'
                    }`}>
                      <GripVertical size={18} className={isDraggedOver ? 'text-amber-400 animate-bounce' : 'text-neutral-700'} />
                      <span>{isDraggedOver ? `Drop talent to move to ${stage.label}` : 'Drag candidates here'}</span>
                    </div>
                  ) : (
                    stageArtists.map(({ charName, artist }) => {
                      const isBeingDragged = draggingArtistInfo?.artistId === artist.id;

                      return (
                        <div 
                          key={artist.id}
                          draggable
                          onDragStart={(e) => {
                            const payload = JSON.stringify({ charName, artistId: artist.id });
                            e.dataTransfer.setData('text/plain', payload);
                            e.dataTransfer.setData('application/json', payload);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggingArtistInfo({ charName, artistId: artist.id });
                          }}
                          onDragEnd={() => {
                            setDraggingArtistInfo(null);
                            setDraggedOverStage(null);
                          }}
                          className={`bg-[#121217] border p-3.5 rounded-xl space-y-3 shadow-md group transition-all cursor-grab active:cursor-grabbing select-none ${
                            isBeingDragged
                              ? 'opacity-40 border-amber-500 ring-2 ring-amber-500/50 scale-95'
                              : 'border-neutral-800 hover:border-amber-500/60 hover:shadow-lg'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <GripVertical size={14} className="text-neutral-600 group-hover:text-amber-400 transition-colors" />
                              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Role: {charName}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCandidateModal(charName, artist);
                              }}
                              className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors"
                              title="Edit candidate profile"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 relative shadow-inner">
                              {artist.photoUrl ? (
                                <img src={artist.photoUrl} alt={artist.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-mono font-bold text-neutral-600 text-xs">
                                  {artist.name.substring(0, 2)}
                                </div>
                              )}
                              {artist.rank && (
                                <div className="absolute top-0 right-0 bg-black/80 text-amber-400 font-mono text-[8px] font-bold px-1 rounded-bl">
                                  #{artist.rank}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="font-mono font-bold text-xs text-white uppercase truncate">{artist.name}</h4>
                              <div className="text-[10px] font-mono text-neutral-400 truncate">{artist.contact?.agency || 'No Agency'}</div>
                              {artist.feeQuote && (
                                <div className="text-[9px] font-mono text-amber-400/90 font-semibold truncate mt-0.5">
                                  {artist.feeQuote}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* MOVE STAGE SELECTOR (Alternative to drag) */}
                          <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                            <span className="flex items-center gap-1 text-neutral-500">
                              <GripVertical size={11} /> Drag or Stage:
                            </span>
                            <select
                              value={artist.status}
                              onChange={(e) => handleMoveCandidateStage(charName, artist.id, e.target.value as any)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-neutral-950 border border-neutral-800 text-amber-400 text-[10px] font-bold px-2 py-1 rounded outline-none cursor-pointer hover:border-amber-500/50"
                            >
                              {PIPELINE_STAGES.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          VIEW 4: MASTER MATRIX TABLE
      ========================================================================= */}
      {activeViewMode === 'matrix' && (
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#08080a] space-y-6">
          
          <div className="bg-[#0d0d11] border border-neutral-800 p-4 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-2.5 text-neutral-500" size={15} />
                <input 
                  type="text"
                  placeholder="Search matrix by character, artist, agency, accent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#141418] border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-neutral-200 placeholder-neutral-500 outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportMatrixCSV}
                  className="px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 shadow-md"
                >
                  <FileText size={14} />
                  <span>Export Master CSV</span>
                </button>
              </div>

            </div>
          </div>

          <div className="bg-[#0d0d11] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#111115] border-b border-neutral-800 text-[11px] font-mono font-black text-neutral-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Character Role</th>
                    <th className="py-3.5 px-4">Billing Tier</th>
                    <th className="py-3.5 px-4">Vitals Specs</th>
                    <th className="py-3.5 px-4 text-center">Script Footprint</th>
                    <th className="py-3.5 px-4">Primary Talent Option</th>
                    <th className="py-3.5 px-4">Casting Stage</th>
                    <th className="py-3.5 px-4">Fee Quote</th>
                    <th className="py-3.5 px-4">Agency</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80 text-xs font-mono">
                  {sortedCastList.map(char => {
                    const topArtist = (char.artists || []).find(a => a.id === char.confirmedArtistId) || (char.artists || [])[0];
                    const stageInfo = topArtist ? PIPELINE_STAGES.find(s => s.id === topArtist.status) : null;

                    return (
                      <tr key={char.name} className="hover:bg-[#121217] transition-colors">
                        <td className="py-3.5 px-4 font-bold uppercase text-white">
                          {char.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-neutral-900 border border-neutral-800 text-amber-400">
                            {char.billingTier || 'Supporting'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                          {char.playingAge || char.age || '30'} yrs • {char.gender || 'Unspecified'}
                        </td>
                        <td className="py-3.5 px-4 text-center text-neutral-300">
                          {char.sceneCount} Sc ({char.dialogueWords} Wds)
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {topArtist ? topArtist.name : <span className="text-neutral-600 font-normal">Unassigned</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          {stageInfo ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${stageInfo.badgeClass}`}>
                              {stageInfo.label}
                            </span>
                          ) : (
                            <span className="text-neutral-600 text-[10px]">No Prospects</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-400 font-bold">
                          {topArtist?.dealTerms?.feeQuote || topArtist?.feeQuote || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-300">
                          {topArtist?.contact?.agency || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedRole(char.name);
                              setActiveViewMode('catalogue');
                            }}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-amber-500 hover:text-black text-neutral-200 rounded text-[10px] font-bold"
                          >
                            View Roster
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW 5: TALENT EVALUATOR & COMPARISON
      ========================================================================= */}
      {activeViewMode === 'comparison' && (
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-[#08080a] space-y-6">
          <div className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-mono font-bold text-white uppercase">Talent Evaluation & Comparison Matrix</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Compare shortlisted actors side-by-side for role: <strong className="text-amber-400">{activeRoleName || 'All Roles'}</strong>
              </p>
            </div>

            <select
              value={activeRoleName}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-[#141419] border border-neutral-800 text-amber-400 font-mono font-bold text-xs px-4 py-2.5 rounded-xl outline-none"
            >
              {roleNames.map(name => (
                <option key={name} value={name}>Role: {name}</option>
              ))}
            </select>
          </div>

          {activeRoleName && characterData[activeRoleName] ? (
            (() => {
              const char = characterData[activeRoleName];
              const artists = char.artists || [];

              if (artists.length === 0) {
                return (
                  <div className="p-16 text-center bg-[#0d0d11] border border-neutral-800 rounded-3xl font-mono text-neutral-500 space-y-3">
                    <p>No candidate options to evaluate for role {char.name}.</p>
                    <button
                      onClick={() => handleOpenNewCandidateModal(char.name)}
                      className="px-4 py-2 bg-amber-500 text-black font-bold text-xs uppercase rounded-xl inline-flex items-center gap-2"
                    >
                      <UserPlus size={14} /> Add Candidate Now
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {artists.map((art, idx) => (
                    <div key={art.id} className="bg-[#0d0d11] border border-neutral-800 p-6 rounded-2xl space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-400 uppercase">OPTION {idx + 1}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                          {art.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0">
                          {art.photoUrl ? (
                            <img src={art.photoUrl} alt={art.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-mono text-neutral-600 font-bold">
                              {art.name.substring(0, 2)}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-mono font-bold text-white uppercase">{art.name}</h3>
                          <div className="text-xs font-mono text-emerald-400 font-bold">{art.dealTerms?.feeQuote || art.feeQuote || 'No Quote'}</div>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs font-mono text-neutral-300 bg-[#121217] p-3 rounded-xl border border-neutral-800">
                        <div><strong className="text-neutral-500">Agency:</strong> {art.contact?.agency || 'N/A'}</div>
                        <div><strong className="text-neutral-500">Agent:</strong> {art.contact?.agentName || 'N/A'}</div>
                        <div><strong className="text-neutral-500">Guild Tier:</strong> {art.dealTerms?.sagTier || 'N/A'}</div>
                        {art.auditionUrl && (
                          <div>
                            <strong className="text-neutral-500">Reel:</strong>{' '}
                            <a href={art.auditionUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                              Watch Video
                            </a>
                          </div>
                        )}
                      </div>

                      {art.notes && (
                        <p className="text-xs font-mono text-neutral-400 italic">"{art.notes}"</p>
                      )}

                      <button
                        onClick={() => handleConfirmArtist(char.name, art.id)}
                        className={`w-full py-2 rounded-xl text-xs font-mono font-bold uppercase ${
                          char.confirmedArtistId === art.id ? 'bg-emerald-500 text-black' : 'bg-neutral-900 border border-neutral-800 text-emerald-400 hover:bg-neutral-800'
                        }`}
                      >
                        {char.confirmedArtistId === art.id ? 'Confirmed Cast' : 'Select as Preferred'}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : null}
        </div>
      )}

      {/* =========================================================================
          CANDIDATE CREATION & EDIT MODAL (RELIABLE & FULL-FEATURED)
      ========================================================================= */}
      {isCandidateModalOpen && editingArtistData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-[#0d0d12] border border-neutral-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
            
            {/* MODAL HEADER */}
            <div className="px-6 py-4 bg-[#111116] border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-mono font-bold text-white uppercase">
                    {editingArtistData.isNew ? 'Add New Talent Candidate' : 'Edit Candidate Profile'}
                  </h3>
                  <p className="text-[10px] font-mono text-neutral-400">
                    Assigning to Role: <strong className="text-amber-400">{editingArtistData.charName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsCandidateModalOpen(false);
                  setEditingArtistData(null);
                }}
                className="text-neutral-500 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY FORM */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 font-mono text-xs">
              
              {/* TARGET ROLE SELECTION */}
              <div className="space-y-1.5">
                <label className="text-neutral-400 text-[10px] font-bold uppercase">Assign Candidate to Character Role</label>
                <select
                  value={editingArtistData.charName}
                  onChange={(e) => setEditingArtistData(prev => prev ? { ...prev, charName: e.target.value } : null)}
                  className="w-full bg-[#141419] border border-neutral-800 text-amber-400 font-bold px-3 py-2.5 rounded-xl outline-none focus:border-amber-500"
                >
                  {roleNames.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* CANDIDATE NAME & RATING */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 text-[10px] font-bold uppercase">Candidate Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Al Pacino / Florence Pugh"
                    value={editingArtistData.artist.name}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, name: e.target.value }
                    } : null)}
                    className="w-full bg-[#141419] border border-neutral-800 text-white px-3 py-2.5 rounded-xl outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-400 text-[10px] font-bold uppercase">Casting Pipeline Stage</label>
                  <select
                    value={editingArtistData.artist.status}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, status: e.target.value as any }
                    } : null)}
                    className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 px-3 py-2.5 rounded-xl outline-none focus:border-amber-500"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TALENT PHOTOS & MAIN PICTURE SELECTOR */}
              <div className="p-5 bg-[#121217] rounded-2xl border border-neutral-800/80 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                    <ImageIcon size={16} />
                    <span>Talent Headshots & Photo Gallery</span>
                    {((editingArtistData.artist.photos?.length || (editingArtistData.artist.photoUrl ? 1 : 0)) > 0) && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                        {(editingArtistData.artist.photos?.length || (editingArtistData.artist.photoUrl ? 1 : 0))} Photos
                      </span>
                    )}
                  </div>

                  <label className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors shadow-md">
                    <Upload size={14} />
                    <span>Upload Multiple Photos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) handleArtistPhotosUpload(e.target.files);
                      }}
                    />
                  </label>
                </div>

                {/* CURRENT MAIN PICTURE SPOTLIGHT */}
                <div className="p-4 bg-[#181820] border border-neutral-800 rounded-2xl flex flex-col md:flex-row items-center gap-4">
                  <div className="w-28 h-28 rounded-2xl bg-neutral-950 border-2 border-amber-500/60 overflow-hidden shrink-0 flex items-center justify-center relative shadow-xl group">
                    {editingArtistData.artist.photoUrl ? (
                      <img
                        src={editingArtistData.artist.photoUrl}
                        alt="Primary Main Headshot"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-600 p-2 text-center">
                        <UserCheck size={32} />
                        <span className="text-[9px] mt-1 text-neutral-500 font-bold">No Main Photo</span>
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-amber-500 text-black font-mono font-black text-[8px] uppercase px-1.5 py-0.5 rounded shadow-md flex items-center gap-0.5">
                      <Star size={9} className="fill-black" /> MAIN PICTURE
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 text-center md:text-left">
                    <h4 className="text-xs font-mono font-bold uppercase text-white">
                      Selected Main Profile Picture
                    </h4>
                    <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                      This photo is displayed on candidate cards, call sheets, pipeline boards, and matrix reports. Select any photo below to designate it as the main picture.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 justify-center md:justify-start">
                      <input
                        type="text"
                        placeholder="Or paste direct image URL..."
                        value={newWebPhotoUrl}
                        onChange={(e) => setNewWebPhotoUrl(e.target.value)}
                        className="bg-[#101014] border border-neutral-800 text-neutral-300 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-amber-500 flex-1 max-w-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newWebPhotoUrl) {
                            handleAddPhotoFromUrl(newWebPhotoUrl);
                            setNewWebPhotoUrl('');
                          }
                        }}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-xl text-xs font-mono font-bold uppercase transition-colors"
                      >
                        Add URL
                      </button>
                    </div>
                  </div>
                </div>

                {/* GALLERY THUMBNAILS WITH MAIN PICTURE SELECTOR */}
                {(() => {
                  const currentPhotos = editingArtistData.artist.photos && editingArtistData.artist.photos.length > 0
                    ? editingArtistData.artist.photos
                    : (editingArtistData.artist.photoUrl ? [editingArtistData.artist.photoUrl] : []);

                  if (currentPhotos.length === 0) {
                    return (
                      <div className="p-6 text-center border-2 border-dashed border-neutral-800 rounded-2xl text-neutral-500 space-y-2">
                        <ImageIcon size={28} className="mx-auto text-neutral-600" />
                        <div className="text-xs font-mono font-bold uppercase text-neutral-400">No Photos Attached Yet</div>
                        <div className="text-[11px] text-neutral-500">Upload multiple photos or paste image URLs to build this talent's headshot portfolio.</div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono font-bold uppercase text-neutral-400">
                        All Candidate Photos ({currentPhotos.length}) — Click photo or button to set as Main Picture:
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {currentPhotos.map((photo, pIdx) => {
                          const isMain = photo === editingArtistData.artist.photoUrl;
                          return (
                            <div
                              key={pIdx}
                              className={`relative group aspect-square rounded-2xl overflow-hidden border-2 transition-all shadow-md bg-neutral-950 ${
                                isMain
                                  ? 'border-amber-400 ring-2 ring-amber-500/40 scale-[1.02]'
                                  : 'border-neutral-800 hover:border-neutral-600'
                              }`}
                            >
                              <img
                                src={photo}
                                alt={`Talent photo ${pIdx + 1}`}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => handleSetMainArtistPhoto(photo)}
                              />

                              {/* MAIN BADGE OR SET MAIN BUTTON */}
                              {isMain ? (
                                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-black font-mono font-black text-[8px] uppercase px-1.5 py-0.5 rounded shadow-lg flex items-center gap-0.5">
                                  <Star size={9} className="fill-black" /> MAIN
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetMainArtistPhoto(photo)}
                                  className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-black text-amber-400 font-mono font-bold text-[9px] uppercase px-2 py-0.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-md"
                                >
                                  <Star size={10} /> Set Main
                                </button>
                              )}

                              {/* REMOVE PHOTO BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleRemoveArtistPhoto(photo)}
                                className="absolute top-1.5 right-1.5 p-1.5 bg-black/80 hover:bg-rose-900 text-neutral-300 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                title="Remove photo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* DEAL TERMS & QUOTE */}
              <div className="p-4 bg-[#121217] rounded-2xl border border-neutral-800/80 space-y-3">
                <div className="text-[10px] font-mono font-bold uppercase text-amber-400 flex items-center gap-1.5">
                  <IndianRupee size={14} />
                  <span>Fee Quote & Deal Terms (₹)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Fee Quote (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹5,00,000 or ₹15,000/day"
                      value={editingArtistData.artist.dealTerms?.feeQuote || editingArtistData.artist.feeQuote || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          feeQuote: e.target.value,
                          dealTerms: { ...(prev.artist.dealTerms || { feeType: 'weekly', sagTier: 'Guild / CINTAA Basic Agreement' }), feeQuote: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-emerald-400 font-bold px-3 py-2 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Rate Structure</label>
                    <select
                      value={editingArtistData.artist.dealTerms?.feeType || 'weekly'}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', sagTier: '' }), feeType: e.target.value as any }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-300 px-3 py-2 rounded-xl outline-none"
                    >
                      {FEE_TYPES.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Guild / Union Tier</label>
                    <select
                      value={editingArtistData.artist.dealTerms?.sagTier || SAG_TIERS[0]}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', feeType: 'weekly' }), sagTier: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-300 px-3 py-2 rounded-xl outline-none"
                    >
                      {SAG_TIERS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* AGENCY & CONTACTS */}
              <div className="p-4 bg-[#121217] rounded-2xl border border-neutral-800/80 space-y-3">
                <div className="text-[10px] font-mono font-bold uppercase text-amber-400 flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>Agency & Representation Contact</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Agency Name</label>
                    <input
                      type="text"
                      placeholder="e.g. CAA / WME / UTA"
                      value={editingArtistData.artist.contact?.agency || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          contact: { ...(prev.artist.contact || {}), agency: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-200 px-3 py-2 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Agent Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={editingArtistData.artist.contact?.agentName || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          contact: { ...(prev.artist.contact || {}), agentName: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-200 px-3 py-2 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Agent Phone</label>
                    <input
                      type="text"
                      placeholder="+1 (310) 555-0199"
                      value={editingArtistData.artist.contact?.phone || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          contact: { ...(prev.artist.contact || {}), phone: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-200 px-3 py-2 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-neutral-500 text-[9px] uppercase">Agent Email</label>
                    <input
                      type="text"
                      placeholder="agent@agency.com"
                      value={editingArtistData.artist.contact?.email || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          contact: { ...(prev.artist.contact || {}), email: e.target.value }
                        }
                      } : null)}
                      className="w-full bg-[#18181f] border border-neutral-800 text-neutral-200 px-3 py-2 rounded-xl outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* REEL URL & NOTES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 text-[10px] font-bold uppercase">Self-Tape / Reel Video Link</label>
                  <input
                    type="text"
                    placeholder="https://vimeo.com/... or YouTube link"
                    value={editingArtistData.artist.auditionUrl || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, auditionUrl: e.target.value }
                    } : null)}
                    className="w-full bg-[#141419] border border-neutral-800 text-cyan-400 px-3 py-2.5 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-400 text-[10px] font-bold uppercase">IMDb / Portfolio Link</label>
                  <input
                    type="text"
                    placeholder="https://imdb.com/name/nm..."
                    value={editingArtistData.artist.imdbUrl || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, imdbUrl: e.target.value }
                    } : null)}
                    className="w-full bg-[#141419] border border-neutral-800 text-neutral-300 px-3 py-2.5 rounded-xl outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-neutral-400 text-[10px] font-bold uppercase">Casting Notes & Comments</label>
                <textarea
                  rows={3}
                  placeholder="Notes regarding chemistry read, accent flexibility, availability windows, or director feedback..."
                  value={editingArtistData.artist.notes || ''}
                  onChange={(e) => setEditingArtistData(prev => prev ? {
                    ...prev,
                    artist: { ...prev.artist, notes: e.target.value }
                  } : null)}
                  className="w-full bg-[#141419] border border-neutral-800 text-neutral-200 p-3 rounded-xl outline-none focus:border-amber-500 resize-none"
                />
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-3 p-4 bg-[#111116] border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setIsCandidateModalOpen(false);
                  setEditingArtistData(null);
                }}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-mono font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveCandidateModal}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-mono font-bold uppercase shadow-lg transition-transform active:scale-95"
              >
                {editingArtistData.isNew ? 'Save New Candidate' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CastingView;
