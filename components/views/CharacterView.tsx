import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { generateImage } from '../../services/gemini';
import { toTamil, toEnglish } from '../../services/tamilUtils';
import { 
    User, Plus, Trash2, Search, 
    Fingerprint, Brain, Users, Activity, 
    Mic2, Sparkles, MoreHorizontal, Camera,
    Network, FileText, Link2, X,
    Upload, Image as ImageIcon,
    BookOpen, Clapperboard, Sun, Moon, TreePine, Box, Wand2, Calculator,
    BarChart3, Clock, MessageSquare, Radar, Skull, Smile, Frown, Megaphone, Shirt, Package, MapPin,
    ArrowRight, Tag, Languages, Merge, AlertCircle, Check, Briefcase, Filter,
    Heart, Shield, Swords, Zap, Repeat, GripHorizontal, AlignLeft, Layers, Flame
} from 'lucide-react';
import { CharacterData, CharacterRelationship, BreakdownData } from '../../types';
import { 
    CHARACTER_GENDERS, CHARACTER_HAIR, CHARACTER_EYES, 
    CHARACTER_BUILDS, CHARACTER_ARCHETYPES, CHARACTER_ROLES,
    RELATIONSHIP_TYPES
} from '../../constants';
import { BlockEditor } from '../BlockEditor';

// --- CINEMATIC TEMPLATES ---
const CINEMATIC_TEMPLATES: Partial<CharacterData>[] = [
    // GODFATHER
    { name: 'VITO CORLEONE', age: 60, gender: 'Male', ethnicity: 'Italian', hair: 'Grey', eyes: 'Brown', build: 'Heavy', occupation: 'Don', archetype: 'The Ruler', physiology: 'Raspy voice, slow movements.', sociology: 'Family patriarch, powerful connections.', psychology: 'Ruthless but sentimental. Justice over law.', backstory: 'Escaped Sicily as a child after family murder.' },
    { name: 'MICHAEL CORLEONE', age: 25, gender: 'Male', ethnicity: 'Italian-American', hair: 'Black', eyes: 'Black', build: 'Average', occupation: 'Marine / Don', archetype: 'Reluctant Hero', physiology: 'Clean shaven, intense stare.', sociology: 'War hero, Dartmouth grad.', psychology: 'Calculating, cold, transforms from idealist.', backstory: 'Youngest son, wanted no part of the business.' },
    { name: 'SONNY CORLEONE', age: 35, gender: 'Male', ethnicity: 'Italian-American', hair: 'Black, Curly', eyes: 'Brown', build: 'Muscular', occupation: 'Underboss', archetype: 'The Warrior', physiology: 'Impulsive, aggressive physical presence.', sociology: 'Eldest son, heir apparent.', psychology: 'Hot-tempered, fiercely protective, reckless.', backstory: 'Witnessed father\'s violence early on.' },
];

const EMOTION_KEYWORDS: Record<string, string[]> = {
    anger: ['angry', 'furious', 'shouts', 'screams', 'yells', 'rage', 'mad', 'snaps'],
    joy: ['smile', 'laugh', 'happy', 'grin', 'chuckle', 'excited', 'cheers'],
    sadness: ['cries', 'weeps', 'tears', 'sad', 'sob', 'grief', 'mourn'],
    fear: ['scared', 'afraid', 'terrified', 'trembles', 'shivers', 'panic'],
    surpise: ['shocked', 'gasps', 'stares', 'wide-eyed', 'stunned']
};

const ACTION_KEYWORDS = ['run', 'fight', 'punch', 'kick', 'shoot', 'kill', 'chase', 'jump', 'fall', 'slap', 'grab', 'throw', 'drive', 'crash', 'explode'];

