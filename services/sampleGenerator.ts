import { Beat, Group, Connection, Annotation, CharacterData, Shot } from '../types';

export function createAuto5ScenesDataset() {
  const timestamp = Date.now();

  // 1. ACT GROUPS (Act Categorization on Whiteboard)
  const groups: Group[] = [
    {
      id: 101,
      title: 'ACT I — SETUP & INCITING INCIDENT',
      x: 80,
      y: 100,
      width: 420,
      height: 520,
      color: '#3b82f6', // Blue
      boardId: 1
    },
    {
      id: 102,
      title: 'ACT IIA — RISING COMPLICATIONS',
      x: 540,
      y: 100,
      width: 420,
      height: 520,
      color: '#8b5cf6', // Purple
      boardId: 1
    },
    {
      id: 103,
      title: 'ACT IIB — THE MIDPOINT CONFRONTATION',
      x: 1000,
      y: 100,
      width: 420,
      height: 520,
      color: '#ec4899', // Pink / Magenta
      boardId: 1
    },
    {
      id: 104,
      title: 'ACT III — THE CLIMAX BREACH',
      x: 1460,
      y: 100,
      width: 420,
      height: 520,
      color: '#f59e0b', // Amber
      boardId: 1
    },
    {
      id: 105,
      title: 'EPILOGUE — RESOLUTION & RECONCILIATION',
      x: 1920,
      y: 100,
      width: 420,
      height: 520,
      color: '#10b981', // Emerald
      boardId: 1
    }
  ];

  // 2. 5 SCENE BEATS (Proper Screenplay Build-up & Metadata)
  const beats: Beat[] = [
    {
      id: 1,
      x: 110,
      y: 160,
      title: '1. Cyber-Lab Heist',
      sceneNumber: '1',
      slug: { prefix: 'INT', location: 'CYBER-LAB 09', time: 'NIGHT' },
      summary: 'Maya breaches the mainframe server room in Cyber-Lab 09 to retrieve the encrypted neural key before security locks down the sector.',
      color: '#3b82f6',
      tint: '#1e293b',
      status: 'ready',
      boardId: 1,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. CYBER-LAB 09 - NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Blue neon hums across rain-slicked server stacks. MAYA (30s, sharp eyes, worn leather duster) hunches over a glowing terminal console, her fingers flying across mechanical keycaps.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-parenthetical" style="text-align: center; font-style: italic;">(whispering under her breath)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">If the decryption bypass holds for twenty seconds... we walk out rich.</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">The terminal BEEPS violently. A crimson alert flashes: CORRUPTED DECRYPT PROTOCOL - SECURITY NOTIFIED.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">KALE</p>
<p class="sc-parenthetical" style="text-align: center; font-style: italic;">(over comlink)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Maya, abort! Enforcers just breached the lower perimeter!</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Maya grabs the glowing glass drive key, YANKS it free, and bolts toward the emergency exit as siren klaxons begin to WAIL.</p>`,
      notes: [
        { id: 'note-1-1', content: '<b>Director Note:</b> Low-key blue key lighting with sharp crimson alert flashes.', color: '#38bdf8', timestamp: timestamp },
        { id: 'note-1-2', content: '<b>Key Prop:</b> Glowing glass drive key with neural core wire.', color: '#f5a623', timestamp: timestamp }
      ],
      breakdown: {
        sound: ['Siren Klaxons', 'Terminal Beep', 'Rain Humm'],
        props: ['Glowing Glass Drive Key', 'Decryption Console', 'Comlink Earpiece'],
        costume: ['Maya Worn Leather Duster', 'Cyber Eyewear'],
        vfx: ['Crimson Security Alert Overlay', 'Holographic Data Stream'],
        practical: ['Interactive Server Rack LEDs', 'Smoke Fog Effect'],
        cast: ['Enforcer Guards (Non-speaking)'],
        location: ['Cyber-Lab Server Core']
      },
      versions: [
        { id: 'v1-1', timestamp: timestamp - 3600000, title: 'Draft 1 - Stealth Approach', content: '<p>Maya stealthily bypasses door lock without siren sounding.</p>' },
        { id: 'v1-2', timestamp: timestamp, title: 'Draft 2 - High Tension Breach', content: '<p>Added red alert sirens and comlink urgency from Kale.</p>' }
      ]
    },

    {
      id: 2,
      x: 570,
      y: 160,
      title: '2. Neon Alley Pursuit',
      sceneNumber: '2',
      slug: { prefix: 'EXT', location: 'SHADOW ALLEYWAY', time: 'CONTINUOUS' },
      summary: 'Maya escapes into torrential rain as heavy drone searchlights sweep the neon-drenched alleyways. Kale guides her toward the safehouse.',
      color: '#8b5cf6',
      tint: '#2e1065',
      status: 'ready',
      boardId: 1,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. SHADOW ALLEYWAY - CONTINUOUS</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Heavy rain pummels asphalt glistening under pink and teal neon signs. Maya bursts through the heavy steel door, skidding onto wet cobblestones.</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Above, a sleek SYNTH-DRONE cuts through steam vents, its bright white spotlight sweeping across the brick facade.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">KALE</p>
<p class="sc-parenthetical" style="text-align: center; font-style: italic;">(static crackle over ear comm)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Take the fire escape on your left! I’m jamming their thermal tracking!</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Jam it faster! The scanner is locking onto my bio-signature!</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">She leaps onto an iron ladder rung just as an enforcer laser dot cuts through the rain where she stood.</p>`,
      notes: [
        { id: 'note-2-1', content: '<b>Camera Direction:</b> High angle tracking shot down wet alley as drone light passes.', color: '#a855f7', timestamp: timestamp }
      ],
      breakdown: {
        sound: ['Rain Patter', 'Drone Thruster Whine', 'Laser Zap'],
        props: ['Fire Escape Ladder', 'Bio-Scanner'],
        costume: ['Maya Rain-Soaked Coat'],
        vfx: ['Laser Dot Pointer', 'Drone Spotlight Beam'],
        practical: ['Wet Asphalt Rain Machine'],
        cast: ['Syndicate Enforcer 1', 'Syndicate Enforcer 2'],
        location: ['District 4 Back Alley']
      }
    },

    {
      id: 3,
      x: 1030,
      y: 160,
      title: '3. Safehouse Confrontation',
      sceneNumber: '3',
      slug: { prefix: 'INT', location: 'HIGH-RISE CONTROL ROOM', time: 'NIGHT' },
      summary: 'Maya reaches the safehouse only to discover Director Vane waiting inside, forcing a psychological standoff over the stolen neural key.',
      color: '#ec4899',
      tint: '#4d072b',
      status: 'ready',
      boardId: 1,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. HIGH-RISE CONTROL ROOM - NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Floor-to-ceiling glass windows reveal a sprawling metropolis engulfed in storm clouds. DIRECTOR VANE (50s, impeccably tailored suit, cold silver eyes) pours dark scotch into a crystal tumbler.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">DIRECTOR VANE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">You always were relentless, Maya. But stealing the Genesis key is far beyond your clearance.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-parenthetical" style="text-align: center; font-style: italic;">(hand resting on holstered pistol)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Clearance means nothing when you’re erasing human memories for profit, Vane.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">DIRECTOR VANE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">We’re building order. Hand over the key or Kale pays the ultimate price.</p>`,
      notes: [
        { id: 'note-3-1', content: '<b>Midpoint Pivot:</b> Emotional stakes shift from survival to saving Kale.', color: '#ec4899', timestamp: timestamp }
      ],
      breakdown: {
        sound: ['Thunder Claps', 'Ice Cubes Clinking', 'Low Tension Drone'],
        props: ['Crystal Tumbler', 'Dark Scotch Bottle', 'Neural Drive Case'],
        costume: ['Vane Tailored Suit', 'Silver Watch'],
        vfx: ['Panoramic Holographic Cityscape'],
        practical: ['Glass Window Rain Beads'],
        cast: ['Director Vane', 'Maya'],
        location: ['Penthouse Control Room']
      }
    },

    {
      id: 4,
      x: 1490,
      y: 160,
      title: '4. The Final Data Breach',
      sceneNumber: '4',
      slug: { prefix: 'INT', location: 'DATA VAULT CORE', time: 'LATE NIGHT' },
      summary: 'Maya overrides the mainframe server core, broadcasting the memory corruption evidence live to every terminal in the city.',
      color: '#f59e0b',
      tint: '#451a03',
      status: 'ready',
      boardId: 1,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. DATA VAULT CORE - LATE NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Sparks cascade from destroyed terminal relays. Maya slams the neural key directly into the central optical node.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Initiating global broadcast... let the world see the truth!</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Giant holographic monitors light up simultaneously across the vault core, displaying encrypted financial ledgers and memory wipe logs.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">DIRECTOR VANE</p>
<p class="sc-parenthetical" style="text-align: center; font-style: italic;">(staggering back in horror)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">No... you’ve destroyed twenty years of work in five seconds!</p>`,
      notes: [
        { id: 'note-4-1', content: '<b>Climax Beat:</b> Maximum visual contrast with golden spark cascades.', color: '#f59e0b', timestamp: timestamp }
      ],
      breakdown: {
        sound: ['Electrical Spark Pop', 'Global Broadcast Chime', 'Vane Shouting'],
        props: ['Optical Node Bay', 'Destroyed Terminal Relay'],
        costume: ['Maya Damaged Duster'],
        vfx: ['Sparks Cascade', 'Global Broadcast Data Stream'],
        practical: ['Pyrotechnic Sparks'],
        cast: ['Maya', 'Director Vane', 'Kale'],
        location: ['Central Core Vault']
      }
    },

    {
      id: 5,
      x: 1950,
      y: 160,
      title: '5. Rooftop Dawn',
      sceneNumber: '5',
      slug: { prefix: 'EXT', location: 'ROOFTOP OVERLOOK', time: 'DAWN' },
      summary: 'As the morning sun pierces through dissipating storm clouds, Maya and Kale look out over the newly liberated city skyline.',
      color: '#10b981',
      tint: '#022c22',
      status: 'ready',
      boardId: 1,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. ROOFTOP OVERLOOK - DAWN</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Golden morning sunlight breaks over the horizon, bathing the concrete towers in warm amber rays. The rain has finally stopped.</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Kale leans against the rusted iron railing, wrapping a bandage around his wrist while Maya stands beside him, breathing in the crisp morning air.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">KALE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">The whole network is buzzing. They can’t put the secret back in the box.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Good. Now the real work begins.</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">FADE OUT.</p>`,
      notes: [
        { id: 'note-5-1', content: '<b>Resolution Mood:</b> Warm golden lighting representing hope & new start.', color: '#10b981', timestamp: timestamp }
      ],
      breakdown: {
        sound: ['Morning Wind', 'Distant City Traffic', 'Soft Uplifting Score'],
        props: ['Bandage Roll', 'Iron Railing'],
        costume: ['Maya Casual Coat', 'Kale Bandaged Gear'],
        vfx: ['Volumetric Dawn Sunlight Rays'],
        practical: ['Wind Machine'],
        cast: ['Maya', 'Kale'],
        location: ['High-rise Rooftop']
      }
    }
  ];

  // 3. WHITEBOARD ANNOTATIONS & DRAWINGS
  const annotations: Annotation[] = [
    // Sticky Notes
    {
      id: 201,
      type: 'text',
      color: '#f5a623',
      x: 120,
      y: 440,
      w: 360,
      h: 90,
      text: '🔑 INCITING INCIDENT\nKeep lighting low-key blue with fast cutting pace.',
      fontSize: 12,
      boardId: 1
    },
    {
      id: 202,
      type: 'text',
      color: '#8b5cf6',
      x: 580,
      y: 440,
      w: 360,
      h: 90,
      text: '⚡ ACTION SEQUENCE\nHigh contrast neon reflections & rain effects.',
      fontSize: 12,
      boardId: 1
    },
    {
      id: 203,
      type: 'text',
      color: '#ec4899',
      x: 1040,
      y: 440,
      w: 360,
      h: 90,
      text: '🎯 MIDPOINT STANDOFF\nSlow zoom on Vane & Maya during dialogue climax.',
      fontSize: 12,
      boardId: 1
    },
    {
      id: 204,
      type: 'text',
      color: '#10b981',
      x: 1960,
      y: 440,
      w: 360,
      h: 90,
      text: '🌅 RESOLUTION & HOPE\nWarm anamorphic lens flare with dawn sunlight.',
      fontSize: 12,
      boardId: 1
    },

    // Whiteboard Markup Drawings (SVG Path Drawings / Highlights)
    {
      id: 205,
      type: 'pencil',
      color: '#ef4444',
      d: 'M 1040 180 C 1080 140, 1400 140, 1440 180 C 1480 220, 1080 220, 1040 180 Z',
      boardId: 1
    },
    {
      id: 206,
      type: 'pencil',
      color: '#f5a623',
      d: 'M 110 320 L 470 320 L 470 410 L 110 410 Z',
      boardId: 1
    }
  ];

  // 4. CONNECTIONS BETWEEN BEATS
  const connections: Connection[] = [
    { from: 1, to: 2, boardId: 1 },
    { from: 2, to: 3, boardId: 1 },
    { from: 3, to: 4, boardId: 1 },
    { from: 4, to: 5, boardId: 1 }
  ];

  // 5. CHARACTER PROFILES
  const characterData: Record<string, CharacterData> = {
    'MAYA': {
      id: 'char-maya',
      name: 'MAYA',
      age: 32,
      gender: 'Female',
      ethnicity: 'East Asian / Mixed',
      hair: 'Dark cropped pixie cut',
      eyes: 'Piercing amber eyes',
      build: 'Athletic, agile build',
      occupation: 'Rogue Data Analyst / Hacker',
      archetype: 'The Rebellious Hero',
      physiology: 'Cybernetic interface port on left wrist.',
      sociology: 'Former corporate analyst turned underground freedom fighter.',
      psychology: 'Driven by guilt over past corporate work, intensely protective of teammates.',
      backstory: 'Ex-employee of Genesis Corp who uncovered memory erasure operations.',
      images: [],
      relationships: [
        { target: 'KALE', type: 'Partner', description: 'Trusted hacker wingman and tech guide.' },
        { target: 'DIRECTOR VANE', type: 'Nemesis', description: 'Former employer and mastermind behind Genesis.' }
      ]
    },

    'KALE': {
      id: 'char-kale',
      name: 'KALE',
      age: 28,
      gender: 'Male',
      ethnicity: 'South Asian',
      hair: 'Short dark curly hair',
      eyes: 'Brown',
      build: 'Slender, tech enthusiast',
      occupation: 'Signals & Comms Specialist',
      archetype: 'The Loyal Ally',
      physiology: 'Wears custom HUD glasses.',
      sociology: 'Underground radio operator.',
      psychology: 'Quick-witted under pressure, uses humor as defense mechanism.',
      backstory: 'Met Maya during the District 4 blackout.',
      images: [],
      relationships: [
        { target: 'MAYA', type: 'Partner', description: 'Comms guide and operational buddy.' }
      ]
    },

    'DIRECTOR VANE': {
      id: 'char-vane',
      name: 'DIRECTOR VANE',
      age: 54,
      gender: 'Male',
      ethnicity: 'Caucasian',
      hair: 'Slicked back silver grey',
      eyes: 'Cold steel blue',
      build: 'Tall, imposing posture',
      occupation: 'CEO of Genesis Cybernetics',
      archetype: 'The Ruthless Mastermind',
      physiology: 'Flawless posture with immaculate tailored attire.',
      sociology: 'Elite tier corporate executive.',
      psychology: 'Believes absolute memory control is the only key to societal stability.',
      backstory: 'Pioneered neural data suppression technology.',
      images: [],
      relationships: [
        { target: 'MAYA', type: 'Enemy', description: 'Sees Maya as a dangerous rogue element.' }
      ]
    }
  };

  // 6. PRE-BUILT SHOT DIVISION CARDS (Shot List & Storyboard)
  const generatedShots: Shot[] = [
    {
      id: 'shot-auto-1',
      scene: '1',
      shotSize: 'MEDIUM WIDE',
      angle: 'LOW ANGLE',
      lens: '24mm Prime',
      movement: 'Slow Dolly In',
      subject: 'Maya at terminal',
      description: 'Low angle shot of Maya hunched over the glowing terminal in Cyber-Lab 09, framed by vertical blue server towers.',
      scriptReference: 'Blue neon hums across rain-slicked server stacks...',
      sourceType: 'manual',
      durationSec: 4,
      reasoning: 'Establishes high-tech isolation and tension.'
    },
    {
      id: 'shot-auto-2',
      scene: '1',
      shotSize: 'CLOSE UP',
      angle: 'EYE LEVEL',
      lens: '85mm Anamorphic',
      movement: 'Static',
      subject: 'Maya\'s eyes & terminal glow',
      description: 'Tight close up on Maya\'s sharp amber eyes reflecting green and red matrix lines as the security alert triggers.',
      scriptReference: 'If the decryption bypass holds for twenty seconds...',
      sourceType: 'ai-modified',
      durationSec: 3,
      reasoning: 'Focuses on micro-expression shift from focus to panic.'
    },
    {
      id: 'shot-auto-3',
      scene: '2',
      shotSize: 'WIDE',
      angle: 'HIGH ANGLE',
      lens: '18mm Ultra Wide',
      movement: 'Tracking Shot',
      subject: 'Rain alleyway pursuit',
      description: 'High tracking shot looking down at wet alley as Maya sprints through rain, bathed in pink neon light while drone searchlight follows.',
      scriptReference: 'Maya bursts through the heavy steel door, skidding onto wet cobblestones...',
      sourceType: 'ai-batch',
      durationSec: 5,
      reasoning: 'Dynamic motion showing environmental hazard and pursuit.'
    },
    {
      id: 'shot-auto-4',
      scene: '3',
      shotSize: 'TWO SHOT',
      angle: 'EYE LEVEL',
      lens: '50mm Standard',
      movement: 'Slow Pan',
      subject: 'Vane and Maya standoff',
      description: 'Medium two-shot framing Vane pouring scotch at glass window with stormy city skyline behind him, Maya in foreground profile.',
      scriptReference: 'You always were relentless, Maya...',
      sourceType: 'manual',
      durationSec: 6,
      reasoning: 'Balanced power dynamic tension between protagonist and antagonist.'
    },
    {
      id: 'shot-auto-5',
      scene: '4',
      shotSize: 'EXTREME CLOSE UP',
      angle: 'DUTCH ANGLE',
      lens: '105mm Macro',
      movement: 'Handheld',
      subject: 'Neural key insertion',
      description: 'Dutch angle macro ECU as Maya inserts glowing glass key into optical core, causing golden sparks to cascade.',
      scriptReference: 'Initiating global broadcast... let the world see the truth!',
      sourceType: 'ai-batch',
      durationSec: 3,
      reasoning: 'Amplifies climax energy and technological overload.'
    },
    {
      id: 'shot-auto-6',
      scene: '5',
      shotSize: 'WIDE',
      angle: 'EYE LEVEL',
      lens: '35mm Prime',
      movement: 'Static',
      subject: 'Rooftop sunrise overview',
      description: 'Sprawling wide shot of Maya and Kale leaning on rooftop iron railing as warm golden dawn sunlight breaks across city towers.',
      scriptReference: 'Golden morning sunlight breaks over the horizon...',
      sourceType: 'manual',
      durationSec: 7,
      reasoning: 'Warm resolution shot providing emotional relief and hope.'
    }
  ];

  return {
    groups,
    beats,
    annotations,
    connections,
    characterData,
    generatedShots
  };
}
