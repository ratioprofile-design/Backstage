
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { generateImage } from '../../services/gemini';
import { 
    User, Plus, Trash2, Search, 
    Fingerprint, Brain, Users, Activity, 
    Mic2, Sparkles, MoreHorizontal, Camera,
    Network, FileText, Link2, X,
    Upload, Image as ImageIcon,
    BookOpen, Clapperboard, Sun, Moon, TreePine, Box, Wand2, Calculator,
    BarChart3, Clock, MessageSquare, Radar, Skull, Smile, Frown, Megaphone, Shirt, Package, MapPin,
    ArrowRight
} from 'lucide-react';
import { CharacterData, CharacterRelationship } from '../../types';
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
    { name: 'TOM HAGEN', age: 35, gender: 'Male', ethnicity: 'German-Irish', hair: 'Blonde', eyes: 'Blue', build: 'Slim', occupation: 'Consigliere', archetype: 'The Sage', physiology: 'Calm demeanor, suit and tie.', sociology: 'Adopted outsider, lawyer.', psychology: 'Rational, loyal, non-violent mediator.', backstory: 'Found living on the street by Sonny.' },
    { name: 'KAY ADAMS', age: 24, gender: 'Female', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Hazel', build: 'Average', occupation: 'Teacher', archetype: 'The Innocent', physiology: 'Modest dress, open face.', sociology: 'Outsider to the crime world.', psychology: 'Idealistic, blinded by love, eventually disillusioned.', backstory: 'Met Michael at Dartmouth.' },

    // MEMENTO
    { name: 'LEONARD SHELBY', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Bleached Blonde', eyes: 'Blue', build: 'Lean', occupation: 'Investigator', archetype: 'The Seeker', physiology: 'Covered in tattoos.', sociology: 'Isolated by condition.', psychology: 'Anterograde amnesia. Obsessive.', backstory: 'Wife murdered. Cannot form new memories.' },
    { name: 'TEDDY', age: 45, gender: 'Male', ethnicity: 'Caucasian', hair: 'Balding', eyes: 'Brown', build: 'Stocky', occupation: 'Cop', archetype: 'The Trickster', physiology: 'Moustache, glasses, disarming smile.', sociology: 'Undercover, manipulative.', psychology: 'Uses Leonard\'s condition for gain.', backstory: 'Real name John Edward Gammell.' },
    { name: 'NATALIE', age: 30, gender: 'Female', ethnicity: 'Caucasian', hair: 'Short Brown', eyes: 'Brown', build: 'Slim', occupation: 'Bartender', archetype: 'Femme Fatale', physiology: 'Bruised face, weary.', sociology: 'Manipulating Leonard to remove rivals.', psychology: 'Vindictive, survivalist.', backstory: 'Boyfriend Jimmy was killed.' },

    // INCEPTION
    { name: 'DOM COBB', age: 38, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Hazel', build: 'Athletic', occupation: 'Extractor', archetype: 'Tragic Hero', physiology: 'Exhausted, carries spinning top.', sociology: 'Fugitive, estranged father.', psychology: 'Guilt-ridden, haunted by wife.', backstory: 'Accused of killing wife Mal.' },
    { name: 'MAL COBB', age: 35, gender: 'Female', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Blue', build: 'Elegant', occupation: 'Architect', archetype: 'The Shadow', physiology: 'Dreamlike, dangerous beauty.', sociology: 'Exists only in Cobb\'s mind.', psychology: 'Manifestation of guilt and sabotage.', backstory: 'Committed suicide believing reality was a dream.' },
    { name: 'ARTHUR', age: 30, gender: 'Male', ethnicity: 'Caucasian', hair: 'Black', eyes: 'Brown', build: 'Slim', occupation: 'Point Man', archetype: 'The Caregiver', physiology: 'Impeccable suits, precise movement.', sociology: 'Professional, detail-oriented.', psychology: 'Rational, organized, grounded.', backstory: 'Long-time partner of Cobb.' },
    { name: 'ARIADNE', age: 24, gender: 'Female', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Brown', build: 'Petite', occupation: 'Architect', archetype: 'The Mentor', physiology: 'Inquisitive look, college student style.', sociology: 'New to the team.', psychology: 'Curious, empathetic, solves the maze.', backstory: 'Recruited by Cobb in Paris.' },
    { name: 'EAMES', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Blue', build: 'Average', occupation: 'Forger', archetype: 'The Shapeshifter', physiology: 'Casual, charming, often changes appearance.', sociology: 'Criminal underworld ties.', psychology: 'Creative, relaxed, gambler.', backstory: 'Master of identity theft in dreams.' },
    { name: 'SAITO', age: 50, gender: 'Male', ethnicity: 'Japanese', hair: 'Black', eyes: 'Dark Brown', build: 'Slim', occupation: 'Businessman', archetype: 'The Patron', physiology: 'Powerful presence, expensive suits.', sociology: 'Energy magnate.', psychology: 'Honorable, ambitious.', backstory: 'Hires Cobb to perform inception.' },

    // INTERSTELLAR
    { name: 'JOSEPH COOPER', age: 40, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Blue', build: 'Rugged', occupation: 'Pilot', archetype: 'The Explorer', physiology: 'Dusty clothes, lined face.', sociology: 'Farmer in a dying world.', psychology: 'Love for daughter vs duty to species.', backstory: 'Former NASA pilot grounded by blight.' },
    { name: 'MURPH COOPER', age: 35, gender: 'Female', ethnicity: 'Caucasian', hair: 'Red', eyes: 'Green', build: 'Slim', occupation: 'Physicist', archetype: 'The Sage', physiology: 'Intense focus, lab coat.', sociology: 'Saving humanity on Earth.', psychology: 'Resentful of father leaving, brilliant.', backstory: 'Solved the gravity equation.' },
    { name: 'AMELIA BRAND', age: 35, gender: 'Female', ethnicity: 'Caucasian', hair: 'Short Brown', eyes: 'Brown', build: 'Athletic', occupation: 'Biologist', archetype: 'The Lover', physiology: 'Space suit, determined.', sociology: 'Daughter of Professor Brand.', psychology: 'Believes love transcends dimensions.', backstory: 'In love with Edmunds.' },
    { name: 'DR. MANN', age: 45, gender: 'Male', ethnicity: 'Caucasian', hair: 'Grey', eyes: 'Blue', build: 'Average', occupation: 'Scientist', archetype: 'The Traitor', physiology: 'Desperate, unkempt.', sociology: 'Leader of the Lazarus missions.', psychology: 'Cowardice masked as heroism.', backstory: 'Faked data to be rescued.' },

    // DJANGO UNCHAINED
    { name: 'DJANGO FREEMAN', age: 30, gender: 'Male', ethnicity: 'African-American', hair: 'Black', eyes: 'Brown', build: 'Strong', occupation: 'Bounty Hunter', archetype: 'The Gunslinger', physiology: 'Scars on back, sunglasses.', sociology: 'Freed slave.', psychology: 'Ruthless to enemies, loyal to wife.', backstory: 'Separated from Broomhilda.' },
    { name: 'DR. KING SCHULTZ', age: 50, gender: 'Male', ethnicity: 'German', hair: 'Grey, Beard', eyes: 'Blue', build: 'Small', occupation: 'Dentist / Hunter', archetype: 'The Mentor', physiology: 'Dapper suit, articulate.', sociology: 'Bounty hunter.', psychology: 'Detests slavery, pragmatic.', backstory: 'Former dentist turned bounty hunter.' },
    { name: 'CALVIN CANDIE', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Blue', build: 'Slim', occupation: 'Plantation Owner', archetype: 'The Villain', physiology: 'Rotting teeth, flamboyant suits.', sociology: 'Francophile, brutal slave owner.', psychology: 'Narcissistic, cruel, charming.', backstory: 'Owner of Candyland.' },
    { name: 'BROOMHILDA', age: 25, gender: 'Female', ethnicity: 'African-American', hair: 'Black', eyes: 'Brown', build: 'Slim', occupation: 'Slave', archetype: 'The Damsel', physiology: 'Scars, fearful but resilient.', sociology: 'German speaking.', psychology: 'Enduring hope.', backstory: 'Django\'s wife.' },
    { name: 'STEPHEN', age: 70, gender: 'Male', ethnicity: 'African-American', hair: 'White', eyes: 'Cloudy', build: 'Frail', occupation: 'House Slave', archetype: 'The Shadow', physiology: 'Limps, uses cane.', sociology: 'Head house slave.', psychology: 'Manipulative, loyal to master.', backstory: 'Lifetime servant at Candyland.' },

    // THE PRESTIGE
    { name: 'ROBERT ANGIER', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Brown', build: 'Tall', occupation: 'Magician', archetype: 'The Showman', physiology: 'Charismatic stage presence.', sociology: 'Aristocrat (Lord Caldlow).', psychology: 'Obsessed with status and revenge.', backstory: 'Blames Borden for wife\'s death.' },
    { name: 'ALFRED BORDEN', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Dark Brown', eyes: 'Hazel', build: 'Stocky', occupation: 'Magician', archetype: 'The Magician', physiology: 'Rough hands, missing fingers.', sociology: 'Working class background.', psychology: 'Devoted to the craft above all.', backstory: 'Lives a shared life with twin.' },
    { name: 'JOHN CUTTER', age: 60, gender: 'Male', ethnicity: 'Caucasian', hair: 'Grey', eyes: 'Blue', build: 'Average', occupation: 'Ingenieur', archetype: 'The Mentor', physiology: 'Practical clothes.', sociology: 'Stage engineer.', psychology: 'Voice of reason.', backstory: 'Designed tricks for Angier.' },
    { name: 'OLIVIA WENSCOMBE', age: 28, gender: 'Female', ethnicity: 'Caucasian', hair: 'Blonde', eyes: 'Blue', build: 'Slim', occupation: 'Assistant', archetype: 'The Pawn', physiology: 'Beautiful, elegant.', sociology: 'Assistant to both magicians.', psychology: 'Torn between the two rivals.', backstory: 'Sent to spy on Borden.' },

    // DOUBLE INDEMNITY
    { name: 'WALTER NEFF', age: 35, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Brown', build: 'Average', occupation: 'Salesman', archetype: 'Anti-Hero', physiology: 'Cheap suit, smokes.', sociology: 'Insurance salesman.', psychology: 'Arrogant, thinks he can cheat the system.', backstory: 'Top salesman at Pacific All-Risk.' },
    { name: 'PHYLLIS DIETRICHSON', age: 30, gender: 'Female', ethnicity: 'Caucasian', hair: 'Blonde', eyes: 'Blue', build: 'Curvy', occupation: 'Housewife', archetype: 'Femme Fatale', physiology: 'Anklet, sunglasses.', sociology: 'Unhappy marriage.', psychology: 'Manipulative, cold.', backstory: 'Wants husband dead.' },
    { name: 'BARTON KEYES', age: 55, gender: 'Male', ethnicity: 'Caucasian', hair: 'Grey', eyes: 'Brown', build: 'Heavy', occupation: 'Claims Manager', archetype: 'The Detector', physiology: 'Rumpled suit, cigar.', sociology: 'Workaholic.', psychology: 'Intuitive "little man" inside.', backstory: 'Mentor to Walter.' },

    // BARRY LYNDON
    { name: 'REDMOND BARRY', age: 25, gender: 'Male', ethnicity: 'Irish', hair: 'Blonde', eyes: 'Blue', build: 'Slim', occupation: 'Opportunist', archetype: 'The Rogue', physiology: 'Passive face, elegant.', sociology: 'Social climber.', psychology: 'Fatalistic, drifting.', backstory: 'Fled home after duel.' },
    { name: 'LADY LYNDON', age: 28, gender: 'Female', ethnicity: 'Caucasian', hair: 'Dark Brown', eyes: 'Brown', build: 'Slim', occupation: 'Aristocrat', archetype: 'The Victim', physiology: 'Melancholy, pale.', sociology: 'Wealthy countess.', psychology: 'Depressed, trapped.', backstory: 'Married Barry for his charm.' },
    { name: 'LORD BULLINGDON', age: 10, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown', eyes: 'Brown', build: 'Small', occupation: 'Heir', archetype: 'The Avenger', physiology: 'Proper, sneering.', sociology: 'Lady Lyndon\'s son.', psychology: 'Hates his stepfather Barry.', backstory: 'Refuses to accept Barry.' }
];

const EMOTION_KEYWORDS = {
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
  const [activeTab, setActiveTab] = useState<'profile' | 'backstory' | 'network' | 'stats'>('profile');
  const [nameInput, setNameInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // Track pending deletions
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DYNAMIC CAST LIST GENERATION ---
  const castList = useMemo(() => {
      const explicitChars = new Set(Object.keys(characterData));
      const allNames = new Set(explicitChars);
      const usedNames = new Set<string>();
      
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const charBlocks = div.querySelectorAll('.sc-character');
          charBlocks.forEach(el => {
              const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
              if (name && name.length > 1) {
                  allNames.add(name);
                  usedNames.add(name); // Mark as actively used in script
              }
          });
      });

      let list = Array.from(allNames).map(name => {
          const data = characterData[name] || {
              name,
              archetype: 'Script Detected', // Default for implicit
              images: [],
              isImplicit: !explicitChars.has(name) // Flag for UI distinction
          };
          return { 
              name, 
              ...data,
              isUsed: usedNames.has(name) // Pass usage status to UI
          };
      });

      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          list = list.filter(c => (c.name || '').toLowerCase().includes(lower) || (c.archetype && c.archetype.toLowerCase().includes(lower)));
      }

      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [characterData, beats, searchTerm]);

  // --- PRODUCTION STATS CALCULATOR (ENHANCED) ---
  const charStats = useMemo(() => {
      if (!selectedCharId) return null;
      const name = selectedCharId.toUpperCase();
      
      // Metrics
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

      // Sort beats by position (x, y) to approximate script order
      const sortedBeats = [...beats].sort((a, b) => {
          if (Math.abs(a.x - b.x) > 50) return a.x - b.x; 
          return a.y - b.y;
      });

      sortedBeats.forEach((beat, index) => {
          // Fast check for character presence
          const contentUpper = beat.content.toUpperCase();
          const charTag = `CLASS="SC-LINE SC-CHARACTER">${name}`;
          // Check regex for loose name match in character line to be safer
          const isPresent = contentUpper.includes(charTag) || contentUpper.includes(`>${name}<`) || contentUpper.includes(`>${name} (`);
          
          if (isPresent) { 
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

              // Action Check
              const actionText = beat.content.replace(/<[^>]+>/g, ' ').toUpperCase();
              const hasAction = ACTION_KEYWORDS.some(k => actionText.includes(k.toUpperCase()));
              if (hasAction) actionScenes++;

              // Detailed Content Analysis
              const div = document.createElement('div');
              div.innerHTML = beat.content;
              const lines = div.querySelectorAll('.sc-line');
              let counting = false;
              
              lines.forEach(line => {
                  if (line.classList.contains('sc-character')) {
                      const charName = line.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
                      if (charName === name) {
                          counting = true;
                      } else {
                          counting = false;
                          // Co-occurrence
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
                      // Emotional Analysis
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
      
      // Simple Estimation: 1 scene ~ 2 hours to shoot (very rough heuristic)
      // Weighted by action scenes (x1.5)
      const estimatedShootDays = Math.ceil(((scenes - actionScenes) * 0.2) + (actionScenes * 0.4));

      return { 
          scenes, int, ext, day, night, actionScenes, 
          totalLines, totalWords, monologues, 
          firstScene, lastScene, estimatedShootDays,
          timeline, topRelationships, percentPresence, emotions 
      };
  }, [beats, selectedCharId]);

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
              images: [], relationships: []
          };
          setCharacterData(prev => ({ ...prev, [name]: newChar }));
      }
      setSelectedCharId(name);
  };

  const selectedChar = selectedCharId ? characterData[selectedCharId] : null;
  
  if (selectedChar) {
      if (!selectedChar.relationships) selectedChar.relationships = [];
      if (!selectedChar.backstory) selectedChar.backstory = '';
  }

  const handleAddCharacter = () => {
    const existingNames = Object.keys(characterData).map(n => n.toUpperCase());
    const availableTemplates = CINEMATIC_TEMPLATES.filter(t => !existingNames.includes(t.name?.toUpperCase() || ''));
    
    if (availableTemplates.length === 0) {
        let i = 1;
        while (existingNames.includes(`NEW CHARACTER ${i}`)) i++;
        const name = `NEW CHARACTER ${i}`;
        const newChar: CharacterData = {
            name,
            physiology: '', sociology: '', psychology: '', backstory: '',
            age: 25, gender: 'Unknown', ethnicity: 'Unknown', hair: 'Unknown', eyes: 'Unknown', build: 'Average',
            occupation: '', archetype: 'New Arrival',
            images: [], relationships: []
        };
        setCharacterData(prev => ({ ...prev, [name]: newChar }));
        setSelectedCharId(name);
        return;
    }

    const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
    const name = template.name!; 

    const newChar: CharacterData = {
      name,
      age: 0, gender: '', ethnicity: '', hair: '', eyes: '', build: '', archetype: '',
      physiology: '', sociology: '', psychology: '', backstory: '', occupation: '', 
      images: [], relationships: [],
      templateDefaults: {
          physiology: template.physiology, sociology: template.sociology, psychology: template.psychology,
          backstory: template.backstory, occupation: template.occupation, archetype: template.archetype,
          age: template.age, gender: template.gender, ethnicity: template.ethnicity,
          hair: template.hair, eyes: template.eyes, build: template.build
      }
    };
    setCharacterData(prev => ({ ...prev, [name]: newChar }));
    setSelectedCharId(name);
  };

  const updateCharacter = (name: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({ ...prev, [name]: { ...prev[name], ...updates } }));
  };

  const handleDelete = (name: string) => {
      const isUsedInScript = beats.some(beat => {
          const div = document.createElement('div');
          div.innerHTML = beat.content;
          const charBlocks = div.querySelectorAll('.sc-character');
          return Array.from(charBlocks).some(el => 
              el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase() === name.toUpperCase()
          );
      });

      if (isUsedInScript) {
          alert(`Cannot delete ${name}: This character is currently speaking in the script. Remove their dialogue first.`);
          return;
      }

      setCharacterData(prev => {
          const newMap = { ...prev };
          delete newMap[name];
          return newMap;
      });

      if (selectedCharId === name) setSelectedCharId(null);
  };

  const handleRename = () => {
    if (!selectedChar) return;
    const oldName = selectedChar.name;
    const newName = nameInput.trim().toUpperCase();

    if (oldName === newName || !newName) {
        setNameInput(oldName);
        return; 
    }
    
    if (characterData[newName]) { 
        alert("Character name already exists."); 
        setNameInput(oldName);
        return; 
    }

    setCharacterData(prev => {
      const data = prev[oldName];
      const newState = { ...prev };
      delete newState[oldName];
      newState[newName] = { ...data, name: newName };
      return newState;
    });
    setSelectedCharId(newName);
  };

  const generatePortrait = async (char: CharacterData) => {
    if (!geminiApiKey) { alert("Please set Gemini API Key first."); return; }
    setIsGenerating(true);
    const prompt = `Cinematic character portrait, close-up, dramatic lighting, shot on 35mm film. 
      Subject: ${char.name}, ${char.age || '30'} years old, ${char.gender || 'Unknown'}, ${char.ethnicity || 'Unknown'}.
      Appearance: ${char.hair || 'Dark'} hair, ${char.eyes || 'Brown'} eyes, ${char.build || 'Average'} build.
      Vibe: ${char.archetype || 'Portrait'}, ${char.occupation || 'Character'}. 
      Style: Hyper-realistic, shallow depth of field, detailed texture.`;
    
    try {
        const img = await generateImage(prompt, '1:1', 'gemini-2.5-flash-image', geminiApiKey); 
        if (img) {
          updateCharacter(char.name, { images: [img, ...char.images] });
        }
    } catch (e) {
        console.error(e);
        alert("Image generation failed.");
    } finally {
        setIsGenerating(false);
    }
  };

  // --- IMAGE MANAGEMENT ---
  const processFile = (file: File) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result && selectedChar) {
              updateCharacter(selectedChar.name, { images: [result, ...selectedChar.images] });
          }
      };
      reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); };
  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) processFile(e.target.files[0]); e.target.value = ''; };
  const handleDeleteImage = (index: number) => { if (!selectedChar) return; const newImages = [...selectedChar.images]; newImages.splice(index, 1); updateCharacter(selectedChar.name, { images: newImages }); };
  const handlePromoteImage = (index: number) => { if (!selectedChar) return; const newImages = [...selectedChar.images]; const [promoted] = newImages.splice(index, 1); newImages.unshift(promoted); updateCharacter(selectedChar.name, { images: newImages }); };

  // --- RELATIONSHIP LOGIC ---
  const addRelationship = (targetName: string, type: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      if (currentRels.some(r => r.target === targetName)) return;
      const newRel: CharacterRelationship = { target: targetName, type, description: '' };
      updateCharacter(selectedChar.name, { relationships: [...currentRels, newRel] });
  };
  const removeRelationship = (targetName: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      updateCharacter(selectedChar.name, { relationships: currentRels.filter(r => r.target !== targetName) });
  };
  const updateRelationship = (targetName: string, field: keyof CharacterRelationship, value: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      const updated = currentRels.map(r => r.target === targetName ? { ...r, [field]: value } : r);
      updateCharacter(selectedChar.name, { relationships: updated });
  };

  const isApiConnected = !!geminiApiKey;

  return (
    <div className="flex w-full h-full bg-[#050505] text-gray-200 font-sans overflow-hidden">
      
      {/* --- SIDEBAR: CAST LIST --- */}
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
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {castList.map((data: any) => {
            const isConfirming = confirmDeleteId === data.name;
            const isSelected = selectedCharId === data.name;
            const isExplicit = !data.isImplicit;
            
            let nameColorClass = 'text-gray-500 group-hover:text-gray-400';
            if (isSelected) nameColorClass = 'text-white';
            else if (isExplicit) nameColorClass = 'text-gray-300 group-hover:text-white';

            return (
                <div 
                    key={data.name} 
                    onClick={() => handleSelectCharacter(data.name)} 
                    className={`group p-2 flex items-center gap-3 cursor-pointer rounded-lg border border-transparent transition-all relative ${isSelected ? 'bg-[#1a1a1a] border-[#333] shadow-md' : 'hover:bg-[#111] hover:border-[#222]'}`}
                >
                <div className={`w-10 h-10 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border ${isSelected ? 'border-[#f5a623]' : 'border-[#333]'} bg-[#000] relative`}>
                    {data.images && data.images.length > 0 ? (
                    <img src={data.images[0]} alt={data.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                    <User size={18} className={data.isImplicit ? "text-[#444]" : "text-[#888]"} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`truncate text-sm font-bold flex items-center gap-2 ${nameColorClass}`}>
                        {data.name}
                        {data.isImplicit && <span title="Found in Script"><BookOpen size={10} className="text-[#444]" /></span>}
                    </div>
                    <div className="truncate text-[10px] font-mono text-[#555] uppercase">{data.archetype || 'Archetype'}</div>
                </div>
                
                <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity z-10 ${isConfirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {data.isUsed ? (
                        <span title="Active in Script"><Link2 size={12} className="text-blue-500" /></span>
                    ) : (
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isConfirming) {
                                    handleDelete(data.name);
                                    setConfirmDeleteId(null);
                                } else {
                                    setConfirmDeleteId(data.name);
                                    setTimeout(() => setConfirmDeleteId(prev => prev === data.name ? null : prev), 3000);
                                }
                            }} 
                            className={`p-2 rounded transition-all ${
                                isConfirming 
                                ? 'text-red-500 bg-red-900/20 ring-1 ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                                : 'text-[#444] hover:text-red-500 hover:bg-[#222]'
                            }`}
                            title={isConfirming ? "Click again to confirm" : "Delete Character"}
                        >
                            <Trash2 size={14} className={isConfirming ? "animate-pulse" : ""} />
                        </button>
                    )}
                </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* --- MAIN STAGE --- */}
      <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative">
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
                            <input 
                                className="text-5xl font-black bg-transparent border-none outline-none w-full text-white placeholder-gray-700 focus:ring-0 uppercase tracking-tighter transition-colors" 
                                value={nameInput} 
                                onChange={(e) => setNameInput(e.target.value)}
                                onFocus={() => setNameInput('')} 
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                placeholder="NAME" 
                            />
                            <div className="flex items-center gap-2 mt-1 w-full max-w-md">
                                <span className="text-xs font-mono text-[#555] uppercase shrink-0">// ROLE:</span>
                                <VitalInput 
                                    className="bg-transparent border-b border-transparent focus:border-[#f5a623] outline-none text-gray-200 focus:text-white text-sm font-mono uppercase tracking-wide w-full px-0 py-0 transition-colors placeholder-gray-500 focus:placeholder-gray-700" 
                                    value={selectedChar.occupation} 
                                    onChange={(val: string) => updateCharacter(selectedChar.name, { occupation: val })} 
                                    options={CHARACTER_ROLES} 
                                    placeholder={selectedChar.templateDefaults?.occupation || "OCCUPATION / ROLE"} 
                                    naked={true} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1 border-b border-[#222]">
                        <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'profile' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Profile</button>
                        <button onClick={() => setActiveTab('backstory')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'backstory' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Backstory</button>
                        <button onClick={() => setActiveTab('network')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'network' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Network</button>
                        <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'stats' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Analytics</button>
                    </div>
                </div>

                {activeTab === 'profile' && (
                    <>
                        <div className="lg:col-span-4 space-y-6 animate-in slide-in-from-left-2 duration-300">
                            {/* IMAGE CONTAINER */}
                            <div 
                                className={`group relative w-full aspect-square bg-[#0a0a0a] border rounded-lg overflow-hidden shadow-2xl transition-all ${isDragging ? 'border-[#f5a623] scale-105 shadow-[0_0_20px_rgba(245,166,35,0.2)]' : 'border-[#222]'}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {selectedChar.images.length > 0 ? (
                                    <img src={selectedChar.images[0]} className="w-full h-full object-cover opacity-90 group-hover:opacity-40 transition-opacity duration-300" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-[#222]">
                                        <Fingerprint size={64} strokeWidth={1} />
                                        <span className="text-[10px] font-mono mt-4 uppercase tracking-widest text-[#444]">
                                            {isDragging ? 'Drop Image Here' : 'No Subject Image'}
                                        </span>
                                    </div>
                                )}
                                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300 ${isDragging ? 'opacity-100 bg-black/60' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <button 
                                        onClick={() => generatePortrait(selectedChar)} 
                                        disabled={isGenerating || !isApiConnected} 
                                        className={`px-6 py-2.5 font-bold uppercase text-xs tracking-wider rounded-full flex items-center gap-2 transform hover:scale-105 transition-all shadow-lg w-40 justify-center ${
                                            isApiConnected 
                                            ? 'bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-50 disabled:grayscale' 
                                            : 'bg-[#333] text-gray-500 cursor-not-allowed'
                                        }`}
                                        title={isApiConnected ? "Generate Portrait" : "API Key Required"}
                                    >
                                        {isGenerating ? <Sparkles className="animate-spin" size={14}/> : <Camera size={14}/>} 
                                        {isGenerating ? 'Rendering...' : 'Generate AI'}
                                    </button>
                                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#555] text-white font-bold uppercase text-xs tracking-wider rounded-full flex items-center gap-2 transform hover:scale-105 transition-all shadow-lg w-40 justify-center"><Upload size={14} /> Upload Img</button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleManualUpload} />
                                </div>
                            </div>

                            {/* PRODUCTION STATS */}
                            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                    <Calculator size={14} className="text-[#f5a623]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Production Statistics</h3>
                                </div>
                                {charStats && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1 p-2 bg-[#111] rounded border border-[#222]">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#666] uppercase"><Clapperboard size={12} /> Scenes</div>
                                            <div className="text-xl font-black text-white">{charStats.scenes}</div>
                                        </div>
                                        <div className="flex flex-col gap-1 p-2 bg-[#111] rounded border border-[#222]">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#666] uppercase"><Wand2 size={12} /> VFX Shots</div>
                                            <div className={`text-xl font-black ${charStats.vfx > 0 ? 'text-green-400' : 'text-[#444]'}`}>{charStats.vfx}</div>
                                        </div>
                                        <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
                                            <div className="flex items-center justify-between text-[10px] font-mono text-[#888] bg-[#151515] px-2 py-1 rounded">
                                                <span className="flex items-center gap-1"><Box size={10} /> INT</span>
                                                <span className="text-white font-bold">{charStats.int}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono text-[#888] bg-[#151515] px-2 py-1 rounded">
                                                <span className="flex items-center gap-1"><TreePine size={10} /> EXT</span>
                                                <span className="text-white font-bold">{charStats.ext}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono text-[#888] bg-[#151515] px-2 py-1 rounded">
                                                <span className="flex items-center gap-1"><Sun size={10} /> DAY</span>
                                                <span className="text-white font-bold">{charStats.day}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-mono text-[#888] bg-[#151515] px-2 py-1 rounded">
                                                <span className="flex items-center gap-1"><Moon size={10} /> NIGHT</span>
                                                <span className="text-white font-bold">{charStats.night}</span>
                                            </div>
                                        </div>
                                        {charStats.vfx === 0 && charStats.scenes > 0 && (
                                            <div className="col-span-2 text-[9px] text-[#444] text-center italic mt-1">
                                                * Run Breakdown Analysis for accurate VFX counts
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* BIOMETRICS */}
                            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                    <Activity size={14} className="text-[#f5a623]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Biometrics</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <VitalInput 
                                        label="Age" 
                                        value={selectedChar.age === 0 ? '' : selectedChar.age} 
                                        onChange={(v: string) => updateCharacter(selectedChar.name, { age: parseInt(v) || 0 })} 
                                        type="number" 
                                        placeholder={selectedChar.templateDefaults?.age?.toString() || "-"}
                                    />
                                    <VitalInput 
                                        label="Gender" 
                                        value={selectedChar.gender} 
                                        onChange={(v: string) => updateCharacter(selectedChar.name, { gender: v })} 
                                        options={CHARACTER_GENDERS} 
                                        placeholder={selectedChar.templateDefaults?.gender || "-"}
                                    />
                                    <div className="col-span-2">
                                        <VitalInput 
                                            label="Ethnic Background" 
                                            value={selectedChar.ethnicity || ''} 
                                            onChange={(v: string) => updateCharacter(selectedChar.name, { ethnicity: v })} 
                                            placeholder={selectedChar.templateDefaults?.ethnicity || "Italian"} 
                                        />
                                    </div>
                                    <VitalInput 
                                        label="Hair" 
                                        value={selectedChar.hair} 
                                        onChange={(v: string) => updateCharacter(selectedChar.name, { hair: v })} 
                                        options={CHARACTER_HAIR} 
                                        placeholder={selectedChar.templateDefaults?.hair || "-"}
                                    />
                                    <VitalInput 
                                        label="Eyes" 
                                        value={selectedChar.eyes} 
                                        onChange={(v: string) => updateCharacter(selectedChar.name, { eyes: v })} 
                                        options={CHARACTER_EYES} 
                                        placeholder={selectedChar.templateDefaults?.eyes || "-"}
                                    />
                                    <div className="col-span-2">
                                        <VitalInput 
                                            label="Build / Physique" 
                                            value={selectedChar.build} 
                                            onChange={(v: string) => updateCharacter(selectedChar.name, { build: v })} 
                                            options={CHARACTER_BUILDS} 
                                            placeholder={selectedChar.templateDefaults?.build || "-"}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <VitalInput 
                                            label="Voice / Tone" 
                                            value={selectedChar.archetype} 
                                            onChange={(v: string) => updateCharacter(selectedChar.name, { archetype: v })} 
                                            icon={Mic2} 
                                            options={CHARACTER_ARCHETYPES} 
                                            placeholder={selectedChar.templateDefaults?.archetype || "-"}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* IMAGE GALLERY */}
                            {selectedChar.images.length > 1 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-[#555] uppercase tracking-widest px-1"><span className="flex items-center gap-2"><ImageIcon size={10} /> Version History</span><span className="font-mono">{selectedChar.images.length - 1} archived</span></div>
                                    <div className="flex flex-col gap-6">
                                        {selectedChar.images.slice(1).map((img, idx) => (
                                            <div key={idx} className="relative w-full aspect-square group rounded-lg overflow-hidden border border-[#222] hover:border-[#f5a623] transition-colors cursor-pointer bg-[#0a0a0a] shadow-lg">
                                                <img src={img} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" onClick={() => handlePromoteImage(idx + 1)} />
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx + 1); }} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-md"><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- RIGHT COLUMN: EDITORS --- */}
                        <div className="lg:col-span-8 space-y-6 animate-in slide-in-from-right-2 duration-300">
                            <DossierSection title="Physiology" icon={Fingerprint} color="text-red-400" desc="Physical appearance, defects, heredity, health.">
                                <BlockEditor 
                                    value={selectedChar.physiology} 
                                    onChange={(v: string) => updateCharacter(selectedChar.name, { physiology: v })} 
                                    className="text-gray-200 hover:text-white focus:text-white transition-colors"
                                    placeholder={selectedChar.templateDefaults?.physiology || "Type here..."}
                                />
                            </DossierSection>
                            <DossierSection title="Sociology" icon={Users} color="text-blue-400" desc="Class, occupation, education, home life, religion, politics.">
                                <BlockEditor 
                                    value={selectedChar.sociology} 
                                    onChange={(v: string) => updateCharacter(selectedChar.name, { sociology: v })} 
                                    className="text-gray-200 hover:text-white focus:text-white transition-colors"
                                    placeholder={selectedChar.templateDefaults?.sociology || "Type here..."}
                                />
                            </DossierSection>
                            <DossierSection title="Psychology" icon={Brain} color="text-purple-400" desc="Moral standards, ambitions, frustrations, temperament, complexes.">
                                <BlockEditor 
                                    value={selectedChar.psychology} 
                                    onChange={(v: string) => updateCharacter(selectedChar.name, { psychology: v })} 
                                    className="text-gray-200 hover:text-white focus:text-white transition-colors"
                                    placeholder={selectedChar.templateDefaults?.psychology || "Type here..."}
                                />
                            </DossierSection>
                        </div>
                    </>
                )}

                {activeTab === 'backstory' && (
                    <div className="lg:col-span-12 animate-in fade-in duration-300">
                        <DossierSection title="Character History" icon={FileText} color="text-[#f5a623]" desc="Comprehensive backstory, childhood, and key life events.">
                            <BlockEditor 
                                value={selectedChar.backstory || ''} 
                                onChange={(v: string) => updateCharacter(selectedChar.name, { backstory: v })} 
                                className="text-gray-200 hover:text-white focus:text-white transition-colors"
                                placeholder={selectedChar.templateDefaults?.backstory || "Once upon a time..."}
                                minHeight="400px" 
                            />
                        </DossierSection>
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300 h-full">
                        <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#222] rounded-lg p-5 flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                <Link2 size={14} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Relationships</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                                {(selectedChar.relationships || []).map((rel, idx) => (
                                    <div key={idx} className="bg-[#111] p-3 rounded border border-[#222] group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-white">{rel.target}</span>
                                            <button onClick={() => removeRelationship(rel.target)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={12} /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={rel.type} onChange={(e) => updateRelationship(rel.target, 'type', e.target.value)} className="bg-[#0a0a0a] border border-[#333] text-[10px] text-gray-300 px-2 py-1 rounded outline-none focus:border-[#f5a623]">
                                                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <input value={rel.description || ''} onChange={(e) => updateRelationship(rel.target, 'description', e.target.value)} placeholder="Details..." className="bg-[#0a0a0a] border border-[#333] text-[10px] text-gray-300 px-2 py-1 rounded outline-none focus:border-[#f5a623]" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto border-t border-[#222] pt-4">
                                <label className="text-[9px] font-mono text-[#555] uppercase mb-1 block">Add Connection</label>
                                <div className="flex gap-2">
                                    <select id="new-rel-target" className="flex-1 bg-[#151515] border border-[#333] text-xs text-gray-300 px-2 py-1.5 rounded outline-none focus:border-[#f5a623]">
                                        {castList.map((c: any) => c.name !== selectedChar.name && <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                    <button onClick={() => { const sel = document.getElementById('new-rel-target') as HTMLSelectElement; if (sel && sel.value) addRelationship(sel.value, 'Acquaintance'); }} className="px-3 bg-[#f5a623] hover:bg-[#e09612] text-black rounded text-xs font-bold">Add</button>
                                </div>
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
                    <div className="lg:col-span-12 animate-in fade-in duration-300 space-y-6">
                        
                        {/* ROW 1: KEY METRICS */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-[#0a0a0a] border border-[#333] p-5 rounded-lg flex flex-col justify-between">
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Total Scenes</div>
                                <div className="text-3xl font-black text-white">{charStats.scenes}</div>
                                <div className="h-1 bg-[#222] mt-2 rounded overflow-hidden"><div className="h-full bg-[#f5a623]" style={{ width: `${charStats.percentPresence}%` }}></div></div>
                                <div className="text-[9px] text-[#555] font-mono mt-1">{charStats.percentPresence}% of script</div>
                            </div>
                            <div className="bg-[#0a0a0a] border border-[#333] p-5 rounded-lg flex flex-col justify-between">
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Word Count</div>
                                <div className="text-3xl font-black text-white">{charStats.totalWords}</div>
                                <div className="text-[9px] text-[#555] font-mono mt-2">Across {charStats.totalLines} lines</div>
                            </div>
                            <div className="bg-[#0a0a0a] border border-[#333] p-5 rounded-lg flex flex-col justify-between">
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Est. Shoot Days</div>
                                <div className="text-3xl font-black text-white">{charStats.estimatedShootDays}</div>
                                <div className="text-[9px] text-[#555] font-mono mt-2">Based on scene complexity</div>
                            </div>
                            <div className="bg-[#0a0a0a] border border-[#333] p-5 rounded-lg flex flex-col justify-between">
                                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">Schedule Block</div>
                                <div className="flex justify-between items-end">
                                    <div><div className="text-[9px] text-[#444]">FIRST</div><div className="text-lg font-bold text-white">SC {charStats.firstScene || '-'}</div></div>
                                    <ArrowRight size={14} className="text-[#333] mb-1.5"/>
                                    <div className="text-right"><div className="text-[9px] text-[#444]">LAST</div><div className="text-lg font-bold text-white">SC {charStats.lastScene || '-'}</div></div>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: SCHEDULING & ENVIRONMENT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-6">
                                    <Clock size={16} className="text-[#f5a623]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Time & Environment</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1"><span>DAY ({charStats.day})</span><span>NIGHT ({charStats.night})</span></div>
                                        <div className="h-2 bg-[#222] rounded-full overflow-hidden flex">
                                            <div className="bg-yellow-500 h-full" style={{ width: `${(charStats.day / (charStats.day + charStats.night || 1)) * 100}%` }}></div>
                                            <div className="bg-blue-900 h-full flex-1"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1"><span>INT ({charStats.int})</span><span>EXT ({charStats.ext})</span></div>
                                        <div className="h-2 bg-[#222] rounded-full overflow-hidden flex">
                                            <div className="bg-[#333] h-full" style={{ width: `${(charStats.int / (charStats.int + charStats.ext || 1)) * 100}%` }}></div>
                                            <div className="bg-green-800 h-full flex-1"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="text-[10px] font-bold text-[#555] uppercase mb-2">Chronological Appearance</div>
                                    <div className="flex h-8 gap-[1px] w-full">
                                        {charStats.timeline.map((status, idx) => (
                                            <div key={idx} className={`flex-1 transition-all hover:scale-y-125 ${status === 'active' ? 'bg-[#f5a623]' : 'bg-[#1a1a1a] hover:bg-[#222]'}`} title={`Scene ${idx + 1}: ${status === 'active' ? 'Present' : 'Absent'}`}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-6">
                                    <Radar size={16} className="text-[#f5a623]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Co-Occurrence</h3>
                                </div>
                                <div className="space-y-3">
                                    {charStats.topRelationships.map((rel, idx) => (
                                        <div key={idx} className="flex items-center gap-4">
                                            <div className="w-6 text-[10px] font-mono text-[#555] text-right">#{idx + 1}</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] font-bold text-gray-300 mb-1"><span>{rel.char}</span><span>{rel.count} Scenes</span></div>
                                                <div className="h-1.5 bg-[#222] rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(rel.count / charStats.scenes) * 100}%` }}></div></div>
                                            </div>
                                        </div>
                                    ))}
                                    {charStats.topRelationships.length === 0 && <div className="text-center text-[10px] text-[#444] py-4 italic">No interactions found yet.</div>}
                                </div>
                            </div>
                        </div>

                        {/* ROW 3: PERFORMANCE & ACTION */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Emotions */}
                            <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <Smile size={16} className="text-pink-500" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Emotional Range</h3>
                                </div>
                                <div className="space-y-3 flex-1">
                                    {Object.entries(charStats.emotions).map(([emotion, count]) => (
                                        <div key={emotion} className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{emotion}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-1.5 bg-[#222] rounded-full overflow-hidden">
                                                    <div className="h-full bg-pink-500" style={{ width: `${Math.min(100, (count as number) * 10)}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-[#555] w-4 text-right">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Dialogue Metrics */}
                            <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <Megaphone size={16} className="text-blue-400" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Dialogue Load</h3>
                                </div>
                                <div className="space-y-4 flex-1">
                                    <div className="flex justify-between items-center border-b border-[#222] pb-2">
                                        <span className="text-[10px] font-bold text-gray-400">Total Lines</span>
                                        <span className="text-lg font-black text-white">{charStats.totalLines}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-[#222] pb-2">
                                        <span className="text-[10px] font-bold text-gray-400">Avg Words / Line</span>
                                        <span className="text-lg font-black text-white">{charStats.totalLines > 0 ? Math.round(charStats.totalWords / charStats.totalLines) : 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-[#222] pb-2">
                                        <span className="text-[10px] font-bold text-gray-400">Monologues (>40w)</span>
                                        <span className={`text-lg font-black ${charStats.monologues > 0 ? 'text-[#f5a623]' : 'text-[#444]'}`}>{charStats.monologues}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Physical Action */}
                            <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg flex flex-col">
                                <div className="flex items-center gap-2 mb-6">
                                    <Skull size={16} className="text-red-500" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Physicality</h3>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-[#222]">
                                        <div className="text-3xl font-black text-white">{charStats.actionScenes}</div>
                                        <div className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent" style={{ transform: `rotate(${Math.min(360, (charStats.actionScenes / charStats.scenes) * 360)}deg)` }}></div>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Action Heavy Scenes</div>
                                        <div className="text-[9px] text-[#555] font-mono mt-1">Based on keyword analysis</div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* ROW 4: ASSETS (Placeholder for Breakdown Data) */}
                        <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Package size={16} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Asset Requirements</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-[#111] border border-[#222] rounded flex items-center justify-between">
                                    <div className="flex items-center gap-2"><Shirt size={14} className="text-pink-400"/><span className="text-[10px] font-bold text-gray-300">Costume Changes</span></div>
                                    <span className="text-xs font-mono text-[#555] font-bold">--</span>
                                </div>
                                <div className="p-3 bg-[#111] border border-[#222] rounded flex items-center justify-between">
                                    <div className="flex items-center gap-2"><Wand2 size={14} className="text-green-400"/><span className="text-[10px] font-bold text-gray-300">VFX Shots</span></div>
                                    <span className="text-xs font-mono text-[#555] font-bold">{charStats.vfx || '--'}</span>
                                </div>
                            </div>
                            <div className="mt-2 text-[9px] text-[#444] italic text-center">* Populate Scene Breakdown to see full asset list</div>
                        </div>

                    </div>
                )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-[#333]">
             <Fingerprint size={64} strokeWidth={1} className="mb-4" />
             <span className="text-sm font-mono uppercase tracking-widest">Select Subject for Analysis</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ... (NeuralMap component remains same)
// ... (DossierSection component remains same)

// Updated VitalInput with hardened null check
const VitalInput = ({ label, value, onChange, type = 'text', icon: Icon, options = [], className, naked, placeholder, onFocus }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const showDropdown = isOpen && options.length > 0;
    
    // HARDENED FILTERING: Prevent crash on null options or values
    const filteredOptions = options.filter((opt: string) => (opt || '').toLowerCase().includes(String(value || '').toLowerCase()));
    
    // Wrapper to handle internal dropdown logic + optional external clear behavior
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsOpen(true);
        if (onFocus) onFocus(e);
    };

    return (
        <div className={`group relative ${naked ? '' : 'mb-0'}`} ref={containerRef}>
            {!naked && <label className="text-[9px] font-mono text-[#555] uppercase mb-1 block flex items-center gap-1.5">{Icon && <Icon size={10} />} {label}</label>}
            <input 
                type={type} 
                value={value || ''} 
                onChange={(e) => onChange(e.target.value)} 
                onFocus={handleFocus}
                className={className || "w-full bg-[#111] border-b border-[#333] text-gray-200 hover:text-white focus:text-white text-sm font-medium py-1 px-0 outline-none focus:border-[#f5a623] transition-colors placeholder-gray-500 focus:placeholder-gray-700"} 
                placeholder={placeholder || "-"} 
                autoComplete="off" 
            />
            {showDropdown && filteredOptions.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-[#1a1a1a] border border-[#333] z-[100] max-h-40 overflow-y-auto shadow-xl rounded-b-md mt-1 custom-scrollbar">
                    {filteredOptions.map((opt: string) => (
                        <div key={opt} className="px-3 py-2 text-xs text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer transition-colors border-b border-[#222] last:border-0 font-medium" onMouseDown={(e) => { e.preventDefault(); onChange(opt); setIsOpen(false); }}>{opt}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const NeuralMap = ({ characters, selectedId, onSelect }: { characters: Record<string, CharacterData>, selectedId: string, onSelect: (id: string) => void }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const nodes = useMemo(() => {
        const charArray = Object.values(characters);
        const count = charArray.length;
        const centerX = 400, centerY = 300, radius = 200;
        return charArray.map((char, i) => {
            const angle = (i / count) * 2 * Math.PI - (Math.PI / 2);
            return {
                id: char.name, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), data: char
            };
        });
    }, [characters]);

    const links = useMemo(() => {
        const linkList: any[] = [];
        nodes.forEach(node => {
            if (node.data.relationships) {
                node.data.relationships.forEach((rel: any) => {
                    const targetNode = nodes.find(n => n.id === rel.target);
                    if (targetNode) {
                        const existing = linkList.find(l => (l.source.id === node.id && l.target.id === targetNode.id) || (l.source.id === targetNode.id && l.target.id === node.id));
                        if (!existing) linkList.push({ source: node, target: targetNode, type: rel.type });
                    }
                });
            }
        });
        return linkList;
    }, [nodes]);

    const getLinkColor = (type: string) => {
        switch(type) {
            case 'Enemy': case 'Rival': return '#ef4444';
            case 'Friend': case 'Ally': return '#22c55e';
            case 'Family': case 'Sibling': return '#3b82f6';
            case 'Lover': case 'Spouse': return '#ec4899';
            default: return '#555';
        }
    };

    return (
        <svg ref={svgRef} viewBox="0 0 800 600" className="w-full h-full bg-[#050505] cursor-move">
            <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" strokeWidth="1"/></pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {links.map((link, i) => (<line key={i} x1={link.source.x} y1={link.source.y} x2={link.target.x} y2={link.target.y} stroke={getLinkColor(link.type)} strokeWidth="1.5" strokeOpacity="0.6"/>))}
            {nodes.map(node => {
                const isSelected = node.id === selectedId;
                const hasImage = node.data.images && node.data.images.length > 0;
                return (
                    <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer transition-all duration-300">
                        {isSelected && <circle cx={node.x} cy={node.y} r="35" fill="none" stroke="#f5a623" strokeWidth="2" opacity="0.5" className="animate-pulse" />}
                        <circle cx={node.x} cy={node.y} r="28" fill="#111" stroke={isSelected ? "#f5a623" : "#333"} strokeWidth={isSelected ? 3 : 1} filter={isSelected ? "url(#glow)" : ""} />
                        {hasImage ? (
                            <>
                                <defs><pattern id={`img-${node.id}`} x="0" y="0" width="1" height="1"><image href={node.data.images[0]} x="0" y="0" width="56" height="56" preserveAspectRatio="xMidYMid slice" /></pattern></defs>
                                <circle cx={node.x} cy={node.y} r="26" fill={`url(#img-${node.id})`} />
                            </>
                        ) : (
                            <text x={node.x} y={node.y} dy="5" textAnchor="middle" fill="#ccc" fontSize="16" fontWeight="bold" pointerEvents="none">{node.id && node.id.length >= 2 ? node.id.substring(0,2) : "??"}</text>
                        )}
                        <text x={node.x} y={node.y + 45} textAnchor="middle" fill={isSelected ? "#fff" : "#666"} fontSize="10" fontWeight="bold" letterSpacing="1">{node.id || '??'}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const DossierSection = ({ title, icon: Icon, color, desc, children }: any) => (
    <div className="border border-[#222] bg-[#111] rounded-lg overflow-hidden group flex flex-col min-h-[200px]">
        <div className="px-5 py-3 border-b border-[#222] bg-[#151515] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded bg-[#0a0a0a] border border-[#222] ${color}`}><Icon size={16} /></div>
                <div><h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{title}</h3><p className="text-[10px] text-[#555] font-mono leading-none mt-0.5">{desc}</p></div>
            </div>
            <MoreHorizontal size={14} className="text-[#333]" />
        </div>
        <div className="flex-1 flex flex-col">
            {children}
        </div>
    </div>
);

export default CharacterView;