const CharacterView: React.FC = () => {
  const { characterData, setCharacterData, beats, geminiApiKey } = useProject();
  
  // State for active selection and UI
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'assets' | 'backstory' | 'network' | 'stats'>('profile');
  const [nameInput, setNameInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // Track pending deletions
  const [isMergeMenuOpen, setIsMergeMenuOpen] = useState(false); // New state for merge dropdown
  const [castFilter, setCastFilter] = useState<'all' | 'speaking' | 'extras'>('all');
  
  // DRAG AND DROP RELATIONSHIPS STATE
  const [draggedSidebarChar, setDraggedSidebarChar] = useState<string | null>(null);
  const [dropTargetChar, setDropTargetChar] = useState<string | null>(null);
  const [isMainStageDropTarget, setIsMainStageDropTarget] = useState(false);
  const [relationModal, setRelationModal] = useState<{ source: string, target: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DYNAMIC CAST LIST GENERATION ---
  const castList = useMemo(() => {
      const explicitChars = new Set(Object.keys(characterData));
      const allNames = new Set(explicitChars);
      const usedNames = new Set<string>(); // Characters with speaking roles in script
      const breakdownNames = new Set<string>(); // Characters found in breakdown
      
      // Build an alias map for fast lookup: Alias -> RealName
      const aliasMap = new Map<string, string>();
      Object.values(characterData).forEach((c: CharacterData) => {
          c.aliases?.forEach(a => {
              if(a && a.trim()) aliasMap.set(a.trim().toUpperCase(), c.name);
          });
      });

      beats.forEach(b => {
          // 1. Script Content Scan
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const charBlocks = div.querySelectorAll('.sc-character');
          charBlocks.forEach(el => {
              const rawName = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
              if (rawName && rawName.length > 1) {
                  // Check if this script name is an alias for a real character
                  const realName = aliasMap.get(rawName);
                  if (realName) {
                      usedNames.add(realName);
                  } else {
                      allNames.add(rawName);
                      usedNames.add(rawName);
                  }
              }
          });

          // 2. Breakdown Data Scan (Sync with Breakdown Page)
          if (b.breakdown && b.breakdown.cast) {
              b.breakdown.cast.forEach(item => {
                  const rawName = typeof item === 'string' ? item : item.name;
                  const name = rawName.trim().toUpperCase();
                  if (name && name.length > 1) {
                      const realName = aliasMap.get(name);
                      if (realName) {
                          breakdownNames.add(realName);
                      } else {
                          allNames.add(name);
                          breakdownNames.add(name);
                      }
                  }
              });
          }
      });

      let list = Array.from(allNames).map(name => {
          const isSpeaking = usedNames.has(name);
          const isBreakdown = breakdownNames.has(name);
          
          const data = characterData[name] || {
              name,
              archetype: isSpeaking ? 'Script Character' : (isBreakdown ? 'Background / Extra' : 'Implied'),
              images: [],
              isImplicit: !explicitChars.has(name), // Flag for UI distinction
              aliases: []
          };
          return { 
              name, 
              ...data,
              isUsed: isSpeaking,
              inBreakdown: isBreakdown
          };
      });

      // Filter by Search
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          list = list.filter(c => (c.name || '').toLowerCase().includes(lower) || (c.archetype && c.archetype.toLowerCase().includes(lower)));
      }

      // Filter by Sidebar Tab
      if (castFilter === 'speaking') {
          list = list.filter(c => c.isUsed);
      } else if (castFilter === 'extras') {
          // Extras are those in breakdown but NOT speaking
          list = list.filter(c => c.inBreakdown && !c.isUsed);
      }

      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [characterData, beats, searchTerm, castFilter]);

  // --- SMART MERGE SUGGESTIONS ---
  const mergeSuggestions = useMemo(() => {
      if (!selectedCharId) return [];
      const currentName = selectedCharId;
      const candidates: any[] = [];
      
      // Calculate variations of current name
      const tamilVariant = toTamil(currentName);
      const englishVariant = toEnglish(currentName)?.toUpperCase();
      
      // We check against the FULL list, not just filtered view
      const allChars = Object.keys(characterData).concat(castList.map(c => c.name));
      const uniqueNames = Array.from(new Set(allChars));

      uniqueNames.forEach(name => {
          if (name === currentName) return; 
          
          let isMatch = false;
          let reason = '';

          // 1. Direct Transliteration Match
          if (tamilVariant && name === tamilVariant) { isMatch = true; reason = 'Tamil Translation'; }
          if (englishVariant && name === englishVariant) { isMatch = true; reason = 'English Translation'; }
          
          // 2. Reverse Check
          const cTamil = toTamil(name);
          const cEnglish = toEnglish(name)?.toUpperCase();
          
          if (cTamil === currentName) { isMatch = true; reason = 'Phonetic Match'; }
          if (cEnglish === currentName) { isMatch = true; reason = 'Phonetic Match'; }

          if (isMatch) {
              candidates.push({ name, matchReason: reason });
          }
      });
      return candidates;
  }, [selectedCharId, castList, characterData]);

  const hasSuggestions = mergeSuggestions.length > 0;

  // --- INFERRED ASSETS (OPTIMIZED) ---
  const inferredAssets = useMemo(() => {
      if (!selectedCharId) return [];
      
      // Escape for Regex
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const charNames = [selectedCharId, ...(characterData[selectedCharId]?.aliases || [])]
          .map(n => n.trim())
          .filter(n => n.length > 0);
      
      // Create a single optimized regex for all names: /\b(Name1|Name2)\b/i
      const charPattern = new RegExp(`\\b(${charNames.map(escapeRegExp).join('|')})\\b`, 'i');

      const assetMap = new Map<string, { category: string, item: string, count: number, scenes: Set<string> }>();

      beats.forEach((beat, idx) => {
          if (!beat.breakdown) return;
          const sceneName = beat.sceneNumber || (idx + 1).toString();
          
          // Extract plain text for fallback search
          const plainText = beat.content.replace(/<[^>]+>/g, ' '); 

          Object.entries(beat.breakdown).forEach(([cat, items]) => {
              if (cat === 'cast') return; // Skip cast list itself
              if (!Array.isArray(items)) return;
              
              items.forEach((i: any) => {
                  const source = typeof i === 'string' ? '' : (i.source || '');
                  const name = typeof i === 'string' ? i : i.name;
                  const itemNameSafe = escapeRegExp(name);

                  // 1. Direct Source Match (If Source Exists)
                  let isMatch = source && charPattern.test(source);

                  // 2. Fallback: Search in Script Content if source is missing or didn't match
                  if (!isMatch) {
                      // Find sentences containing the item name
                      // Regex matches sentences: [start] ... ItemName ... [end punctuation or newline]
                      const itemSentenceRegex = new RegExp(`[^.!?\\n]*\\b${itemNameSafe}\\b[^.!?\\n]*[.!?\\n]?`, 'gi');
                      const matches = plainText.match(itemSentenceRegex);
                      
                      if (matches) {
                          // Check if any of those sentences ALSO contain the character name
                          isMatch = matches.some(sentence => charPattern.test(sentence));
                      }
                  }
                  
                  // 3. Fallback: Item Name Ownership (e.g. "John's Gun")
                  if (!isMatch) {
                      isMatch = charPattern.test(name);
                  }

                  // If matched, add to asset map
                  if (isMatch) {
                      const key = `${cat}:${name.toLowerCase()}`;
                      if (!assetMap.has(key)) {
                          assetMap.set(key, {
                              category: cat,
                              item: name,
                              count: 0,
                              scenes: new Set()
                          });
                      }
                      const entry = assetMap.get(key)!;
                      entry.count++;
                      entry.scenes.add(sceneName);
                  }
              });
          });
      });
      return Array.from(assetMap.values());
  }, [selectedCharId, beats, characterData]);

  // --- PRODUCTION STATS CALCULATOR (ENHANCED) ---
  const charStats = useMemo(() => {
      if (!selectedCharId) return null;
      const name = selectedCharId.toUpperCase();
      const selectedChar = characterData[selectedCharId];
      
      const namesToCheck = [name, ...(selectedChar?.aliases || [])].map(n => n.toUpperCase().trim()).filter(n => n.length > 0);

      let scenes = 0;
      let int = 0; let ext = 0;
      let day = 0; let night = 0;
      let actionScenes = 0;
      let totalLines = 0;
      let totalWords = 0;
      let monologues = 0;
      let coOccurrences: Record<string, number> = {};
      let firstScene: string | null = null;
      let lastScene: string | null = null;
      let emotions: Record<string, number> = { anger: 0, joy: 0, sadness: 0, fear: 0, surpise: 0 };
      
      const timeline: ('active' | 'inactive')[] = [];

      const sortedBeats = [...beats].sort((a, b) => {
          if (Math.abs(a.x - b.x) > 50) return a.x - b.x; 
          return a.y - b.y;
      });

      sortedBeats.forEach((beat, index) => {
          const contentUpper = beat.content.toUpperCase();
          const isPresent = namesToCheck.some(n => {
              return contentUpper.includes(`>${n}<`) || contentUpper.includes(`>${n} (`) || contentUpper.includes(`CLASS="SC-LINE SC-CHARACTER">${n}`);
          });
          
          const inBreakdown = beat.breakdown?.cast?.some(c => {
              const cName = (typeof c === 'string' ? c : c.name).trim().toUpperCase();
              return namesToCheck.includes(cName);
          });

          if (isPresent || inBreakdown) { 
              scenes++;
              timeline.push('active');
              
              const sceneNum = beat.sceneNumber || (index + 1).toString();
              if (!firstScene) firstScene = sceneNum;
              lastScene = sceneNum;

              const p = (beat.slug.prefix || '').toUpperCase();
              const t = (beat.slug.time || '').toUpperCase();
              
              if (p.includes('INT')) int++;
              if (p.includes('EXT')) ext++;
              
              if (t.includes('DAY') || t.includes('MORNING') || t.includes('DAWN')) day++;
              if (t.includes('NIGHT') || t.includes('EVENING') || t.includes('DUSK')) night++;

              const actionText = beat.content.replace(/<[^>]+>/g, ' ').toUpperCase();
              const hasAction = ACTION_KEYWORDS.some(k => actionText.includes(k.toUpperCase()));
              if (hasAction) actionScenes++;

              const div = document.createElement('div');
              div.innerHTML = beat.content;
              const lines = div.querySelectorAll('.sc-line');
              let counting = false;
              
              lines.forEach(line => {
                  if (line.classList.contains('sc-character')) {
                      const charName = line.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
                      if (charName && namesToCheck.includes(charName)) {
                          counting = true;
                      } else {
                          counting = false;
                          if (charName && charName.length > 1) {
                              coOccurrences[charName] = (coOccurrences[charName] || 0) + 1;
                          }
                      }
                  } else if (line.classList.contains('sc-dialogue') && counting) {
                      const text = (line.textContent || '').trim();
                      const words = text.split(/\s+/).length;
                      totalLines++;
                      totalWords += words;
                      if (words > 40) monologues++;
                  } else if (line.classList.contains('sc-parenthetical') && counting) {
                      const parenText = line.textContent?.toLowerCase() || '';
                      Object.entries(EMOTION_KEYWORDS).forEach(([emotion, keywords]) => {
                          if (keywords.some(k => parenText.includes(k))) {
                              emotions[emotion] = (emotions[emotion] || 0) + 1;
                          }
                      });
                  } else if (!line.classList.contains('sc-parenthetical')) {
                      counting = false;
                  }
              });

          } else {
              timeline.push('inactive');
          }
      });

      const topRelationships = Object.entries(coOccurrences)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([char, count]) => ({ char, count }));

      const totalScenes = beats.length || 1;
      const percentPresence = Math.round((scenes / totalScenes) * 100);
      const estimatedShootDays = Math.ceil(((scenes - actionScenes) * 0.2) + (actionScenes * 0.4));

      return { 
          scenes, int, ext, day, night, actionScenes, 
          totalLines, totalWords, monologues, 
          firstScene, lastScene, estimatedShootDays,
          timeline, topRelationships, percentPresence, emotions 
      };
  }, [beats, selectedCharId, characterData]);

  // Select first character on load if none selected
  useEffect(() => {
      if (!selectedCharId && castList.length > 0) {
          setSelectedCharId(castList[0].name);
      }
  }, [castList]);

  // Sync Input Name
  useEffect(() => {
      if (selectedCharId) {
          setNameInput(selectedCharId);
      }
  }, [selectedCharId]);

  const handleSelectCharacter = (name: string) => {
      if (!characterData[name]) {
          const newChar: CharacterData = {
              name,
              physiology: '', sociology: '', psychology: '', backstory: '',
              age: 30, gender: 'Unknown', ethnicity: 'Unknown', hair: 'Unknown', eyes: 'Unknown', build: 'Average',
              occupation: 'Unspecified', archetype: 'Script Character',
              images: [], relationships: [], aliases: []
          };
          setCharacterData(prev => ({ ...prev, [name]: newChar }));
      }
      setSelectedCharId(name);
  };

  const selectedChar = selectedCharId ? characterData[selectedCharId] : null;
  
  if (selectedChar) {
      if (!selectedChar.relationships) selectedChar.relationships = [];
      if (!selectedChar.backstory) selectedChar.backstory = '';
      if (!selectedChar.aliases) selectedChar.aliases = [];
  }

  // ... (Drag & Drop Handlers, Add/Update/Merge Logic - Unchanged from previous implementation)
  const handleSidebarDragStart = (e: React.DragEvent, name: string) => {
      setDraggedSidebarChar(name);
      e.dataTransfer.effectAllowed = 'link';
      e.dataTransfer.setData('text/plain', name);
  };

  const handleSidebarDragOver = (e: React.DragEvent, name: string) => {
      e.preventDefault();
      if (draggedSidebarChar && draggedSidebarChar !== name) setDropTargetChar(name);
  };

  const handleSidebarDragLeave = (e: React.DragEvent) => {
      setDropTargetChar(null);
  };

  const handleSidebarDrop = (e: React.DragEvent, targetName: string) => {
      e.preventDefault();
      setDropTargetChar(null);
      const sourceName = draggedSidebarChar;
      setDraggedSidebarChar(null);
      if (!sourceName || sourceName === targetName) return;
      setRelationModal({ source: sourceName, target: targetName });
  };

  const handleMainStageDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedSidebarChar && selectedCharId && draggedSidebarChar !== selectedCharId) {
          setIsMainStageDropTarget(true);
      }
  };

  const handleMainStageDragLeave = (e: React.DragEvent) => {
      setIsMainStageDropTarget(false);
  };

  const handleMainStageDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsMainStageDropTarget(false);
      const sourceName = draggedSidebarChar;
      const targetName = selectedCharId;
      setDraggedSidebarChar(null);
      if (!sourceName || !targetName || sourceName === targetName) return;
      setRelationModal({ source: sourceName, target: targetName });
  };

  const confirmConnection = (type: string) => {
      if (!relationModal) return;
      const { source, target } = relationModal;
      if (type === 'MERGE') {
          handleMerge(target, source);
      } else {
          setCharacterData(prev => {
              const newState = { ...prev };
              if (!newState[source]) newState[source] = { name: source, aliases: [], images: [], relationships: [], physiology: '', sociology: '', psychology: '', backstory: '', occupation: '', archetype: '', age: 0, gender: '', hair: '', eyes: '', build: '' };
              if (!newState[target]) newState[target] = { name: target, aliases: [], images: [], relationships: [], physiology: '', sociology: '', psychology: '', backstory: '', occupation: '', archetype: '', age: 0, gender: '', hair: '', eyes: '', build: '' };
              const sourceChar = newState[source];
              const existingRel = sourceChar.relationships.find(r => r.target === target);
              if (existingRel) existingRel.type = type;
              else sourceChar.relationships.push({ target: target, type: type });
              return newState;
          });
      }
      setRelationModal(null);
  };

  const handleAddCharacter = () => {
    const existingNames = Object.keys(characterData).map(n => n.toUpperCase());
    const availableTemplates = CINEMATIC_TEMPLATES.filter(t => !existingNames.includes(t.name?.toUpperCase() || ''));
    if (availableTemplates.length === 0) {
        let i = 1;
        while (existingNames.includes(`NEW CHARACTER ${i}`)) i++;
        const name = `NEW CHARACTER ${i}`;
        const newChar: CharacterData = { name, physiology: '', sociology: '', psychology: '', backstory: '', age: 25, gender: 'Unknown', ethnicity: 'Unknown', hair: 'Unknown', eyes: 'Unknown', build: 'Average', occupation: '', archetype: 'New Arrival', images: [], relationships: [], aliases: [] };
        setCharacterData(prev => ({ ...prev, [name]: newChar }));
        setSelectedCharId(name);
        return;
    }
    const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    const name = template.name!; 
    const newChar: CharacterData = {
      name, age: 0, gender: '', ethnicity: '', hair: '', eyes: '', build: '', archetype: '', physiology: '', sociology: '', psychology: '', backstory: '', occupation: '', images: [], relationships: [], aliases: [],
      templateDefaults: { physiology: template.physiology, sociology: template.sociology, psychology: template.psychology, backstory: template.backstory, occupation: template.occupation, archetype: template.archetype, age: template.age, gender: template.gender, ethnicity: template.ethnicity, hair: template.hair, eyes: template.eyes, build: template.build }
    };
    setCharacterData(prev => ({ ...prev, [name]: newChar }));
    setSelectedCharId(name);
  };

  const updateCharacter = (name: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({ ...prev, [name]: { ...prev[name], ...updates } }));
  };

  // --- FIXED MERGE LOGIC ---
  const handleMerge = (targetName: string, sourceNameOverride?: string) => {
      const sourceName = sourceNameOverride || selectedChar?.name;
      if (!sourceName || sourceName === targetName) { setIsMergeMenuOpen(false); return; }
      if (!sourceNameOverride && !window.confirm(`Merge "${sourceName}" into "${targetName}"?`)) return;
      
      setCharacterData(prev => {
          const newState = { ...prev };
          
          // Ensure we work with a deep copy of target, or a new object if it doesn't exist
          const existingTarget = newState[targetName];
          const targetChar: CharacterData = existingTarget 
              ? { 
                  ...existingTarget,
                  aliases: [...(existingTarget.aliases || [])],
                  images: [...(existingTarget.images || [])],
                  relationships: [...(existingTarget.relationships || [])]
              } 
              : { 
                  name: targetName, 
                  aliases: [], images: [], relationships: [], 
                  physiology: '', sociology: '', psychology: '', backstory: '', occupation: '', archetype: '', 
                  age: 0, gender: '', hair: '', eyes: '', build: '' 
              };
          
          const sourceChar = newState[sourceName];

          // 1. Merge Aliases
          const newAliases = new Set([...targetChar.aliases, sourceName]);
          if (sourceChar && sourceChar.aliases) {
              sourceChar.aliases.forEach(a => newAliases.add(a));
          }
          targetChar.aliases = Array.from(newAliases);

          // 2. Merge Images (Safe)
          const newImages = new Set(targetChar.images);
          if (sourceChar && sourceChar.images) {
              sourceChar.images.forEach(img => {
                  if (img) newImages.add(img);
              });
          }
          targetChar.images = Array.from(newImages);

          // Update State
          newState[targetName] = targetChar;
          delete newState[sourceName];
          
          return newState;
      });
      
      setSelectedCharId(targetName);
      setIsMergeMenuOpen(false);
  };

  // ... (Other functions: addAlias, removeAlias, handleDelete, handleRename, generatePortrait, processFile, etc. keep same)
  const addAlias = () => { if (!selectedChar || !aliasInput.trim()) return; const newAlias = aliasInput.trim().toUpperCase(); if (newAlias === selectedChar.name || selectedChar.aliases.includes(newAlias)) { setAliasInput(''); return; } updateCharacter(selectedChar.name, { aliases: [...(selectedChar.aliases || []), newAlias] }); setAliasInput(''); };
  const removeAlias = (aliasToRemove: string) => { if (!selectedChar) return; updateCharacter(selectedChar.name, { aliases: (selectedChar.aliases || []).filter(a => a !== aliasToRemove) }); };
  const handleDelete = (name: string) => {
      const isUsedInScript = beats.some(beat => { const div = document.createElement('div'); div.innerHTML = beat.content; const charBlocks = div.querySelectorAll('.sc-character'); return Array.from(charBlocks).some(el => el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase() === name.toUpperCase()); });
      if (isUsedInScript) { alert(`Cannot delete ${name}: Character is speaking in script.`); return; }
      setCharacterData(prev => { const newMap = { ...prev }; delete newMap[name]; return newMap; });
      if (selectedCharId === name) setSelectedCharId(null);
  };
  const handleRename = () => { if (!selectedChar) return; const oldName = selectedChar.name; const newName = nameInput.trim().toUpperCase(); if (oldName === newName || !newName) { setNameInput(oldName); return; } if (characterData[newName]) { alert("Name exists."); setNameInput(oldName); return; } setCharacterData(prev => { const data = prev[oldName]; const newState = { ...prev }; delete newState[oldName]; newState[newName] = { ...data, name: newName }; return newState; }); setSelectedCharId(newName); };
  const generatePortrait = async (char: CharacterData) => { if (!geminiApiKey) { alert("API Key Required."); return; } setIsGenerating(true); const prompt = `Cinematic character portrait, close-up. Subject: ${char.name}, ${char.age} yrs, ${char.gender}. ${char.hair} hair, ${char.eyes} eyes. Vibe: ${char.archetype}. Style: Hyper-realistic 35mm film.`; try { const img = await generateImage(prompt, '1:1', 'gemini-2.5-flash-image', geminiApiKey); if (img) updateCharacter(char.name, { images: [img, ...char.images] }); } catch (e) { console.error(e); } finally { setIsGenerating(false); } };
  const processFile = (file: File) => { if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = (e) => { const result = e.target?.result as string; if (result && selectedChar) updateCharacter(selectedChar.name, { images: [result, ...selectedChar.images] }); }; reader.readAsDataURL(file); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) processFile(e.target.files[0]); e.target.value = ''; };
  const handleDeleteImage = (index: number) => { if (!selectedChar) return; const newImages = [...selectedChar.images]; newImages.splice(index, 1); updateCharacter(selectedChar.name, { images: newImages }); };
  const handlePromoteImage = (index: number) => { if (!selectedChar) return; const newImages = [...selectedChar.images]; const [promoted] = newImages.splice(index, 1); newImages.unshift(promoted); updateCharacter(selectedChar.name, { images: newImages }); };
  const removeRelationship = (targetName: string) => { if (!selectedChar) return; updateCharacter(selectedChar.name, { relationships: (selectedChar.relationships || []).filter(r => r.target !== targetName) }); };
  const updateRelationship = (targetName: string, field: keyof CharacterRelationship, value: string) => { if (!selectedChar) return; updateCharacter(selectedChar.name, { relationships: (selectedChar.relationships || []).map(r => r.target === targetName ? { ...r, [field]: value } : r) }); };
  const addRelationship = (targetName: string, type: string) => { if (!selectedChar) return; const currentRels = selectedChar.relationships || []; if (currentRels.some(r => r.target === targetName)) return; updateCharacter(selectedChar.name, { relationships: [...currentRels, { target: targetName, type }] }); };

  const isApiConnected = !!geminiApiKey;
  const RELATIONSHIP_OPTIONS = [{ type: 'Family', icon: Users, color: 'text-blue-400' }, { type: 'Lover', icon: Heart, color: 'text-pink-500' }, { type: 'Enemy', icon: Swords, color: 'text-red-500' }, { type: 'Ally', icon: Shield, color: 'text-green-500' }, { type: 'Sibling', icon: Repeat, color: 'text-purple-400' }, { type: 'Rival', icon: Zap, color: 'text-orange-500' }];

  return (
    <div className="flex w-full h-full bg-[#050505] text-gray-200 font-sans overflow-hidden relative">
      
      {/* --- SIDEBAR --- */}
      <div className="w-72 border-r border-[#222] flex flex-col bg-[#0a0a0a] shrink-0 z-20">
        <div className="p-4 border-b border-[#222] space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#555]">Cast Manifest</span>
                <button onClick={handleAddCharacter} className="p-1.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded transition-all shadow-lg hover:scale-105" title="Add Character"><Plus size={14} strokeWidth={3} /></button>
            </div>
            <div className="relative group">
                <Search className="absolute left-2.5 top-2 text-[#444] group-focus-within:text-[#f5a623] transition-colors" size={14} />
                <input type="text" placeholder="Search cast..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#151515] border border-[#222] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-all" />
            </div>
            <div className="flex gap-1">
                {['all', 'speaking', 'extras'].map(f => (
                    <button key={f} onClick={() => setCastFilter(f as any)} className={`flex-1 py-1 text-[9px] font-bold uppercase rounded border ${castFilter === f ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'border-[#333] text-gray-500 hover:text-white'}`}>{f}</button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {castList.map((data: any) => {
            const isConfirming = confirmDeleteId === data.name;
            const isSelected = selectedCharId === data.name;
            return (
                <div 
                    key={data.name} 
                    onClick={() => handleSelectCharacter(data.name)} 
                    draggable
                    onDragStart={(e) => handleSidebarDragStart(e, data.name)}
                    onDragOver={(e) => handleSidebarDragOver(e, data.name)}
                    onDragLeave={handleSidebarDragLeave}
                    onDrop={(e) => handleSidebarDrop(e, data.name)}
                    className={`group p-2 flex items-center gap-3 cursor-pointer rounded-lg border transition-all relative ${dropTargetChar === data.name ? 'border-dashed border-2 border-[#f5a623] bg-[#f5a623]/10 scale-105 z-10' : 'border-transparent'} ${isSelected ? 'bg-[#1a1a1a] border-[#333] shadow-md' : 'hover:bg-[#111] hover:border-[#222]'}`}
                >
                <div className={`w-10 h-10 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border ${isSelected ? 'border-[#f5a623]' : 'border-[#333]'} bg-[#000] relative`}>
                    {data.images && data.images.length > 0 ? (
                    <img src={data.images[0]} alt={data.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                    <User size={18} className={data.isImplicit ? "text-[#444]" : "text-[#888]"} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`truncate text-sm font-bold flex items-center gap-2 ${isSelected ? 'text-white' : 'text-gray-500 group-hover:text-gray-400'}`}>
                        {data.name}
                        {data.isImplicit && !data.inBreakdown && <span title="Found in Script"><BookOpen size={10} className="text-[#444]" /></span>}
                    </div>
                    <div className="truncate text-[10px] font-mono text-[#555] uppercase">{data.archetype || 'Archetype'}</div>
                </div>
                <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity z-10 flex items-center gap-1 ${isConfirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {data.inBreakdown && <span className="p-1"><Users size={12} className="text-yellow-500" /></span>}
                    {data.isUsed ? <span className="p-1"><Link2 size={12} className="text-blue-500" /></span> : <button onClick={(e) => { e.stopPropagation(); if (isConfirming) { handleDelete(data.name); setConfirmDeleteId(null); } else { setConfirmDeleteId(data.name); setTimeout(() => setConfirmDeleteId(null), 3000); } }} className={`p-2 rounded transition-all ${isConfirming ? 'text-red-500 bg-red-900/20 shadow-md' : 'text-[#444] hover:text-red-500 hover:bg-[#222]'}`}><Trash2 size={14} /></button>}
                </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* --- MAIN STAGE --- */}
      <div 
        className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative"
        onDragOver={handleMainStageDragOver}
        onDragLeave={handleMainStageDragLeave}
        onDrop={handleMainStageDrop}
      >
        <div className={`absolute inset-0 pointer-events-none transition-colors z-50 ${isMainStageDropTarget ? 'bg-[#f5a623]/10 border-4 border-[#f5a623] border-dashed' : ''}`} />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        {selectedChar ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 relative z-10 flex flex-col">
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                
                {/* --- HEADER --- */}
                <div className="lg:col-span-12 flex flex-col gap-4 border-b border-[#222] pb-6 mb-2">
                    <div className="flex items-end justify-between">
                        <div className="w-full">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-[#f5a623]/10 border border-[#f5a623]/20 text-[#f5a623] text-[9px] font-black uppercase tracking-wider rounded">{selectedChar.gender || 'UNKNOWN'}</span>
                                <span className="px-2 py-0.5 bg-[#222] border border-[#333] text-gray-400 text-[9px] font-black uppercase tracking-wider rounded">{selectedChar.age || '0'} YEARS</span>
                            </div>
                            <input className="text-5xl font-black bg-transparent border-none outline-none w-full text-white placeholder-gray-700 focus:ring-0 uppercase tracking-tighter transition-colors" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onFocus={() => setNameInput('')} onBlur={handleRename} onKeyDown={(e) => e.key === 'Enter' && handleRename()} placeholder="NAME" />
                            <div className="flex items-center gap-2 mt-3 w-full max-w-md">
                                <span className="text-xs font-mono text-[#555] uppercase shrink-0">// ROLE:</span>
                                <VitalInput className="bg-transparent border-b border-transparent focus:border-[#f5a623] outline-none text-gray-200 focus:text-white text-sm font-mono uppercase tracking-wide w-full px-0 py-0 transition-colors placeholder-gray-500 focus:placeholder-gray-700" value={selectedChar.occupation} onChange={(val: string) => updateCharacter(selectedChar.name, { occupation: val })} options={CHARACTER_ROLES} placeholder={selectedChar.templateDefaults?.occupation || "OCCUPATION / ROLE"} naked={true} />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1 border-b border-[#222]">
                        {['profile', 'assets', 'backstory', 'network', 'stats'].map(t => (
                            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === t ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{t}</button>
                        ))}
                    </div>
                </div>

                {/* --- TAB CONTENT --- */}
                {activeTab === 'profile' && (
                    <>
                        <div className="lg:col-span-4 space-y-6 animate-in slide-in-from-left-2 duration-300">
                            <div className={`group relative w-full aspect-square bg-[#0a0a0a] border rounded-lg overflow-hidden shadow-2xl transition-all ${isDragging ? 'border-[#f5a623] scale-105' : 'border-[#222]'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                                {selectedChar.images.length > 0 ? <img src={selectedChar.images[0]} className="w-full h-full object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300" /> : <div className="w-full h-full flex flex-col items-center justify-center text-[#222]"><Fingerprint size={64} /><span className="text-[10px] font-mono mt-4 uppercase tracking-widest text-[#444]">{isDragging ? 'Drop Image' : 'No Subject'}</span></div>}
                                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300 ${isDragging ? 'opacity-100 bg-black/60' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <button onClick={() => generatePortrait(selectedChar)} disabled={isGenerating || !isApiConnected} className={`px-6 py-2.5 font-bold uppercase text-xs rounded-full flex items-center gap-2 transform hover:scale-105 transition-all shadow-lg ${isApiConnected ? 'bg-[#f5a623] hover:bg-[#e09612] text-black' : 'bg-[#333] text-gray-500'}`}>{isGenerating ? <Sparkles className="animate-spin" size={14}/> : <Camera size={14}/>} AI Portrait</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-[#222] hover:bg-[#333] border border-[#333] text-white font-bold uppercase text-xs rounded-full flex items-center gap-2 transform hover:scale-105 transition-all"><Upload size={14} /> Upload</button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleManualUpload} />
                                </div>
                            </div>
                            {/* Stats & Biometrics */}
                            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2"><Activity size={14} className="text-[#f5a623]" /><h3 className="text-xs font-bold text-white uppercase tracking-widest">Biometrics</h3></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <VitalInput label="Age" value={selectedChar.age === 0 ? '' : selectedChar.age} onChange={(v: string) => updateCharacter(selectedChar.name, { age: parseInt(v) || 0 })} type="number" placeholder="-" />
                                    <VitalInput label="Gender" value={selectedChar.gender} onChange={(v: string) => updateCharacter(selectedChar.name, { gender: v })} options={CHARACTER_GENDERS} placeholder="-" />
                                    <div className="col-span-2"><VitalInput label="Ethnicity" value={selectedChar.ethnicity || ''} onChange={(v: string) => updateCharacter(selectedChar.name, { ethnicity: v })} placeholder="Unknown" /></div>
                                    <VitalInput label="Hair" value={selectedChar.hair} onChange={(v: string) => updateCharacter(selectedChar.name, { hair: v })} options={CHARACTER_HAIR} placeholder="-" />
                                    <VitalInput label="Eyes" value={selectedChar.eyes} onChange={(v: string) => updateCharacter(selectedChar.name, { eyes: v })} options={CHARACTER_EYES} placeholder="-" />
                                    <div className="col-span-2"><VitalInput label="Build" value={selectedChar.build} onChange={(v: string) => updateCharacter(selectedChar.name, { build: v })} options={CHARACTER_BUILDS} placeholder="-" /></div>
                                    <div className="col-span-2"><VitalInput label="Archetype" value={selectedChar.archetype} onChange={(v: string) => updateCharacter(selectedChar.name, { archetype: v })} icon={Mic2} options={CHARACTER_ARCHETYPES} placeholder="-" /></div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-[#222]">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2"><Tag size={12} className="text-[#f5a623]" /><h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Aliases</h3></div>
                                        <div className="relative">
                                            <button onClick={() => setIsMergeMenuOpen(!isMergeMenuOpen)} className={`text-[9px] font-bold uppercase flex items-center gap-1 transition-colors ${hasSuggestions ? 'text-[#f5a623] animate-pulse' : 'text-gray-500 hover:text-[#f5a623]'}`}><Merge size={10} /> Link Identity</button>
                                            {isMergeMenuOpen && (
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-[#333] rounded shadow-xl z-20 overflow-hidden flex flex-col max-h-60">
                                                    {mergeSuggestions.length > 0 && <div className="px-3 py-1 bg-[#f5a623]/10 border-b border-[#f5a623]/20 text-[8px] font-bold text-[#f5a623] uppercase">Suggested</div>}
                                                    {mergeSuggestions.map((c: any) => <button key={c.name} onClick={() => handleMerge(c.name)} className="w-full text-left px-3 py-2 text-[10px] font-bold text-white hover:bg-[#252525] border-b border-[#222]">{c.name}</button>)}
                                                    <div className="px-3 py-2 bg-[#111] border-b border-[#222] text-[9px] font-bold text-gray-500 uppercase">All Characters</div>
                                                    <div className="overflow-y-auto custom-scrollbar flex-1">
                                                        {castList.map((c: any) => c.name !== selectedChar.name && !mergeSuggestions.find(s => s.name === c.name) && (<button key={c.name} onClick={() => handleMerge(c.name)} className="w-full text-left px-3 py-2 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#222] border-b border-[#222]">{c.name}</button>))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        {selectedChar.aliases && selectedChar.aliases.map((alias, idx) => (
                                            <div key={idx} className="flex items-center gap-1 bg-[#222] text-gray-300 text-[10px] font-bold uppercase px-2 py-1 rounded border border-[#333] group">{alias}<button onClick={() => removeAlias(alias)} className="hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={10} /></button></div>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1 bg-[#151515] border border-[#333] rounded px-2 py-1.5 focus-within:border-[#f5a623]">
                                        <Languages size={12} className="text-[#555]" />
                                        <input className="bg-transparent text-[10px] font-bold text-gray-300 outline-none w-full uppercase placeholder-gray-600" placeholder="ADD ALIAS" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAlias()} />
                                        <button onClick={addAlias} className="text-[#555] hover:text-[#f5a623]"><Plus size={12} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-8 space-y-6 animate-in slide-in-from-right-2 duration-300">
                            <DossierSection title="Physiology" icon={Fingerprint} color="text-red-400" desc="Physical appearance & health."><BlockEditor value={selectedChar.physiology} onChange={(v: string) => updateCharacter(selectedChar.name, { physiology: v })} placeholder={selectedChar.templateDefaults?.physiology || "Description..."} /></DossierSection>
                            <DossierSection title="Sociology" icon={Users} color="text-blue-400" desc="Class, occupation, life."><BlockEditor value={selectedChar.sociology} onChange={(v: string) => updateCharacter(selectedChar.name, { sociology: v })} placeholder={selectedChar.templateDefaults?.sociology || "Description..."} /></DossierSection>
                            <DossierSection title="Psychology" icon={Brain} color="text-purple-400" desc="Internal state & mind."><BlockEditor value={selectedChar.psychology} onChange={(v: string) => updateCharacter(selectedChar.name, { psychology: v })} placeholder={selectedChar.templateDefaults?.psychology || "Description..."} /></DossierSection>
                        </div>
                    </>
                )}

                {activeTab === 'assets' && (
                    <div className="lg:col-span-12 animate-in fade-in duration-300">
                        {inferredAssets.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {['props', 'costume', 'vfx', 'sound', 'practical', 'location'].map(cat => {
                                    const items = inferredAssets.filter(a => a.category === cat).sort((a,b) => b.count - a.count);
                                    if (items.length === 0) return null;
                                    
                                    let icon = Package; let color = "text-red-400"; let border = "border-red-900/30"; let bg = "bg-red-900/10";
                                    if(cat === 'costume') { icon = Shirt; color = "text-pink-400"; border = "border-pink-900/30"; bg = "bg-pink-900/10"; }
                                    if(cat === 'vfx') { icon = Wand2; color = "text-green-400"; border = "border-green-900/30"; bg = "bg-green-900/10"; }
                                    if(cat === 'sound') { icon = Mic2; color = "text-blue-400"; border = "border-blue-900/30"; bg = "bg-blue-900/10"; }
                                    if(cat === 'location') { icon = MapPin; color = "text-purple-400"; border = "border-purple-900/30"; bg = "bg-purple-900/10"; }
                                    if(cat === 'practical') { icon = Flame; color = "text-orange-400"; border = "border-orange-900/30"; bg = "bg-orange-900/10"; }

                                    return (
                                        <div key={cat} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden flex flex-col h-full hover:border-[#333] transition-colors">
                                            {/* Header */}
                                            <div className={`px-4 py-3 border-b ${border} ${bg} flex items-center justify-between`}>
                                                <div className="flex items-center gap-2">
                                                    {React.createElement(icon, { size: 14, className: color })}
                                                    <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{cat}</span>
                                                </div>
                                                <span className="text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full text-white">{items.length}</span>
                                            </div>
                                            
                                            {/* List */}
                                            <div className="p-3 space-y-1.5 flex-1 max-h-80 overflow-y-auto custom-scrollbar">
                                                {items.map((asset, i) => (
                                                    <div key={i} className="group flex items-start gap-3 p-2 rounded hover:bg-[#1a1a1a] transition-colors border border-transparent hover:border-[#333]">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-gray-200 truncate">{asset.item}</div>
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {Array.from(asset.scenes).slice(0, 5).map(s => (
                                                                    <span key={s} className="text-[9px] font-mono bg-[#222] text-[#666] px-1.5 py-0.5 rounded border border-[#333]">SC{s}</span>
                                                                ))}
                                                                {asset.scenes.size > 5 && <span className="text-[9px] font-mono text-[#444]">+{asset.scenes.size - 5}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] font-bold text-[#444] group-hover:text-[#f5a623]">
                                                            x{asset.count}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20 border-2 border-dashed border-[#222] rounded-xl bg-[#111]">
                                <Briefcase size={48} opacity={0.2} className="mb-4" />
                                <span className="text-sm font-bold uppercase tracking-widest text-[#555]">No Assets Found</span>
                                <p className="text-xs text-[#444] mt-2 max-w-md text-center">Run a Breakdown Analysis on scenes containing this character to populate this manifest.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'backstory' && (
                    <div className="lg:col-span-12 animate-in fade-in duration-300">
                        <DossierSection title="Character History" icon={FileText} color="text-[#f5a623]" desc="Complete bio.">
                            <BlockEditor value={selectedChar.backstory || ''} onChange={(v: string) => updateCharacter(selectedChar.name, { backstory: v })} placeholder={selectedChar.templateDefaults?.backstory || "History..."} minHeight="400px" />
                        </DossierSection>
                    </div>
                )}

                {/* --- NETWORK TAB (OPTIMIZED) --- */}
                {activeTab === 'network' && (
                    <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300 h-full">
                        <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#222] rounded-lg p-5 flex flex-col h-full overflow-hidden">
                            <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                <Link2 size={14} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Relationships</h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 space-y-1">
                                {(selectedChar.relationships || []).length === 0 && (
                                    <div className="text-center py-10 text-gray-600 italic text-[10px]">No connections yet. Add one below.</div>
                                )}
                                {(selectedChar.relationships || []).map((rel, idx) => {
                                    const targetChar = characterData[rel.target];
                                    const targetImage = targetChar?.images?.[0];

                                    return (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-[#111] border border-[#222] rounded hover:border-[#444] group transition-all">
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded bg-black border border-[#333] overflow-hidden shrink-0 flex items-center justify-center">
                                                {targetImage ? (
                                                    <img src={targetImage} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={14} className="text-gray-600" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-200 truncate">{rel.target}</span>
                                                    <select 
                                                        value={rel.type} 
                                                        onChange={(e) => updateRelationship(rel.target, 'type', e.target.value)}
                                                        className="bg-transparent text-[9px] font-bold uppercase outline-none text-[#f5a623] text-right cursor-pointer"
                                                    >
                                                        {RELATIONSHIP_TYPES.map(t => <option key={t} value={t} className="bg-[#111] text-gray-400">{t}</option>)}
                                                    </select>
                                                </div>
                                                <input 
                                                    value={rel.description || ''} 
                                                    onChange={(e) => updateRelationship(rel.target, 'description', e.target.value)} 
                                                    placeholder="Description..." 
                                                    className="bg-transparent text-[9px] text-gray-500 placeholder-gray-700 outline-none w-full truncate focus:text-white transition-colors"
                                                />
                                            </div>

                                            {/* Delete */}
                                            <button 
                                                onClick={() => removeRelationship(rel.target)} 
                                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-opacity p-1"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="mt-auto border-t border-[#222] pt-4 flex gap-2">
                                <select id="new-rel-target" className="flex-1 bg-[#151515] border border-[#333] text-xs text-gray-300 px-2 py-1.5 rounded outline-none focus:border-[#f5a623]">
                                    <option value="">Select Character...</option>
                                    {castList.map((c: any) => c.name !== selectedChar.name && <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                                <button onClick={() => { const sel = document.getElementById('new-rel-target') as HTMLSelectElement; if (sel && sel.value) addRelationship(sel.value, 'Acquaintance'); }} className="px-3 bg-[#f5a623] hover:bg-[#e09612] text-black rounded text-xs font-bold">Add</button>
                            </div>
                        </div>
                        
                        <div className="lg:col-span-2 bg-[#000] border border-[#222] rounded-lg relative overflow-hidden flex items-center justify-center">
                            <div className="absolute top-4 left-4 flex items-center gap-2 z-10 pointer-events-none">
                                <Network size={14} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Neural Map</h3>
                            </div>
                            <NeuralMap characters={characterData} selectedId={selectedChar.name} onSelect={setSelectedCharId} />
                        </div>
                    </div>
                )}

                {activeTab === 'stats' && charStats && (
                    <div className="lg:col-span-12 animate-in fade-in duration-300 space-y-6 pb-20">
                        {/* 1. KPI CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-[#111] border border-[#333] p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 text-[#f5a623]"><BookOpen size={48} /></div>
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Total Scenes</div>
                                <div className="text-3xl font-black text-white">{charStats.scenes}</div>
                                <div className="text-[9px] text-[#555] font-mono mt-1">{charStats.percentPresence}% of script</div>
                            </div>
                            <div className="bg-[#111] border border-[#333] p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 text-blue-500"><AlignLeft size={48} /></div>
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Dialogue Volume</div>
                                <div className="text-3xl font-black text-white">{charStats.totalWords}</div>
                                <div className="text-[9px] text-[#555] font-mono mt-1">Words across {charStats.totalLines} lines</div>
                            </div>
                            <div className="bg-[#111] border border-[#333] p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 text-green-500"><Briefcase size={48} /></div>
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Est. Workload</div>
                                <div className="text-3xl font-black text-white">{charStats.estimatedShootDays}</div>
                                <div className="text-[9px] text-[#555] font-mono mt-1">Estimated Shoot Days</div>
                            </div>
                            <div className="bg-[#111] border border-[#333] p-5 rounded-lg flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 text-purple-500"><Layers size={48} /></div>
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Schedule Block</div>
                                <div className="flex justify-between items-end">
                                    <div><div className="text-[9px] text-[#444]">FIRST</div><div className="text-lg font-bold text-white">SC {charStats.firstScene || '-'}</div></div>
                                    <ArrowRight size={14} className="text-[#333] mb-1.5"/>
                                    <div className="text-right"><div className="text-[9px] text-[#444]">LAST</div><div className="text-lg font-bold text-white">SC {charStats.lastScene || '-'}</div></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            
                            {/* 2. SCENE TIMELINE STRIP */}
                            <div className="md:col-span-12 bg-[#111] border border-[#333] rounded-lg p-5">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14} className="text-[#f5a623]" /> Scene Presence Timeline</h3>
                                <div className="flex h-8 gap-0.5 w-full">
                                    {charStats.timeline.map((status, i) => (
                                        <div 
                                            key={i} 
                                            className={`flex-1 rounded-sm transition-all hover:scale-y-110 ${status === 'active' ? 'bg-[#f5a623] opacity-80' : 'bg-[#222]'}`}
                                            title={`Scene ${i+1}: ${status === 'active' ? 'Present' : 'Absent'}`}
                                        ></div>
                                    ))}
                                </div>
                                <div className="flex justify-between mt-1 text-[9px] font-mono text-[#444]">
                                    <span>SC 1</span>
                                    <span>SC {Math.floor(charStats.timeline.length / 2)}</span>
                                    <span>SC {charStats.timeline.length}</span>
                                </div>
                            </div>

                            {/* 3. RELATIONSHIPS */}
                            <div className="md:col-span-6 bg-[#111] border border-[#333] rounded-lg p-5">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={14} className="text-blue-400" /> Top Interactions</h3>
                                <div className="space-y-3">
                                    {charStats.topRelationships.length > 0 ? (
                                        charStats.topRelationships.map((rel, i) => {
                                            const max = charStats.topRelationships[0].count;
                                            const pct = (rel.count / max) * 100;
                                            return (
                                                <div key={i} className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-[#666]">
                                                        {rel.char.substring(0,2)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-[10px] font-bold text-gray-300 mb-1">
                                                            <span>{rel.char}</span>
                                                            <span className="text-[#555]">{rel.count} Scenes</span>
                                                        </div>
                                                        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500/50" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-[10px] text-gray-600 text-center py-4">No significant interactions detected.</div>
                                    )}
                                </div>
                            </div>

                            {/* 4. EMOTIONAL TONE */}
                            <div className="md:col-span-6 bg-[#111] border border-[#333] rounded-lg p-5">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Heart size={14} className="text-pink-400" /> Emotional Profile</h3>
                                <div className="space-y-4">
                                    {Object.entries(charStats.emotions).map(([emo, count]) => {
                                        if (count === 0) return null;
                                        let color = "bg-gray-500";
                                        if (emo === 'anger') color = "bg-red-500";
                                        if (emo === 'joy') color = "bg-yellow-400";
                                        if (emo === 'sadness') color = "bg-blue-400";
                                        if (emo === 'fear') color = "bg-purple-500";
                                        
                                        // Calculate rough max for scale (assume 10 is high for demo)
                                        const max = Math.max(10, ...Object.values(charStats.emotions));
                                        const width = Math.min(100, (count / max) * 100);

                                        return (
                                            <div key={emo}>
                                                <div className="flex justify-between text-[9px] font-bold uppercase text-gray-400 mb-1">
                                                    <span>{emo}</span>
                                                    <span>{count}</span>
                                                </div>
                                                <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                                                    <div className={`h-full ${color}`} style={{ width: `${width}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {Object.values(charStats.emotions).every(v => v === 0) && (
                                        <div className="text-[10px] text-gray-600 text-center py-8">No emotional keywords detected in dialogue/parentheticals.</div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-[#333]">
             <Fingerprint size={64} strokeWidth={1} className="mb-4" />
             <span className="text-sm font-mono uppercase tracking-widest">Select Subject</span>
          </div>
        )}
      </div>

      {relationModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in duration-200">
              <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-[400px] overflow-hidden">
                  <div className="p-6 border-b border-[#222]">
                      <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Link2 size={16} className="text-[#f5a623]" /> Connection Detected</h3><button onClick={() => setRelationModal(null)} className="text-gray-500 hover:text-white"><X size={16}/></button></div>
                      <div className="flex items-center justify-between text-xs font-bold text-gray-300 bg-[#1a1a1a] p-3 rounded-lg border border-[#222]"><span>{relationModal.source}</span><ArrowRight size={14} className="text-[#555]" /><span>{relationModal.target}</span></div>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-3">
                      {RELATIONSHIP_OPTIONS.map(opt => (
                          <button key={opt.type} onClick={() => confirmConnection(opt.type)} className="flex items-center gap-3 p-3 rounded-lg border border-[#333] hover:border-[#f5a623] hover:bg-[#1a1a1a] transition-all group text-left"><opt.icon size={16} className={`${opt.color} group-hover:scale-110 transition-transform`} /><span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase">{opt.type}</span></button>
                      ))}
                  </div>
                  <div className="p-6 pt-0"><button onClick={() => confirmConnection('MERGE')} className="w-full py-3 bg-[#f5a623] hover:bg-[#e09612] text-black rounded-lg font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"><Merge size={14} /> Merge Identity</button><p className="text-[9px] text-center text-gray-500 mt-3 px-4">Merging will move "{relationModal.source}" to "{relationModal.target}" aliases.</p></div>
              </div>
          </div>
      )}
    </div>
  );
};

// VitalInput component
const VitalInput = ({ label, value, onChange, type = 'text', options, icon: Icon, placeholder, className, naked }: any) => {
    if (naked) {
        return (
            <input 
                className={className} 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                placeholder={placeholder}
            />
        );
    }
    return (
        <div>
            {label && <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">{label}</label>}
            <div className="relative">
                {Icon && <Icon size={12} className="absolute left-2 top-2 text-gray-500" />}
                {options ? (
                    <select 
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        className={`w-full bg-[#151515] border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none ${Icon ? 'pl-7' : ''}`}
                    >
                        <option value="" disabled>{placeholder}</option>
                        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : (
                    <input 
                        type={type}
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        className={`w-full bg-[#151515] border border-[#333] rounded px-2 py-1.5 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none placeholder-gray-700 ${Icon ? 'pl-7' : ''}`}
                        placeholder={placeholder}
                    />
                )}
            </div>
        </div>
    );
};

const DossierSection = ({ title, icon: Icon, color, desc, children }: any) => (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#222]">
            {Icon && <Icon size={14} className={color} />}
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">{title}</h3>
        </div>
        {desc && <p className="text-[10px] text-gray-500 mb-4 font-mono">{desc}</p>}
        {children}
    </div>
);

interface SimulationNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    data: CharacterData;
}

const NeuralMap = ({ characters, selectedId, onSelect }: { characters: Record<string, CharacterData>, selectedId: string, onSelect: (id: string) => void }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const nodesRef = useRef<SimulationNode[]>([]);
    const reqId = useRef<number>(0); 
    const draggingId = useRef<string | null>(null);

    // Initialize Simulation
    useEffect(() => {
        const charArray = Object.values(characters);
        if (charArray.length === 0) return;

        // Initialize positions if not set
        if (nodesRef.current.length !== charArray.length) {
            const centerX = 400; const centerY = 300;
            nodesRef.current = charArray.map((c, i) => {
                const angle = (i / charArray.length) * 2 * Math.PI;
                return {
                    id: c.name,
                    x: centerX + 200 * Math.cos(angle),
                    y: centerY + 200 * Math.sin(angle),
                    vx: 0, vy: 0,
                    data: c
                };
            });
        } else {
            // Update data but keep positions
            nodesRef.current = nodesRef.current.map(n => {
                const updated = charArray.find(c => c.name === n.id);
                return updated ? { ...n, data: updated } : n;
            });
        }

        const tick = () => {
            const nodes = nodesRef.current;
            const width = 800; const height = 600;
            const k = 0.5; // Spring constant
            const repulsion: number = 2500;
            const centerPull = 0.05; // INCREASED GRAVITY

            // Forces
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.id === draggingId.current) continue; // Skip pinned nodes

                let fx = 0;
                let fy = 0;

                // Repulsion
                for (let j = 0; j < nodes.length; j++) {
                    if (i === j) continue;
                    const other = nodes[j];
                    const dx: number = node.x - other.x;
                    const dy: number = node.y - other.y;
                    const distSq: number = dx*dx + dy*dy;
                    if (distSq > 0) {
                        const sqrtDist = Math.sqrt(distSq);
                        const f = repulsion / sqrtDist;
                        fx += (dx / sqrtDist) * f;
                        fy += (dy / sqrtDist) * f;
                    }
                }

                // Spring (Connections)
                if (node.data.relationships) {
                    node.data.relationships.forEach((rel) => {
                        const target = nodes.find(n => n.id === rel.target);
                        if (target) {
                            const dx: number = target.x - node.x;
                            const dy: number = target.y - node.y;
                            const distSq: number = dx*dx + dy*dy;
                            const dist = Math.sqrt(distSq);
                            // Avoid zero distance issues
                            if (dist > 0.1) {
                                const force = (dist - 150) * k; // Resting length 150
                                const fxForce = (dx / dist) * force;
                                const fyForce = (dy / dist) * force;
                                fx += fxForce;
                                fy += fyForce;
                            }
                        }
                    });
                }

                // Center Gravity
                fx += (width/2 - node.x) * centerPull;
                fy += (height/2 - node.y) * centerPull;

                // Apply Velocity
                node.vx = (node.vx + fx) * 0.8; // Damping
                node.vy = (node.vy + fy) * 0.8;
                node.x += node.vx * 0.1;
                node.y += node.vy * 0.1;

                // Bounds
                node.x = Math.max(50, Math.min(width - 50, node.x));
                node.y = Math.max(50, Math.min(height - 50, node.y));
            }

            // Direct DOM Updates for Performance
            if (svgRef.current) {
                nodes.forEach((n) => {
                    const g = svgRef.current?.getElementById(`node-${n.id}`);
                    if (g) g.setAttribute('transform', `translate(${n.x},${n.y})`);
                    
                    // Links
                    if (n.data.relationships) {
                        n.data.relationships.forEach((rel) => {
                            const target = nodes.find(t => t.id === rel.target);
                            if (target) {
                                const line = svgRef.current?.getElementById(`link-${n.id}-${target.id}`);
                                if (line) {
                                    line.setAttribute('x1', n.x.toString());
                                    line.setAttribute('y1', n.y.toString());
                                    line.setAttribute('x2', target.x.toString());
                                    line.setAttribute('y2', target.y.toString());
                                }
                            }
                        });
                    }
                });
            }

            reqId.current = window.requestAnimationFrame(tick);
        };

        tick();
        return () => { 
            if(reqId.current) {
                window.cancelAnimationFrame(reqId.current); 
            }
        };
    }, [characters]);

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        draggingId.current = id;
        onSelect(id);
    };

    const handleMouseUp = () => { draggingId.current = null; };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingId.current) {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const node = nodesRef.current.find(n => n.id === draggingId.current);
            if (node) {
                node.x = e.clientX - rect.left;
                node.y = e.clientY - rect.top;
                // Kill velocity on drag release so it doesn't fly away
                node.vx = 0; 
                node.vy = 0;
            }
        }
    };

    return (
        <svg 
            ref={svgRef} 
            viewBox="0 0 800 600" 
            className="w-full h-full bg-[#050505] cursor-grab active:cursor-grabbing"
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUp}
        >
            <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" strokeWidth="1"/></pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Links Layer */}
            {nodesRef.current.map(node => (
                node.data.relationships?.map((rel: any) => {
                    // Only render if source ID < target ID to avoid duplicates, or render directed
                    return (
                        <line 
                            key={`link-${node.id}-${rel.target}`}
                            id={`link-${node.id}-${rel.target}`}
                            stroke="#555" strokeWidth="1.5" strokeOpacity="0.6"
                        />
                    );
                })
            ))}

            {/* Nodes Layer */}
            {nodesRef.current.map(node => {
                const isSelected = node.id === selectedId;
                const hasImage = node.data.images && node.data.images.length > 0;
                return (
                    <g 
                        key={node.id} 
                        id={`node-${node.id}`} 
                        onMouseDown={(e) => handleMouseDown(e, node.id)}
                        className="cursor-pointer transition-opacity duration-300"
                        style={{ opacity: selectedId && selectedId !== node.id && !node.data.relationships.some((r:any) => r.target === selectedId) && !nodesRef.current.find(n => n.id === selectedId)?.data.relationships.some((r:any) => r.target === node.id) ? 0.3 : 1 }}
                    >
                        {isSelected && <circle r="35" fill="none" stroke="#f5a623" strokeWidth="2" opacity="0.5" className="animate-pulse" />}
                        <circle r="28" fill="#111" stroke={isSelected ? "#f5a623" : "#333"} strokeWidth={isSelected ? 3 : 1} filter={isSelected ? "url(#glow)" : ""} />
                        {hasImage ? (
                            <>
                                <defs><pattern id={`img-${node.id}`} x="0" y="0" width="1" height="1"><image href={node.data.images[0]} x="0" y="0" width="56" height="56" preserveAspectRatio="xMidYMid slice" /></pattern></defs>
                                <circle r="26" fill={`url(#img-${node.id})`} />
                            </>
                        ) : (
                            <text dy="5" textAnchor="middle" fill="#ccc" fontSize="16" fontWeight="bold" pointerEvents="none">{node.id.substring(0,2)}</text>
                        )}
                        <text y="45" textAnchor="middle" fill={isSelected ? "#fff" : "#666"} fontSize="10" fontWeight="bold" letterSpacing="1" pointerEvents="none" style={{textShadow: '0 2px 4px black'}}>{node.id}</text>
                    </g>
                );
            })}
        </svg>
    );
};

export default CharacterView;