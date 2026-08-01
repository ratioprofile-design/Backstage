import { Beat, Group, Connection, Annotation, CharacterData, Shot } from '../types';

let currentStoryCounter = 0;

export function createAuto5ScenesDataset(targetBoardId: number = 0) {
  const timestamp = Date.now();
  const storyIndex = currentStoryCounter % 4;
  currentStoryCounter++;

  if (storyIndex === 0) {
    // STORY 0: CYBERPUNK NEURAL HEIST
    const groups: Group[] = [
      { id: 101, title: 'ACT I — SETUP & INCITING INCIDENT', x: 80, y: 100, width: 420, height: 520, color: '#3b82f6', boardId: targetBoardId },
      { id: 102, title: 'ACT IIA — RISING COMPLICATIONS', x: 540, y: 100, width: 420, height: 520, color: '#8b5cf6', boardId: targetBoardId },
      { id: 103, title: 'ACT IIB — THE MIDPOINT CONFRONTATION', x: 1000, y: 100, width: 420, height: 520, color: '#ec4899', boardId: targetBoardId },
      { id: 104, title: 'ACT III — THE CLIMAX BREACH', x: 1460, y: 100, width: 420, height: 520, color: '#f59e0b', boardId: targetBoardId },
      { id: 105, title: 'EPILOGUE — RESOLUTION & RECONCILIATION', x: 1920, y: 100, width: 420, height: 520, color: '#10b981', boardId: targetBoardId }
    ];

    const beats: Beat[] = [
      {
        id: 1, x: 110, y: 160, title: '1. Cyber-Lab Heist', sceneNumber: '1',
        slug: { prefix: 'INT', location: 'CYBER-LAB 09', time: 'NIGHT' },
        summary: 'Maya breaches the mainframe server room in Cyber-Lab 09 to retrieve the encrypted neural key before security locks down the sector.',
        color: '#3b82f6', tint: '#1e293b', status: 'ready', boardId: targetBoardId,
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
          { id: 'note-1-1', content: '<b>Director Note:</b> Low-key blue key lighting with sharp crimson alert flashes.', color: '#38bdf8', timestamp },
          { id: 'note-1-2', content: '<b>Key Prop:</b> Glowing glass drive key with neural core wire.', color: '#f5a623', timestamp }
        ],
        breakdown: {
          sound: ['Siren Klaxons', 'Terminal Beep', 'Rain Humm'], props: ['Glowing Glass Drive Key', 'Decryption Console'], costume: ['Maya Worn Leather Duster'], vfx: ['Crimson Security Alert Overlay'], practical: ['Interactive Server Rack LEDs'], cast: ['Enforcer Guards'], location: ['Cyber-Lab Server Core']
        },
        versions: [{ id: 'v1-1', timestamp: timestamp - 3600000, title: 'Draft 1', content: '<p>Initial draft.</p>' }]
      },
      {
        id: 2, x: 570, y: 160, title: '2. Neon Alley Pursuit', sceneNumber: '2',
        slug: { prefix: 'EXT', location: 'SHADOW ALLEYWAY', time: 'CONTINUOUS' },
        summary: 'Maya escapes into torrential rain as heavy drone searchlights sweep the neon-drenched alleyways.',
        color: '#8b5cf6', tint: '#2e1065', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. SHADOW ALLEYWAY - CONTINUOUS</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Heavy rain pummels asphalt glistening under pink and teal neon signs. Maya bursts through the heavy steel door, skidding onto wet cobblestones.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">KALE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Take the fire escape on your left! I’m jamming their thermal tracking!</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Jam it faster! The scanner is locking onto my bio-signature!</p>`,
        notes: [{ id: 'note-2-1', content: '<b>Camera Direction:</b> High angle tracking shot down wet alley.', color: '#a855f7', timestamp }],
        breakdown: { sound: ['Rain Patter', 'Drone Thruster Whine'], props: ['Fire Escape Ladder'], costume: ['Maya Rain Coat'], vfx: ['Laser Dot Pointer'], practical: ['Wet Asphalt Rain Machine'], cast: ['Syndicate Enforcer'], location: ['District 4 Back Alley'] },
        versions: []
      },
      {
        id: 3, x: 1030, y: 160, title: '3. Safehouse Confrontation', sceneNumber: '3',
        slug: { prefix: 'INT', location: 'HIGH-RISE CONTROL ROOM', time: 'NIGHT' },
        summary: 'Maya reaches the safehouse only to discover Director Vane waiting inside, forcing a psychological standoff.',
        color: '#ec4899', tint: '#4d072b', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. HIGH-RISE CONTROL ROOM - NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Floor-to-ceiling glass windows reveal a sprawling metropolis engulfed in storm clouds. DIRECTOR VANE (50s, silver hair, tailored suit) pours dark scotch into a crystal tumbler.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">DIRECTOR VANE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">You always were relentless, Maya. But that key doesn't belong to you.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">It belongs to the people whose memories you erased!</p>`,
        notes: [{ id: 'note-3-1', content: '<b>Performance Note:</b> Cold calculated stillness from Vane.', color: '#f43f5e', timestamp }],
        breakdown: { sound: ['Thunder Rumble', 'Glass Clink'], props: ['Crystal Tumbler', 'Scotch Bottle'], costume: ['Vane Tailored Suit'], vfx: ['Stormy Cityscape Window Background'], practical: ['Dim Ambient Table Lamp'], cast: ['Director Vane'], location: ['Genesis Executive Penthouse'] },
        versions: []
      },
      {
        id: 4, x: 1490, y: 160, title: '4. Data Vault Breach', sceneNumber: '4',
        slug: { prefix: 'INT', location: 'DATA VAULT CORE', time: 'LATE NIGHT' },
        summary: 'Sparks fly as Maya slams the neural key into the central optical node, broadcasting the suppressed memory logs.',
        color: '#f59e0b', tint: '#451a03', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. DATA VAULT CORE - LATE NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Sparks cascade from destroyed terminal relays. Maya slams the neural key directly into the central optical node.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Initiating global broadcast... let the world see the truth!</p>`,
        notes: [{ id: 'note-4-1', content: '<b>SFX Note:</b> High frequency energy hum escalating.', color: '#eab308', timestamp }],
        breakdown: { sound: ['Energy Surge', 'Spark Crackle'], props: ['Optical Core Console'], costume: ['Maya Damaged Duster'], vfx: ['Golden Holographic Broadcast Stream'], practical: ['Pyrotechnic Sparks'], cast: ['Maya'], location: ['Data Vault Core'] },
        versions: []
      },
      {
        id: 5, x: 1950, y: 160, title: '5. Dawn Over the City', sceneNumber: '5',
        slug: { prefix: 'EXT', location: 'ROOFTOP OVERLOOK', time: 'DAWN' },
        summary: 'Golden morning sunlight breaks over the horizon as Maya and Kale stand on the rooftop, watching the city awaken.',
        color: '#10b981', tint: '#022c22', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. ROOFTOP OVERLOOK - DAWN</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Golden morning sunlight breaks over the horizon, bathing concrete towers in warm amber rays. The rain has finally stopped.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">KALE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">The feed went live everywhere. There's no hiding now.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MAYA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Good. Now we start rebuilding.</p>`,
        notes: [{ id: 'note-5-1', content: '<b>Lighting Note:</b> Anamorphic golden lens flare sunrise.', color: '#10b981', timestamp }],
        breakdown: { sound: ['Birds Chirping', 'Distant City Traffic'], props: ['Hand Bandages'], costume: ['Maya & Kale Sunset Gear'], vfx: ['Golden Sun Flare'], practical: ['Wind Machine Soft Breeze'], cast: ['Maya', 'Kale'], location: ['Sector 9 Rooftop'] },
        versions: []
      }
    ];

    const annotations: Annotation[] = [
      { id: 201, type: 'text', x: 110, y: 320, w: 200, h: 90, text: '🔑 INCITING INCIDENT\nKeep lighting low-key blue with fast cutting pace.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' },
      { id: 202, type: 'text', x: 570, y: 320, w: 200, h: 90, text: '⚡ ACTION SEQUENCE\nHigh contrast neon reflections & rain effects.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' },
      { id: 203, type: 'text', x: 1030, y: 320, w: 200, h: 90, text: '🎯 MIDPOINT STANDOFF\nSlow zoom on Vane & Maya during dialogue climax.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' },
      { id: 204, type: 'text', x: 1950, y: 320, w: 200, h: 90, text: '🌅 RESOLUTION & HOPE\nWarm anamorphic lens flare with dawn sunlight.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' }
    ];

    const connections: Connection[] = [
      { from: 1, to: 2, boardId: targetBoardId }, { from: 2, to: 3, boardId: targetBoardId },
      { from: 3, to: 4, boardId: targetBoardId }, { from: 4, to: 5, boardId: targetBoardId }
    ];

    const characterData: Record<string, CharacterData> = {
      'MAYA': {
        id: 'char-maya', name: 'MAYA', age: 32, gender: 'Female', ethnicity: 'East Asian / Mixed', hair: 'Dark cropped pixie cut', eyes: 'Piercing amber eyes', build: 'Athletic, agile', occupation: 'Rogue Data Analyst', archetype: 'The Rebellious Hero', physiology: 'Cybernetic interface port on wrist.', sociology: 'Underground freedom fighter.', psychology: 'Driven by truth.', backstory: 'Ex-Genesis employee.', images: [], relationships: [{ target: 'KALE', type: 'Partner', description: 'Tech guide.' }]
      },
      'KALE': {
        id: 'char-kale', name: 'KALE', age: 28, gender: 'Male', ethnicity: 'South Asian', hair: 'Short dark curly hair', eyes: 'Brown', build: 'Slender', occupation: 'Signals Specialist', archetype: 'The Faithful Ally', physiology: 'Custom HUD glasses.', sociology: 'Radio operator.', psychology: 'Quick-witted under pressure.', backstory: 'Met Maya in District 4.', images: [], relationships: []
      },
      'DIRECTOR VANE': {
        id: 'char-vane', name: 'DIRECTOR VANE', age: 54, gender: 'Male', ethnicity: 'Caucasian', hair: 'Silver grey', eyes: 'Steel blue', build: 'Imposing', occupation: 'CEO of Genesis', archetype: 'The Mastermind', physiology: 'Tailored attire.', sociology: 'Corporate elite.', psychology: 'Obsessed with control.', backstory: 'Pioneered memory suppression.', images: [], relationships: []
      }
    };

    const generatedShots: Shot[] = [
      { id: 'shot-1', scene: '1', shotSize: 'MEDIUM WIDE', angle: 'LOW ANGLE', lens: '24mm Prime', movement: 'Dolly In', subject: 'Maya at terminal', description: 'Low angle of Maya hunched over glowing terminal.', scriptReference: 'Blue neon hums across server stacks...', sourceType: 'manual', durationSec: 4 },
      { id: 'shot-2', scene: '2', shotSize: 'WIDE', angle: 'HIGH ANGLE', lens: '18mm Wide', movement: 'Tracking', subject: 'Rain alleyway pursuit', description: 'High tracking shot down wet alley as Maya sprints.', scriptReference: 'Maya bursts through heavy door...', sourceType: 'manual', durationSec: 5 },
      { id: 'shot-3', scene: '3', shotSize: 'TWO SHOT', angle: 'EYE LEVEL', lens: '50mm Standard', movement: 'Slow Pan', subject: 'Vane & Maya standoff', description: 'Medium two-shot framing Vane pouring scotch.', scriptReference: 'You always were relentless...', sourceType: 'manual', durationSec: 6 }
    ];

    return { groups, beats, annotations, connections, characterData, generatedShots };

  } else if (storyIndex === 1) {
    // STORY 1: ANCIENT TEMPLE EXPEDITION
    const groups: Group[] = [
      { id: 101, title: 'ACT I — TEMPLE DISCOVERY', x: 80, y: 100, width: 420, height: 520, color: '#f59e0b', boardId: targetBoardId },
      { id: 102, title: 'ACT IIA — THE SERPENT RAVINE', x: 540, y: 100, width: 420, height: 520, color: '#ef4444', boardId: targetBoardId },
      { id: 103, title: 'ACT IIB — ALTAR OF ECHOES', x: 1000, y: 100, width: 420, height: 520, color: '#8b5cf6', boardId: targetBoardId },
      { id: 104, title: 'ACT III — THE CHAMBER OF SUNS', x: 1460, y: 100, width: 420, height: 520, color: '#3b82f6', boardId: targetBoardId },
      { id: 105, title: 'EPILOGUE — CLIFFSIDE ESCAPE', x: 1920, y: 100, width: 420, height: 520, color: '#10b981', boardId: targetBoardId }
    ];

    const beats: Beat[] = [
      {
        id: 1, x: 110, y: 160, title: '1. Unearthing the Seal', sceneNumber: '1',
        slug: { prefix: 'EXT', location: 'SUNKEN TEMPLE RUINS', time: 'DAY' },
        summary: 'Dr. Harrison clears moss from a colossal stone carved sun dial, revealing ancient glyphs leading to the lost vault of El Dorado.',
        color: '#f59e0b', tint: '#451a03', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. SUNKEN TEMPLE RUINS - DAY</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Dense jungle vines canopy the ancient stone ziggurat. DR. HARRISON (40s, rugged canvas jacket, fedora) scrapes dirt from an intricate carved sun disc with a brass trowel.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">DR. HARRISON</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Look at these radial inscriptions... it's not a tomb, Elena. It's a star map!</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">ELENA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Then we better unlock it before Lord Sterling's mercenary convoy reaches the valley.</p>`,
        notes: [{ id: 'n-1', content: '<b>Prop Note:</b> Weathered brass journal and magnifying lens.', color: '#f5a623', timestamp }],
        breakdown: { sound: ['Jungle Birds', 'Stone Scraping'], props: ['Brass Trowel', 'Sun Disc Map'], costume: ['Harrison Canvas Jacket'], vfx: ['Sunlight Beam through Canopy'], practical: ['Real Moss & Vines'], cast: ['Harrison', 'Elena'], location: ['Amazon Rainforest Valley'] },
        versions: []
      },
      {
        id: 2, x: 570, y: 160, title: '2. Serpent Ravine Crossing', sceneNumber: '2',
        slug: { prefix: 'EXT', location: 'SERPENT RAVINE BRIDGES', time: 'LATE AFTERNOON' },
        summary: 'Elena and Harrison navigate a decaying rope suspension bridge while mercenary gunshots echo across the misty canyon.',
        color: '#ef4444', tint: '#450a0a', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. SERPENT RAVINE BRIDGES - LATE AFTERNOON</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Mist surges through a five-hundred-foot canyon below. Wooden planks ROT as Harrison takes a cautious step onto the frayed hemp rope bridge.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">ELENA</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Don't look down, Harrison! Just keep moving!</p>`,
        notes: [{ id: 'n-2', content: '<b>Stunt Note:</b> High wire harness for actors.', color: '#ef4444', timestamp }],
        breakdown: { sound: ['Wind Howl', 'Rope Creak', 'Gunshot Echo'], props: ['Torch', 'Rope Bridge'], costume: ['Elena Expedition Outfit'], vfx: ['Deep Canyon Fog'], practical: ['Mist Generator'], cast: ['Mercenary Sniper'], location: ['Serpent Ravine'] },
        versions: []
      },
      {
        id: 3, x: 1030, y: 160, title: '3. Altar of Echoes Standoff', sceneNumber: '3',
        slug: { prefix: 'INT', location: 'ALTAR OF ECHOES', time: 'DUSK' },
        summary: 'Inside the subterranean altar, Lord Sterling corners Harrison at gunpoint, demanding the gold sun medallion.',
        color: '#8b5cf6', tint: '#2e1065', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. ALTAR OF ECHOES - DUSK</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Massive gold mirrors catch torchlight. LORD STERLING (50s, refined British officer suit, silver cane) steps into the hall with armed mercenaries.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">LORD STERLING</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">Hand over the sun medallion, Doctor. History is written by those who fund the expedition.</p>`,
        notes: [{ id: 'n-3', content: '<b>Lighting Note:</b> Golden torch light reflections.', color: '#8b5cf6', timestamp }],
        breakdown: { sound: ['Echoing Footsteps', 'Cane Tap'], props: ['Gold Sun Medallion', 'Silver Cane'], costume: ['Sterling Officer Uniform'], vfx: ['Mirror Prism Reflection Beam'], practical: ['Fire Torches'], cast: ['Lord Sterling', 'Mercenaries'], location: ['Temple Inner Vault'] },
        versions: []
      },
      {
        id: 4, x: 1490, y: 160, title: '4. The Solar Alignment', sceneNumber: '4',
        slug: { prefix: 'INT', location: 'CHAMBER OF SUNS', time: 'SUNSET' },
        summary: 'Elena triggers the counterweight mechanism, causing light beams to align and collapse the stone floor beneath the mercenaries.',
        color: '#3b82f6', tint: '#1e293b', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. CHAMBER OF SUNS - SUNSET</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Elena pulls a bronze lever. Massive gears GRIND as sunlight channels through roof fissures, triggering a ancient stone collapse mechanism.</p>`,
        notes: [{ id: 'n-4', content: '<b>VFX Note:</b> Massive falling boulder dust particles.', color: '#3b82f6', timestamp }],
        breakdown: { sound: ['Grinding Gears', 'Rumbling Earth'], props: ['Bronze Lever'], costume: ['Harrison Dust Covered Coat'], vfx: ['Falling Rock FX'], practical: ['Floor Trap Mechanism'], cast: ['Harrison', 'Elena'], location: ['Chamber of Suns'] },
        versions: []
      },
      {
        id: 5, x: 1950, y: 160, title: '5. Escape into the Dawn', sceneNumber: '5',
        slug: { prefix: 'EXT', location: 'CLIFFSIDE WATERFALL', time: 'DAWN' },
        summary: 'Harrison and Elena burst through the waterfall cave exit, clutching the ancient sun medallion as the morning sun greets them.',
        color: '#10b981', tint: '#022c22', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. CLIFFSIDE WATERFALL - DAWN</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Plunging crystal water cascades over the cliff face. Harrison and Elena swim through the spray, emerging onto a sunlit riverbank.</p>`,
        notes: [{ id: 'n-5', content: '<b>Wide Shot:</b> Rainbow lens flare over crashing waterfall.', color: '#10b981', timestamp }],
        breakdown: { sound: ['Waterfall Roar', 'Laughter'], props: ['Sun Medallion'], costume: ['Wet Expedition Gear'], vfx: ['Rainbow Lens Flare'], practical: ['Real Waterfall Location'], cast: ['Harrison', 'Elena'], location: ['Amazon River Basin'] },
        versions: []
      }
    ];

    const annotations: Annotation[] = [
      { id: 201, type: 'text', x: 110, y: 320, w: 200, h: 90, text: 'MAP DISCOVERY\nWarm earth tones & torchlight atmosphere.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' },
      { id: 202, type: 'text', x: 1030, y: 320, w: 200, h: 90, text: 'VILLAIN CONFRONTATION\nTense dialogue duel between Sterling & Harrison.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' }
    ];

    const connections: Connection[] = [
      { from: 1, to: 2, boardId: targetBoardId }, { from: 2, to: 3, boardId: targetBoardId },
      { from: 3, to: 4, boardId: targetBoardId }, { from: 4, to: 5, boardId: targetBoardId }
    ];

    const characterData: Record<string, CharacterData> = {
      'DR. HARRISON': { id: 'c-har', name: 'DR. HARRISON', age: 42, gender: 'Male', ethnicity: 'Caucasian', hair: 'Brown messy hair', eyes: 'Hazel', build: 'Rugged', occupation: 'Archaeologist', archetype: 'The Adventurer', physiology: 'Scar on right cheek.', sociology: 'University professor turned seeker.', psychology: 'Obsessed with historical truth.', backstory: 'Spent 15 years searching for El Dorado.', images: [], relationships: [] },
      'ELENA': { id: 'c-ele', name: 'ELENA', age: 34, gender: 'Female', ethnicity: 'Hispanic', hair: 'Dark braided hair', eyes: 'Dark Brown', build: 'Athletic', occupation: 'Cartographer & Survivalist', archetype: 'The Sharp Strategist', physiology: 'Quick reflexes.', sociology: 'Freelance guide.', psychology: 'Pragmatic and fearless.', backstory: 'Grew up in the Andes.', images: [], relationships: [] },
      'LORD STERLING': { id: 'c-ste', name: 'LORD STERLING', age: 58, gender: 'Male', ethnicity: 'Caucasian', hair: 'Silver slicked', eyes: 'Grey', build: 'Slender aristocrat', occupation: 'Antiquities Collector', archetype: 'The Tyrant', physiology: 'Walks with silver-headed cane.', sociology: 'Billionaire aristocrat.', psychology: 'Ruthless greed.', backstory: 'Funds illegal digs worldwide.', images: [], relationships: [] }
    };

    const generatedShots: Shot[] = [
      { id: 'shot-1', scene: '1', shotSize: 'WIDE', angle: 'LOW ANGLE', lens: '24mm Prime', movement: 'Tilt Up', subject: 'Harrison scraping stone disc', description: 'Low angle shot looking up at ancient carved sun disc.', scriptReference: 'Look at these radial inscriptions...', sourceType: 'manual', durationSec: 5 },
      { id: 'shot-2', scene: '3', shotSize: 'CLOSE UP', angle: 'EYE LEVEL', lens: '85mm Anamorphic', movement: 'Static', subject: 'Lord Sterling cane tap', description: 'Close up on Sterling tapping silver cane as torch catches his eyes.', scriptReference: 'Hand over the sun medallion...', sourceType: 'manual', durationSec: 4 }
    ];

    return { groups, beats, annotations, connections, characterData, generatedShots };

  } else {
    // STORY 2: DEEP SPACE QUANTUM CRISIS (OR NOIR)
    const groups: Group[] = [
      { id: 101, title: 'ACT I — FOGGY PIER MURDER', x: 80, y: 100, width: 420, height: 520, color: '#64748b', boardId: targetBoardId },
      { id: 102, title: 'ACT IIA — SPEAKEASY INTERROGATION', x: 540, y: 100, width: 420, height: 520, color: '#d97706', boardId: targetBoardId },
      { id: 103, title: 'ACT IIB — THE RED VELVET BETRAYAL', x: 1000, y: 100, width: 420, height: 520, color: '#dc2626', boardId: targetBoardId },
      { id: 104, title: 'ACT III — MANSION VAULT STANDOFF', x: 1460, y: 100, width: 420, height: 520, color: '#7c3aed', boardId: targetBoardId },
      { id: 105, title: 'EPILOGUE — WATERFRONT DAWN', x: 1920, y: 100, width: 420, height: 520, color: '#059669', boardId: targetBoardId }
    ];

    const beats: Beat[] = [
      {
        id: 1, x: 110, y: 160, title: '1. Murder on Pier 14', sceneNumber: '1',
        slug: { prefix: 'EXT', location: 'WATERFRONT PIER 14', time: 'NIGHT' },
        summary: 'Detective Jack Malone examines a discarded silver cigarette case beside a puddle under a flickering streetlamp on Pier 14.',
        color: '#64748b', tint: '#1e293b', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. WATERFRONT PIER 14 - NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Thick ocean fog rolls over timber pilings. DETECTIVE JACK MALONE (40s, trench coat, fedora tilted low) flicks a match, lighting a lucky strike as rain drips from his brim.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">JACK MALONE (V.O.)</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">In this town, rain doesn't wash away secrets. It just makes them slicker.</p>`,
        notes: [{ id: 'n-n1', content: '<b>Style:</b> High-contrast monochrome lighting with amber streetlamp glow.', color: '#64748b', timestamp }],
        breakdown: { sound: ['Foghorn Echo', 'Distant Water Lapping'], props: ['Silver Cigarette Case', 'Zippo Lighter'], costume: ['Malone Trench Coat & Fedora'], vfx: ['Volumetric Ocean Fog'], practical: ['Wet Timber Planks'], cast: ['Jack Malone'], location: ['Pier 14 Docks'] },
        versions: []
      },
      {
        id: 2, x: 570, y: 160, title: '2. Speakeasy Shadow', sceneNumber: '2',
        slug: { prefix: 'INT', location: 'THE RED VELVET CLUB', time: 'NIGHT' },
        summary: 'Jack confronts Madame Rouge at her private booth behind the jazz stage, pressing her about the victim’s ledger.',
        color: '#d97706', tint: '#451a03', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. THE RED VELVET CLUB - NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Muffled saxophone jazz filters through smoky air. MADAME ROUGE (30s, silk gown, black veil) swirls a glass of red wine.</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">MADAME ROUGE</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">You're asking dangerous questions for a man with a wooden badge, Jack.</p>`,
        notes: [{ id: 'n-n2', content: '<b>Audio:</b> Soft muted trumpet jazz solo.', color: '#d97706', timestamp }],
        breakdown: { sound: ['Saxophone Jazz', 'Clinking Glasses'], props: ['Red Wine Glass', 'Leather Pocket Ledger'], costume: ['Silk Gown', 'Black Veil'], vfx: ['Tobacco Smoke Wisps'], practical: ['Dim Red Booth Velvet'], cast: ['Madame Rouge', 'Jack Malone'], location: ['Red Velvet Lounge'] },
        versions: []
      },
      {
        id: 3, x: 1030, y: 160, title: '3. The Gunshot in the Alley', sceneNumber: '3',
        slug: { prefix: 'EXT', location: 'SPEAKEASY BACK ALLEY', time: 'CONTINUOUS' },
        summary: 'A shadow steps out from behind a brick pillar and fires a revolver, grazing Jack’s shoulder as he ducks behind a dumpster.',
        color: '#dc2626', tint: '#450a0a', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. SPEAKEASY BACK ALLEY - CONTINUOUS</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">FLASH! A sharp gunshot crack shatters the night. Brick dust explodes near Jack’s head as he rolls onto wet cobblestones, unholstering his Snubnose .38.</p>`,
        notes: [{ id: 'n-n3', content: '<b>Action:</b> Fast muzzle flash illumination.', color: '#dc2626', timestamp }],
        breakdown: { sound: ['Muzzle Flash Gunshot', 'Brick Shatter'], props: ['Snubnose .38 Revolver'], costume: ['Jack Malone Trench Coat'], vfx: ['Muzzle Flash Smoke'], practical: ['Squib Brick Burst'], cast: ['Shadow Gunman', 'Jack Malone'], location: ['Back Alleyway'] },
        versions: []
      },
      {
        id: 4, x: 1490, y: 160, title: '4. Mansion Vault Trap', sceneNumber: '4',
        slug: { prefix: 'INT', location: 'CITY HALL SECRET VAULT', time: 'LATE NIGHT' },
        summary: 'Jack uncovers corrupt Mayor Sterling burning land deeds inside the steel vault, leading to a final standoff.',
        color: '#7c3aed', tint: '#2e1065', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">INT. CITY HALL SECRET VAULT - LATE NIGHT</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Charred paper ashes drift through the vault air. MAYOR STERLING drops his lighter into a brass incinerator drum.</p>`,
        notes: [{ id: 'n-n4', content: '<b>Lighting:</b> Orange fire glow dancing across vault steel.', color: '#7c3aed', timestamp }],
        breakdown: { sound: ['Fire Crackle', 'Steel Door Slam'], props: ['Brass Incinerator', 'Land Deeds'], costume: ['Mayor Tuxedo'], vfx: ['Floating Paper Ashes'], practical: ['Fire Box Table'], cast: ['Mayor Sterling', 'Jack Malone'], location: ['City Hall Vault'] },
        versions: []
      },
      {
        id: 5, x: 1950, y: 160, title: '5. Fog Lifts at Dawn', sceneNumber: '5',
        slug: { prefix: 'EXT', location: 'POLICE HEADQUARTERS STEPS', time: 'DAWN' },
        summary: 'Jack drops the surviving land deeds on the precinct chief’s desk as dawn light washes over the city streets.',
        color: '#059669', tint: '#022c22', status: 'ready', boardId: targetBoardId,
        content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">EXT. POLICE HEADQUARTERS STEPS - DAWN</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">Pale grey dawn breaks over granite steps. Jack walks down into the morning street, tossing his spent match into the gutter.</p>`,
        notes: [{ id: 'n-n5', content: '<b>Ending Voiceover:</b> Classic noir closing narration.', color: '#059669', timestamp }],
        breakdown: { sound: ['Distant Church Bell', 'Subtle Horn'], props: ['Evidence Manila Folder'], costume: ['Jack Malone Trench Coat'], vfx: ['Lifting Fog Layer'], practical: ['Granite Stairs'], cast: ['Jack Malone'], location: ['Precinct Steps'] },
        versions: []
      }
    ];

    const annotations: Annotation[] = [
      { id: 201, type: 'text', x: 110, y: 320, w: 200, h: 90, text: '1940s NOIR DETECTIVE\nShadowy film noir framing with voiceover narration.', fontSize: 12, boardId: targetBoardId, color: '#f5a623' }
    ];

    const connections: Connection[] = [
      { from: 1, to: 2, boardId: targetBoardId }, { from: 2, to: 3, boardId: targetBoardId },
      { from: 3, to: 4, boardId: targetBoardId }, { from: 4, to: 5, boardId: targetBoardId }
    ];

    const characterData: Record<string, CharacterData> = {
      'JACK MALONE': { id: 'c-jack', name: 'JACK MALONE', age: 41, gender: 'Male', ethnicity: 'Caucasian', hair: 'Slicked dark hair', eyes: 'Steely Grey', build: 'Weathered', occupation: 'Private Investigator', archetype: 'The Cynical Detective', physiology: 'Walks with slight limp.', sociology: 'Ex-homicide cop.', psychology: 'Moral code hidden under tough exterior.', backstory: 'Resigned from precinct 5 years ago.', images: [], relationships: [] },
      'MADAME ROUGE': { id: 'c-rouge', name: 'MADAME ROUGE', age: 35, gender: 'Female', ethnicity: 'French / Caucasian', hair: 'Dark wavy curls', eyes: 'Green', build: 'Glamorous', occupation: 'Speakeasy Owner', archetype: 'The Femme Fatale', physiology: 'Always carries cigarette holder.', sociology: 'Underworld figure.', psychology: 'Calculated and manipulative.', backstory: 'Ran clubs across Europe before coming here.', images: [], relationships: [] }
    };

    const generatedShots: Shot[] = [
      { id: 'shot-1', scene: '1', shotSize: 'CLOSE UP', angle: 'LOW ANGLE', lens: '50mm Prime', movement: 'Static', subject: 'Jack Malone match strike', description: 'Extreme close up on Jack Malone striking match under fedora brim in thick fog.', scriptReference: 'In this town, rain doesn\'t wash away secrets...', sourceType: 'manual', durationSec: 4 }
    ];

    return { groups, beats, annotations, connections, characterData, generatedShots };
  }
}

// ============================================================================
// 20-SCENE FEATURETTE: "THE BERLIN PROTOCOL: COLD WAR THRILLER"
// ============================================================================
export function createAuto20ScenesDataset(targetBoardId: number = 0) {
  const timestamp = Date.now();
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  const tints = ['#1e293b', '#2e1065', '#4d072b', '#451a03', '#022c22'];

  const actTitles = [
    'ACT I — DISAVOWED IN WEST BERLIN',
    'ACT IIA — CROSSING THE WALL',
    'ACT IIB — THE DOUBLE CROSS & MIDPOINT',
    'ACT III — THE BROADCAST & TOWER SIEGE',
    'EPILOGUE — DAWN OF THE FALL'
  ];

  const sceneDetails = [
    // Act I
    {
      title: '1. Checkpoint Dead Drop', loc: 'CHECKPOINT CHARLIE', time: 'NIGHT', type: 'EXT',
      sum: 'MI6 Agent Marcus Vane retrieves a concealed microfilm canister from a dead drop behind a rain-slicked guard tower.',
      speaker: 'MARCUS VANE', dialogue: 'The microfilm is cold. Stasi border guards are switching posts in four minutes.',
      action: 'Freezing rain glints on wet cobblestones. Marcus kneels silently, extracting the metallic cylinder from a hollowed brick.'
    },
    {
      title: '2. Kurfürstendamm Safehouse', loc: 'KURFÜRSTENDAMM APARTMENT', time: 'LATE NIGHT', type: 'INT',
      sum: 'Marcus projects the microfilm onto a cracked wall, revealing high-level nuclear deployment targets.',
      speaker: 'MARCUS VANE', dialogue: 'This isn\'t a military exercise. It\'s a false-flag launch protocol scheduled for Friday.',
      action: 'Dust dances in the projection beam. A silver reel whirs quietly on a wooden dining table.'
    },
    {
      title: '3. Café Kranzler Tail', loc: 'CAFÉ KRANZLER', time: 'DAY', type: 'INT',
      sum: 'Marcus spots two Stasi operatives in leather coats observing him through foggy coffee house windows.',
      speaker: 'HANS', dialogue: 'Don\'t turn around, Marcus. The man in the grey coat has a silent pistol under his newspaper.',
      action: 'Espresso steam rises. Marcus uses the reflective diner mirror to track the shadow movements.'
    },
    {
      title: '4. Tiergarten Alley Pursuit', loc: 'TIERGARTEN PARK', time: 'NIGHT', type: 'EXT',
      sum: 'A silent knife struggle ensues in the snow-drenched park before Marcus escapes on a vintage BMW motorcycle.',
      speaker: 'MARCUS VANE', dialogue: 'Tell Colonel Kraus his timeline just got moved up.',
      action: 'Engine revs echo across snowy trees as Marcus speeds into the darkness toward Sector East.'
    },

    // Act IIA
    {
      title: '5. U-Bahn Ghost Station', loc: 'BERLINER U-BAHN TUNNEL', time: 'NIGHT', type: 'INT',
      sum: 'Marcus crawls through rusted subway vents under the Berlin Wall to reach East Sector Friedrichshain.',
      speaker: 'MARCUS VANE', dialogue: 'Damp air, 600 volts on the third rail. Exactly where we want to be.',
      action: 'Water drips rhythmically onto corroded iron tracks. A distant train rumble vibrates the tunnel ceiling.'
    },
    {
      title: '6. Whistleblower Meeting', loc: 'ALEXANDERPLATZ SAFE ROOM', time: 'LATE NIGHT', type: 'INT',
      sum: 'Elena Petrova hand-delivers the missing cryptographic key needed to decipher the launch codes.',
      speaker: 'ELENA PETROVA', dialogue: 'They executed my brother yesterday, Marcus. If this key fails, let the world know.',
      action: 'Elena places a heavily stamped manila binder into Marcus\'s hands with trembling fingers.'
    },
    {
      title: '7. Stasi Wiretap Basement', loc: 'FRIEDRICHSHAIN BASEMENT', time: 'NIGHT', type: 'INT',
      sum: 'Marcus and Elena intercept Stasi radio transmissions confirming an imminent raid on their location.',
      speaker: 'ELENA PETROVA', dialogue: 'The signal is coming from inside this block! They\'ve tapped our line!',
      action: 'Sparks fly from a copper terminal array as Marcus cuts the power grid to the entire building.'
    },
    {
      title: '8. Spree River Crossing', loc: 'SPREE RIVER DOCKS', time: 'PRE-DAWN', type: 'EXT',
      sum: 'Marcus and Elena swim across the freezing Spree River while searchlights sweep the murky water.',
      speaker: 'MARCUS VANE', dialogue: 'Keep your head low! Searchlight beam sweeps every eight seconds!',
      action: 'Icy foam splash. Bright white searchlight arcs across the dark water surface, barely missing them.'
    },

    // Act IIB
    {
      title: '9. Grain Silo Interrogation', loc: 'ABANDONED GRAIN SILO', time: 'DAY', type: 'INT',
      sum: 'Marcus interrogates a captured Stasi informant to reveal Colonel Kraus\'s command bunker location.',
      speaker: 'MARCUS VANE', dialogue: 'Give me the frequency access code, or we leave you for your superiors.',
      action: 'Dust motes hang in dramatic shafts of morning sunlight piercing through rusted steel shutters.'
    },

    {
      title: '10. Tempelhof Hangar Ambush', loc: 'TEMPELHOF HANGAR 3', time: 'NIGHT', type: 'INT',
      sum: 'Colonel Kraus traps Marcus inside an aircraft hangar, opening fire with automatic weapons.',
      speaker: 'COLONEL KRAUS', dialogue: 'You\'re twenty years too late, Vane. The new order begins tonight.',
      action: 'Muzzle flashes illuminate the shadowy silhouettes of vintage cargo transport planes.'
    },
    {
      title: '11. Embassy Vault Penetration', loc: 'NEUTRAL EMBASSY VAULT', time: 'NIGHT', type: 'INT',
      sum: 'Elena bypasses an optical lock system to retrieve the physical broadcast override cassette.',
      speaker: 'ELENA PETROVA', dialogue: 'Laser bypass engaged. We have three minutes before the backup generator boots.',
      action: 'Green laser beams crisscross the marble vault floor as Elena meticulously steps through.'
    },
    {
      title: '12. Uncovering the Mole', loc: 'SAFE APARTMENT', time: 'LATE NIGHT', type: 'INT',
      sum: 'Marcus discovers an encoded radio dispatch proving his own MI6 superior is funding Kraus.',
      speaker: 'MARCUS VANE', dialogue: 'It was never a Soviet plot... London engineered this from the beginning.',
      action: 'Marcus drops the decrypted teletype paper onto the wooden desk in disbelief.'
    },

    // Act III
    {
      title: '13. Fernsehturm Spire Climb', loc: 'TV TOWER TRANSMITTER SPIRE', time: 'NIGHT', type: 'EXT',
      sum: 'Gale force winds whip Marcus as he climbs the exterior ladder of the 368-meter Berlin TV Tower.',
      speaker: 'MARCUS VANE', dialogue: 'Eighty knots of wind... hold on to the safety cable, Elena!',
      action: 'Red aviation beacon lights pulse against low storm clouds over the illuminated city.'
    },
    {
      title: '14. Control Deck Firefight', loc: 'TV TOWER CONTROL ROOM', time: 'NIGHT', type: 'INT',
      sum: 'Marcus and Elena breach the glass control room, engaging Kraus\'s inner guard squad.',
      speaker: 'ELENA PETROVA', dialogue: 'Covering fire! Patch the tape into the master transmitter now!',
      action: 'Shattered glass cascades onto control panels as gunshots echo across the dome.'
    },
    {
      title: '15. Global Live Broadcast', loc: 'TRANSMITTER DECK', time: 'LATE NIGHT', type: 'INT',
      sum: 'Marcus slams the tape into the reel drive, broadcasting the secret treaty audio to millions worldwide.',
      speaker: 'MARCUS VANE', dialogue: 'Attention all European frequencies... this is the voice of truth.',
      action: 'Red broadcast lights illuminate GREEN across all automated radio consoles.'
    },
    {
      title: '16. Colonel Kraus Standoff', loc: 'OBSERVATION DECK LEDGE', time: 'NIGHT', type: 'EXT',
      sum: 'Colonel Kraus confronts Marcus on the high-altitude observation balcony in a brutal fistfight.',
      speaker: 'COLONEL KRAUS', dialogue: 'You can\'t stop what has already been set in motion!',
      action: 'Kraus slips over the wet railing as Marcus lunges, catching his coat cuff in mid-air.'
    },

    // Epilogue
    {
      title: '17. Dawn at Brandenburg', loc: 'BRANDENBURG GATE PLAZA', time: 'DAWN', type: 'EXT',
      sum: 'Sirens wail in the distance as crowds gather at the gate, hearing the broadcast leak on car radios.',
      speaker: 'ELENA PETROVA', dialogue: 'Look at them, Marcus. The wall is going to come down.',
      action: 'Golden morning light breaks over the QUADRIGA statue as crowds cheer in the streets below.'
    },
    {
      title: '18. Teufelsberg Decommission', loc: 'TEUFELSBERG RADOME', time: 'DAY', type: 'EXT',
      sum: 'Marcus dismantles his tactical receiver unit atop the listening hill, casting away his spy gear.',
      speaker: 'MARCUS VANE', dialogue: 'Mission complete. Disavowing all active codes permanently.',
      action: 'The white radar dome stands quiet under a crisp autumn sky as Marcus walks away.'
    },
    {
      title: '19. Geneva UN Hand-off', loc: 'GENEVA DELEGATE SUITE', time: 'NIGHT', type: 'INT',
      sum: 'Elena hands original treaty documents to UN delegates, securing full diplomatic immunity.',
      speaker: 'ELENA PETROVA', dialogue: 'The truth is archived. History belongs to peace now.',
      action: 'Official wax seal pressed onto leather-bound UN dossier.'
    },
    {
      title: '20. Lake Geneva Sunset', loc: 'LAKE GENEVA SHORE', time: 'SUNSET', type: 'EXT',
      sum: 'Marcus and Elena stand on the quiet lakeshore, watching the sunset over serene blue water.',
      speaker: 'MARCUS VANE', dialogue: 'No more shadows, Elena. We made it home.',
      action: 'Warm orange sunset reflections ripple on lake waters as the film fades to black.'
    }
  ];

  const groups: Group[] = actTitles.map((title, actIdx) => ({
    id: 101 + actIdx,
    title,
    x: 80 + actIdx * 460,
    y: 100,
    width: 420,
    height: 800,
    color: colors[actIdx % colors.length],
    boardId: targetBoardId
  }));

  const beats: Beat[] = [];
  const connections: Connection[] = [];

  sceneDetails.forEach((sc, i) => {
    const sceneId = i + 1;
    const actIdx = Math.floor(i / 4);
    const sceneInAct = i % 4;
    const groupX = 80 + actIdx * 460;
    const x = groupX + 110;
    const y = 160 + sceneInAct * 170;

    beats.push({
      id: sceneId,
      x,
      y,
      title: sc.title,
      sceneNumber: `${sceneId}`,
      slug: { prefix: sc.type, location: sc.loc, time: sc.time },
      summary: sc.sum,
      color: colors[actIdx % colors.length],
      tint: tints[actIdx % tints.length],
      status: 'ready',
      boardId: targetBoardId,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">${sc.type}. ${sc.loc} - ${sc.time}</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">${sc.action}</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">${sc.speaker}</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">${sc.dialogue}</p>`,
      notes: [{ id: `note-${sceneId}-1`, content: `<b>Cinematic Beat ${sceneId}:</b> Key dramatic beats for ${sc.title}.`, color: colors[actIdx % colors.length], timestamp }],
      breakdown: {
        sound: ['Rain Patter', 'Footsteps on Cobblestone', 'Radio Chatter'],
        props: ['Microfilm Canister', 'Walther PPK', 'Cryptographic Ledger'],
        costume: ['Marcus Trench Coat', 'Elena Wool Scarf', 'Stasi Officer Uniform'],
        vfx: ['Searchlight Volumetric Beam', 'Atmospheric Fog'],
        practical: ['Wet Asphalt FX', 'Vintage BMW Motorcycle'],
        cast: ['MARCUS VANE', 'ELENA PETROVA', 'COLONEL KRAUS', 'HANS'],
        location: [sc.loc]
      },
      versions: []
    });

    if (i > 0) {
      connections.push({ from: i, to: sceneId, boardId: targetBoardId, style: 'zigzag' });
    }
  });

  const annotations: Annotation[] = [
    { id: 201, type: 'text', x: 80, y: 30, w: 450, h: 50, text: 'THE BERLIN PROTOCOL (20-SCENE COLD WAR ESPIONAGE THRILLER)', fontSize: 14, boardId: targetBoardId, color: '#f5a623' }
  ];

  const characterData: Record<string, CharacterData> = {
    'MARCUS VANE': {
      id: 'c-marcus', name: 'MARCUS VANE', age: 42, gender: 'Male', ethnicity: 'British / Caucasian', hair: 'Slicked dark brown', eyes: 'Steely Grey', build: 'Athletic, tactical', occupation: 'MI6 Senior Operative', archetype: 'The Disavowed Spy', physiology: 'Scar along left jawline.', sociology: 'Covert diplomatic operative.', psychology: 'Calculated, unflinching under pressure.', backstory: 'Operated in Berlin since 1972.', images: [], relationships: [{ target: 'ELENA PETROVA', type: 'Ally', description: 'KGB Whistleblower.' }]
    },
    'ELENA PETROVA': {
      id: 'c-elena', name: 'ELENA PETROVA', age: 36, gender: 'Female', ethnicity: 'Eastern European', hair: 'Dark wavy hair in bun', eyes: 'Amber', build: 'Slender', occupation: 'KGB Cryptographer', archetype: 'The Brave Whistleblower', physiology: 'Calm hands under interrogation.', sociology: 'Former Soviet Signals Officer.', psychology: 'Driven by desire for peace.', backstory: 'Smuggled nuclear codes out of East Berlin.', images: [], relationships: []
    },
    'COLONEL KRAUS': {
      id: 'c-kraus', name: 'COLONEL KRAUS', age: 55, gender: 'Male', ethnicity: 'German / Caucasian', hair: 'Silver cropped hair', eyes: 'Cold Blue', build: 'Imposing', occupation: 'Stasi Intelligence Chief', archetype: 'The Tyrannical Mastermind', physiology: 'Stiff, militaristic posture.', sociology: 'High East German Command.', psychology: 'Obsessed with total surveillance control.', backstory: 'Architect of the Berlin wiretap network.', images: [], relationships: []
    },
    'HANS': {
      id: 'c-hans', name: 'HANS', age: 48, gender: 'Male', ethnicity: 'German / Caucasian', hair: 'Grey stubble', eyes: 'Brown', build: 'Stocky', occupation: 'Underground Safehouse Keeper', archetype: 'The Faithful Informant', physiology: 'Walks with slight limp.', sociology: 'West Berlin fixer.', psychology: 'Resourceful, cautious.', backstory: 'Runs safehouses across Kreuzberg.', images: [], relationships: []
    }
  };

  const generatedShots: Shot[] = [
    { id: 'shot-1', scene: '1', shotSize: 'WIDE', angle: 'LOW ANGLE', lens: '28mm Anamorphic', movement: 'Tracking', subject: 'Checkpoint dead drop', description: 'Low tracking shot along wet cobblestones as Marcus retrieves the microfilm canister.', scriptReference: 'Freezing rain glints on wet cobblestones...', sourceType: 'manual', durationSec: 5 }
  ];

  return { groups, beats, annotations, connections, characterData, generatedShots };
}

// ============================================================================
// 50-SCENE EPIC FEATURE: "CHRONOS INCIDENT: DEEP TIME EXPEDITION"
// ============================================================================
export function createAuto50ScenesDataset(targetBoardId: number = 0) {
  const timestamp = Date.now();
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#f43f5e', '#84cc16'];
  const tints = ['#1e293b', '#2e1065', '#4d072b', '#451a03', '#022c22', '#083344', '#1e1b4b', '#3b0764', '#4c0519', '#1a2e05'];

  const actTitles50 = [
    'ACT 1 — PROLOGUE: ATMOSPHERIC COLLAPSE',
    'ACT 2 — SURVIVAL IN THE QUARTZ CANYON',
    'ACT 3 — DESCENT INTO THE CRYSTALLINE VAULT',
    'ACT 4 — FRACTURES & THE SEISMIC STORM',
    'ACT 5 — THE TEMPORAL REACTOR CORE',
    'ACT 6 — MIDPOINT: THE CHRONOS ANOMALY',
    'ACT 7 — SACRIFICE ON THE GLASS DESERT',
    'ACT 8 — SIEGE AT SPIRE ZERO',
    'ACT 9 — THE CLIMAX: QUANTUM UPLINK',
    'ACT 10 — EPILOGUE: DAWN OF KEPLER'
  ];

  const characterData: Record<string, CharacterData> = {
    'COMMANDER SARAH CHEN': {
      id: 'c-sarah', name: 'COMMANDER SARAH CHEN', age: 44, gender: 'Female', ethnicity: 'East Asian / American', hair: 'Dark hair tied in flight knot', eyes: 'Brown', build: 'Athletic, resilient', occupation: 'Quantum Astrophysicist & Expedition Commander', archetype: 'The Visionary Leader', physiology: 'Calm under extreme zero-g conditions.', sociology: 'NASA / IKAROS Deep Space Command.', psychology: 'Driven by scientific discovery and crew safety.', backstory: 'Pioneered quantum rift physics.', images: [], relationships: [{ target: 'DR. ARLO VANE', type: 'Colleague', description: 'Chief Engineer.' }]
    },
    'DR. ARLO VANE': {
      id: 'c-arlo', name: 'DR. ARLO VANE', age: 50, gender: 'Male', ethnicity: 'Caucasian', hair: 'Silver streak hair', eyes: 'Steel Blue', build: 'Broad shoulders', occupation: 'Chief Systems Architect', archetype: 'The Pragmatic Engineer', physiology: 'Cybernetic HUD monocular lens.', sociology: 'Genesis Aerospace Lead.', psychology: 'Methodical, deeply logical.', backstory: 'Designed the IKAROS temporal reactor.', images: [], relationships: []
    },
    'CAPTAIN MARCUS REYES': {
      id: 'c-reyes', name: 'CAPTAIN MARCUS REYES', age: 38, gender: 'Male', ethnicity: 'Hispanic / Latino', hair: 'Short cropped dark hair', eyes: 'Dark Brown', build: 'Stocky, muscular', occupation: 'Tactical Pilot & Combat Specialist', archetype: 'The Guardian Specialist', physiology: 'Exo-suit neural interface implants.', sociology: 'Interstellar Flight Corps.', psychology: 'Fiercely protective of the team.', backstory: 'Flew 20 orbital defense missions.', images: [], relationships: []
    },
    'DR. LENA VOSS': {
      id: 'c-voss', name: 'DR. LENA VOSS', age: 32, gender: 'Female', ethnicity: 'European / Mixed', hair: 'Auburn braid', eyes: 'Green', build: 'Slender', occupation: 'Exobiologist & Geologist', archetype: 'The Curious Explorer', physiology: 'Quick, perceptive reflexes.', sociology: 'Deep Space Botanical Survey.', psychology: 'Enthusiastic seeker of alien life.', backstory: 'Discovered bioluminescent flora on Kepler.', images: [], relationships: []
    }
  };

  const fiftyScenesList = [
    // Act 1
    { t: '1. Ikaros Launch Emergency', loc: 'IKAROS FLIGHT DECK', time: 'ZERO-G', type: 'INT', sum: 'Commander Sarah Chen monitors a massive temporal gravity rift engulfing the Ikaros research vessel during launch.', spk: 'SARAH CHEN', dia: 'All thrusters to maximum reverse! The gravimetric gradient is tearing the hull apart!', act: 'Alert sirens blare red across glowing holographic navigation consoles.' },
    { t: '2. Atmospheric Entry Descent', loc: 'KEPLER-186F UPPER ATMOSPHERE', time: 'DAY', type: 'EXT', sum: 'The damaged escape shuttle plummets through fiery purple cloud formations toward Kepler-186f.', spk: 'MARCUS REYES', dia: 'Brace for impact! Heat shields are at ninety-two percent and dropping!', act: 'Atmospheric reentry plasma streams wildly past cockpit viewport glass.' },
    { t: '3. Quartz Canyon Crashsite', loc: 'QUARTZ CANYON FLOOR', time: 'DAY', type: 'EXT', sum: 'Sarah and Arlo crawl out of the smoking shuttle wreckage onto glowing crystal quartz terrain.', spk: 'ARLO VANE', dia: 'Atmosphere is breathable... but the magnetic field is spinning backwards.', act: 'Thick smoke drifts over giant purple quartz pillars standing like ancient spears.' },
    { t: '4. Assessing Life Support', loc: 'POD WRECKAGE', time: 'DUSK', type: 'INT', sum: 'Lena Voss checks damaged oxygen reserves and confirms emergency power cells are at twenty percent.', spk: 'LENA VOSS', dia: 'We have thirty-six hours of suit power unless we locate a local energy source.', act: 'Sparks crackle from broken power conduits as Lena attaches diagnostic gauges.' },
    { t: '5. The First Beacon Signal', loc: 'CANYON OVERLOOK', time: 'NIGHT', type: 'EXT', sum: 'A mysterious pulsing blue light beacon illuminates the distant mountain ridge in the alien night.', spk: 'SARAH CHEN', dia: 'That pulse is non-natural. Something on this planet is generating a directed quantum signal.', act: 'Dual moons rise over jagged crystalline mountains in the night sky.' },

    // Act 2
    { t: '6. Bioluminescent Storm', loc: 'CRYSTAL VALLEY', time: 'NIGHT', type: 'EXT', sum: 'The crew takes shelter inside a cave as a glowing electric spore storm rolls across the valley.', spk: 'MARCUS REYES', dia: 'Get inside! Those lightning strikes carry over ten million volts of static charge!', act: 'Electric blue arcs dance across quartz formations with thunderous booms.' },
    { t: '7. Monolith Discovery', loc: 'SUBTERRANEAN CAVERN ENTRY', time: 'NIGHT', type: 'INT', sum: 'Sarah uncovers a towering alien monolith covered in glowing mathematical geometric glyphs.', spk: 'SARAH CHEN', dia: 'These equations... they aren\'t language. They are orbital trajectory formulas for Earth.', act: 'Dust motes glow brightly as Sarah runs her gloved hand over carved stone runes.' },
    { t: '8. Energy Scanner Spike', loc: 'CAVERN TRENCH', time: 'LATE NIGHT', type: 'INT', sum: 'Arlo\'s scanner detects a massive subterranean power core operating directly beneath their feet.', spk: 'ARLO VANE', dia: 'The power reading is off the scale! It\'s a zero-point temporal generator!', act: 'Cyan energy hum vibrates through the cavern rock beneath their boots.' },
    { t: '9. Ancient Defense Drone', loc: 'ANCIENT RUNIC GATEWAY', time: 'NIGHT', type: 'INT', sum: 'An automated floating stone guardian awakens, scanning the crew with golden laser beams.', spk: 'MARCUS REYES', dia: 'Hold your positions! Do not raise weapons until I analyze its targeting array!', act: 'A golden ring of light hovers in mid-air, humming with ancient acoustic harmonic frequencies.' },
    { t: '10. Gateway Unlocked', loc: 'VAULT ENTRANCE', time: 'PRE-DAWN', type: 'INT', sum: 'Lena aligns three rotary stone rings, causing the massive cavern doors to slide open.', spk: 'LENA VOSS', dia: 'The sequence worked! The gateway is opening!', act: 'Heavy stone slabs grind back with a deep bass rumble, releasing mist.' },

    // Act 3
    { t: '11. The Crystalline Vault', loc: 'CRYSTALLINE VAULT CORE', time: 'DAY', type: 'INT', sum: 'The team descends into a cavernous hall filled with giant levitating quartz crystals.', spk: 'SARAH CHEN', dia: 'This entire cavern is a quantum storage array built millions of years ago.', act: 'Massive violet crystals float weightlessly in zero-G energy wells.' },
    { t: '12. Deciphering Chronos', loc: 'HOLOGRAM CHAMBER', time: 'DAY', type: 'INT', sum: 'Holographic star maps project into the air, revealing Kepler-186f as an artificial time anchor.', spk: 'ARLO VANE', dia: 'It\'s not a planet... it\'s an interstellar lighthouse keeping time stable.', act: 'Golden holographic orbits swirl around the crew in mid-air.' },
    { t: '13. Power Cell Depletion', loc: 'LOWER VAULT CORRIDOR', time: 'DAY', type: 'INT', sum: 'Reyes\'s suit battery fails, forcing Arlo to reroute power from the main comms receiver.', spk: 'MARCUS REYES', dia: 'Suit oxygen down to five percent! Reroute the secondary cell now!', act: 'Sparks fly as Arlo hotwires suit power connectors with insulated pliers.' },
    { t: '14. The Temporal Echo', loc: 'ECHO CHAMBER', time: 'AFTERNOON', type: 'INT', sum: 'Sarah witnesses a ghostly temporal projection of herself from ten years in the future.', spk: 'SARAH CHEN', dia: 'I saw myself... standing on Earth. We do make it back, Marcus!', act: 'Translucent blue temporal wave sweeps across the chamber floor.' },
    { t: '15. Cavern Structural Shift', loc: 'UPPER VAULT BRIDGE', time: 'DUSK', type: 'INT', sum: 'A seismic tremor shakes the vault, snapping stone suspension pillars over a deep abyss.', spk: 'LENA VOSS', dia: 'Jump! The bridge is collapsing!', act: 'Rock fragments plunge into glowing cyan liquid below as the crew leaps.' },

    // Act 4
    { t: '16. Seismic Surface Storm', loc: 'SURFACE GLASS RIDGE', time: 'NIGHT', type: 'EXT', sum: 'Razor-sharp glass shards blow across the ridge during a fierce seismic gale.', spk: 'MARCUS REYES', dia: 'Keep your visors down! These glass shards will pierce reinforced suit composite!', act: 'Whistling wind drives glittering glass sand across dark basalt rocks.' },
    { t: '17. Division in Command', loc: 'RIDGE SHELTER', time: 'NIGHT', type: 'INT', sum: 'Arlo demands they use remaining power to build an escape beacon, but Sarah prioritizes fixing the core.', spk: 'ARLO VANE', dia: 'If we don\'t send the beacon now, no rescue ship will ever find us!', act: 'Tense faces illuminated by harsh yellow emergency lantern light.' },
    { t: '18. Scouting the Spire', loc: 'SPIRE ZERO FOOTHILLS', time: 'LATE NIGHT', type: 'EXT', sum: 'Reyes and Lena scout the base of a 2,000-meter crystal spire rising into the storm.', spk: 'LENA VOSS', dia: 'The primary broadcast array is at the very peak of that spire.', act: 'Lightning strikes the apex of the monolithic black crystal tower.' },
    { t: '19. Defense Swarm Attack', loc: 'SPIRE BASE RUNWAY', time: 'NIGHT', type: 'EXT', sum: 'A swarm of robotic airborne drones ambushes Reyes and Lena at the spire base.', spk: 'MARCUS REYES', dia: 'Emp charge ready! Cover your eyes!', act: 'Blinding white EMP detonation pulse disables four incoming drones in mid-flight.' },
    { t: '20. Spire Elevator Ascent', loc: 'SPIRE INTERIOR ELEVATOR', time: 'PRE-DAWN', type: 'INT', sum: 'The crew reunites inside a high-speed crystal elevator ascending the interior of the spire.', spk: 'SARAH CHEN', dia: 'Speed is 200 meters per second. We reach the core level in thirty seconds.', act: 'Smooth glass walls slide past as blue lights cascade downward.' },

    // Act 5
    { t: '21. The Core Chamber', loc: 'TEMPORAL CORE CHAMBER', time: 'DAY', type: 'INT', sum: 'The crew enters a massive spherical chamber centering a swirling singularity of liquid time.', spk: 'ARLO VANE', dia: 'Behold the Chronos Engine... absolute mastery over spacetime metrics.', act: 'A roaring sphere of golden fluid hovers without support in the center of the room.' },
    { t: '22. Aligning the Emitters', loc: 'CORE CONTROL PLATFORM', time: 'DAY', type: 'INT', sum: 'Sarah manually aligns four heavy magnetic containment rings around the singularity.', spk: 'SARAH CHEN', dia: 'Ring one aligned. Ring two holding at forty thousand Tesla!', act: 'Heavy metal arc rings rotate with deep resonant magnetic hums.' },
    { t: '23. Containment Leak', loc: 'LOWER CONTROL DECK', time: 'DAY', type: 'INT', sum: 'Liquid temporal plasma leaks onto the deck, aging metal structures in seconds.', spk: 'LENA VOSS', dia: 'Don\'t touch the runoff! It\'s accelerating entropy on organic matter!', act: 'A steel wrench drops onto the floor runoff and instantly rusts into dust.' },
    { t: '24. Reyes\'s Heroic Hold', loc: 'VENTILATION ACCESS', time: 'AFTERNOON', type: 'INT', sum: 'Reyes holds open a heavy pressure door with his exo-suit to let the crew pass.', spk: 'MARCUS REYES', dia: 'Get to the transmitter console! I\'ll hold this bulkhead open!', act: 'Hydraulic pistons groan under immense strain as Reyes braces his exo-arms.' },
    { t: '25. Midpoint Ignition', loc: 'TRANSMITTER MATRIX', time: 'DUSK', type: 'INT', sum: 'Sarah keys in the final activation sequence, sending a temporal shockwave across the planet.', spk: 'SARAH CHEN', dia: 'Signal initialized! Broadcast stream is live across all timelines!', act: 'Blinding golden light bursts outward from the spire apex into space.' },

    // Act 6
    { t: '26. The Time Loop Anomaly', loc: 'SPIRE OBSERVATION DECK', time: 'NIGHT', type: 'INT', sum: 'The crew realizes time is looping every twelve minutes due to the singularity instability.', spk: 'ARLO VANE', dia: 'Look at the timer... we are repeating the last twelve minutes! We have to break the loop!', act: 'Digital suit clocks count down backwards from 12:00 to 00:00.' },
    { t: '27. Uncovering the Secret Protocol', loc: 'ARLO\'S DATA TERMINAL', time: 'LATE NIGHT', type: 'INT', sum: 'Sarah discovers Arlo was instructed by corporate back home to secure the Chronos engine at all costs.', spk: 'SARAH CHEN', dia: 'You knew about this planet before we even launched Ikaros, didn\'t you Arlo?', act: 'Sarah holds a glowing data drive with Genesis corporate seals.' },
    { t: '28. The Core Stabilizer Standoff', loc: 'CORE BRIDGE', time: 'NIGHT', type: 'INT', sum: 'Arlo points a plasma torch at the stabilizer, torn between corporate orders and saving his friends.', spk: 'ARLO VANE', dia: 'If I shut it down, humanity gains time control... but we die here!', act: 'Arlo\'s hands shake as the golden singularity flares dangerously.' },
    { t: '29. Lena\'s Breakthrough', loc: 'AUXILIARY LAB', time: 'NIGHT', type: 'INT', sum: 'Lena calculates that reversing the polarity will stabilize the loop without destroying the crew.', spk: 'LENA VOSS', dia: 'We don\'t have to choose between escape and science! Reverse the quantum field!', act: 'Holographic schematic flips 180 degrees in blue light.' },
    { t: '30. Loop Resolution', loc: 'CORE PLATFORM', time: 'PRE-DAWN', type: 'INT', sum: 'Sarah and Arlo jointly press the polarity buttons, collapsing the time loop into a stable beam.', spk: 'SARAH CHEN', dia: 'Time loop collapsed! We are back on linear progression!', act: 'Suit clocks stabilize and begin counting forward normally.' },

    // Act 7
    { t: '31. Trek Across Glass Desert', loc: 'THE GLASS WASTES', time: 'DAY', type: 'EXT', sum: 'The crew treks across a vast glittering glass desert toward the long-range rescue antenna.', spk: 'MARCUS REYES', dia: 'Sun is rising. Surface temperature will hit sixty degrees Celsius in twenty minutes.', act: 'Heat shimmers rise off smooth black obsidian glass plains.' },
    { t: '32. Solar Flare Emergency', loc: 'OBSIDIAN OUTCROP', time: 'DAY', type: 'EXT', sum: 'A massive solar flare erupts in the sky, forcing the crew to crouch beneath a reflective shield.', spk: 'SARAH CHEN', dia: 'Deploy radiation tarp! Interlock suit shields now!', act: 'Blinding white solar radiation washes across the desert landscape.' },
    { t: '33. Arlo\'s Redemption', loc: 'ANTENNA POWER JUNCTION', time: 'AFTERNOON', type: 'EXT', sum: 'Arlo sacrifices his suit\'s primary power unit to reboot the antenna\'s fried transformer.', spk: 'ARLO VANE', dia: 'My suit has backup oxygen. This antenna needs the voltage more than I do.', act: 'Arlo plugs his core battery directly into the massive antenna junction box.' },
    { t: '34. Rescue Signal Transmission', loc: 'ANTENNA DISH APEX', time: 'DUSK', type: 'EXT', sum: 'The massive 100-meter dish rotates toward Earth, beaming the distress signal into deep space.', spk: 'SARAH CHEN', dia: 'Distress code IKAROS-ONE transmitted! Rescue ship response time is four hours!', act: 'Massive steel dish hums as a blue laser beam fires straight into the starry sky.' },
    { t: '35. Nightfall Holdout', loc: 'ANTENNA BASE CAMP', time: 'NIGHT', type: 'EXT', sum: 'The crew huddles around a warm thermal heater, sharing memories of home as rescue approaches.', spk: 'LENA VOSS', dia: 'When we get back to Earth... I\'m never looking at a piece of quartz again.', act: 'Soft laughter under a breathtaking double-galaxy night sky.' },

    // Act 8
    { t: '36. Defense Swarm Final Wave', loc: 'ANTENNA PERIMETER', time: 'NIGHT', type: 'EXT', sum: 'Hundreds of automated guardian drones converge on the antenna site to destroy the signal.', spk: 'MARCUS REYES', dia: 'Defensive line! Form up behind the solar panels!', act: 'Golden laser fire crisscrosses the dark night sky in a intense barrage.' },
    { t: '37. Overclocking the Generator', loc: 'JUNCTION ROOM', time: 'LATE NIGHT', type: 'INT', sum: 'Lena and Arlo overload the planetary grid to create a massive EMP wave.', spk: 'ARLO VANE', dia: 'Overclocking to two hundred percent! Get ready to trigger the pulse!', act: 'Gauges slam into red warning zones as transformers whine shrilly.' },
    { t: '38. The EMP Blast', loc: 'ANTENNA TOWER TOP', time: 'NIGHT', type: 'EXT', sum: 'A massive shockwave of blue electromagnetic energy sweeps across the sky, dropping all drones.', spk: 'MARCUS REYES', dia: 'It worked! Every drone in five miles just crashed!', act: 'Raining metal drone debris falls onto the glass sand below.' },
    { t: '39. Re-establishing the Link', loc: 'CONTROL SHACK', time: 'LATE NIGHT', type: 'INT', sum: 'Sarah re-tunes the frequency selector to confirm the Earth rescue vessel has received the signal.', spk: 'SARAH CHEN', dia: 'Earth vessel Vanguard confirms receipt! They are entering orbit in thirty minutes!', act: 'Radio speaker crackles to life with a clear human voice: "Vanguard to Ikaros team, we see you!"' },
    { t: '40. Preparation for Extraction', loc: 'LANDING PLATEAU', time: 'PRE-DAWN', type: 'EXT', sum: 'The crew packs up sample containers and prepares the LZ landing beacon for the rescue shuttle.', spk: 'LENA VOSS', dia: 'Core samples secured. These quartz structures will rewrite physics textbooks.', act: 'Beacon flares ignite in a crisp triangle on the flat basalt rock.' },

    // Act 9
    { t: '41. Rescue Dropship Approach', loc: 'KEPLER SKYLINE', time: 'DAWN', type: 'EXT', sum: 'A massive sleek Earth rescue dropship breaks through the clouds, thrusters glowing orange.', spk: 'MARCUS REYES', dia: 'There she is! Vanguard Dropship One coming in on vector zero-nine!', act: 'Heavy thruster wash blows dust and sand away as the craft lowers landing gear.' },
    { t: '42. Final Planetary Inspection', loc: 'SPIRE ZERO LOOKOUT', time: 'DAWN', type: 'EXT', sum: 'Sarah stands at the edge of the plateau, taking a final look at the pristine alien horizon.', spk: 'SARAH CHEN', dia: 'We didn\'t just survive Kepler... we opened a door to humanity\'s future.', act: 'Golden morning light illuminates the vast crystal spire array below.' },
    { t: '43. Boarding the Dropship', loc: 'DROPSHIP CARGO RAMP', time: 'DAWN', type: 'INT', sum: 'Reyes, Lena, Arlo, and Sarah walk up the ramp into the warm white interior of the dropship.', spk: 'RESCUE PILOT', dia: 'Welcome aboard, Ikaros crew. Medical team is standing by.', act: 'Cargo door slowly seals closed, locking out the alien atmosphere.' },
    { t: '44. Liftoff from Kepler', loc: 'KEPLER ORBIT', time: 'DAY', type: 'EXT', sum: 'The Vanguard dropship ascends smoothly into orbit, leaving the purple planet Kepler-186f behind.', spk: 'SARAH CHEN', dia: 'Plot course for Earth. It\'s time to go home.', act: 'Kepler-186f shrinks into a beautiful blue and violet marble in the dark of space.' },
    { t: '45. De-briefing in Orbit', loc: 'VANGUARD MEDICAL BAY', time: 'DAY', type: 'INT', sum: 'The crew sits together in thermal blankets, sipping warm coffee as medical telemetry scans them.', spk: 'ARLO VANE', dia: 'I\'m submitting my full report... backing Sarah\'s vision for ethical space exploration.', act: 'Steam rises from coffee mugs in zero-g.' },

    // Act 10
    { t: '46. Approaching Earth Orbit', loc: 'EARTH ORBITAL STATION ARTEMIS', time: 'DAY', type: 'EXT', sum: 'The Vanguard docks with the massive blue and white Earth Orbital Station high above the Pacific Ocean.', spk: 'MARCUS REYES', dia: 'Look at that blue marble... never looked so beautiful.', act: 'Earth fills the viewport with swirling white clouds and deep azure oceans.' },
    { t: '47. The World Press Conference', loc: 'GENEVA SPACE AGENCY AUDITORIUM', time: 'DAY', type: 'INT', sum: 'Commander Sarah Chen addresses thousands of journalists, unveiling the Chronos discovery live.', spk: 'SARAH CHEN', dia: 'Humanity is no longer bound by distance or time. Today, our journey truly begins.', act: 'Cameras flash continuously as Sarah gestures to glowing holographic star maps.' },
    { t: '48. Arlo\'s Reconcilation', loc: 'AGENCY GARDEN', time: 'SUNSET', type: 'EXT', sum: 'Arlo hands Sarah his original research logs, permanently dedicating the patents to public domain.', spk: 'ARLO VANE', dia: 'No corporate ownership. This science belongs to every child who looks up at the stars.', act: 'Golden sunset over Lake Geneva with snow-capped mountains in the background.' },
    { t: '49. The Memorial Wall', loc: 'IKAROS MEMORIAL PLAZA', time: 'DUSK', type: 'EXT', sum: 'The team places a crystal sample at the base of the memorial statue honoring fallen pioneers.', spk: 'LENA VOSS', dia: 'For everyone who dared to venture into the dark.', act: 'A quiet flame burns gently inside a protective glass cylinder.' },
    { t: '50. A New Horizon for Humanity', loc: 'CAPECOST LAUNCH COMPLEX', time: 'NIGHT', type: 'EXT', sum: 'Sarah, Marcus, Lena, and Arlo watch a new fleet of interstellar ships lift off toward the stars.', spk: 'SARAH CHEN', dia: 'The universe is waiting. And we are ready.', act: 'Rocket exhausts ignite the night sky in brilliant golden arcs as the screen fades to black.' }
  ];

  const groups: Group[] = [];
  for (let actIdx = 0; actIdx < 10; actIdx++) {
    const row = Math.floor(actIdx / 5);
    const col = actIdx % 5;
    groups.push({
      id: 101 + actIdx,
      title: actTitles50[actIdx],
      x: 80 + col * 460,
      y: 100 + row * 980,
      width: 420,
      height: 940,
      color: colors[actIdx % colors.length],
      boardId: targetBoardId
    });
  }

  const beats: Beat[] = [];
  const connections: Connection[] = [];

  fiftyScenesList.forEach((sc, i) => {
    const sceneId = i + 1;
    const actIdx = Math.floor(i / 5);
    const sceneInAct = i % 5;
    const row = Math.floor(actIdx / 5);
    const col = actIdx % 5;

    const groupX = 80 + col * 460;
    const groupY = 100 + row * 980;

    const x = groupX + 110;
    const y = groupY + 60 + sceneInAct * 170;

    beats.push({
      id: sceneId,
      x,
      y,
      title: `${sceneId}. ${sc.t}`,
      sceneNumber: `${sceneId}`,
      slug: { prefix: sc.type, location: sc.loc, time: sc.time },
      summary: sc.sum,
      color: colors[actIdx % colors.length],
      tint: tints[actIdx % tints.length],
      status: 'ready',
      boardId: targetBoardId,
      content: `<p class="sc-slugline" style="font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; color: #f5a623;">${sc.type}. ${sc.loc} - ${sc.time}</p>
<p class="sc-action" style="margin-bottom: 0.5rem;">${sc.act}</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">${sc.spk}</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">${sc.dia}</p>`,
      notes: [{ id: `note-${sceneId}-1`, content: `<b>Scene ${sceneId} Note:</b> Narrative rhythm check for ${sc.t}.`, color: colors[actIdx % colors.length], timestamp }],
      breakdown: {
        sound: ['Thruster Hum', 'Quartz Resonant Vibration', 'Atmospheric Wind'],
        props: ['Quantum Scanner', 'Laser Emitter', 'Exo-suit Battery Pack'],
        costume: ['Ikaros Flight Suit', 'Exo-Armor Rig', 'Medical Uniform'],
        vfx: ['Holographic Glyph Overlay', 'Plasma Arc FX', 'Anamorphic Lens Flare'],
        practical: ['Stage Fog Machine', 'Interactive Quartz LEDs'],
        cast: ['COMMANDER SARAH CHEN', 'DR. ARLO VANE', 'CAPTAIN MARCUS REYES', 'DR. LENA VOSS'],
        location: [sc.loc]
      },
      versions: []
    });

    if (i > 0) {
      connections.push({ from: i, to: sceneId, boardId: targetBoardId, style: 'zigzag' });
    }
  });

  const annotations: Annotation[] = [
    { id: 201, type: 'text', x: 80, y: 30, w: 500, h: 50, text: 'CHRONOS INCIDENT: DEEP TIME EXPEDITION (50-SCENE FULL FEATURE SCREENPLAY)', fontSize: 16, boardId: targetBoardId, color: '#f5a623' }
  ];

  const generatedShots: Shot[] = [
    { id: 'shot-1', scene: '1', shotSize: 'EXTREME WIDE', angle: 'HIGH ANGLE', lens: '24mm', movement: 'Crane Down', subject: 'Ikaros launch emergency', description: 'Opening cinematic shot sweeping across the Ikaros flight deck during atmospheric collapse.', scriptReference: 'All thrusters to maximum reverse...', sourceType: 'manual', durationSec: 6 }
  ];

  return { groups, beats, annotations, connections, characterData, generatedShots };
}

// Master AI Auto Generator router
export function createAutoScenesDataset(sceneCount: 5 | 20 | 50 = 5, targetBoardId: number = 0) {
  if (sceneCount === 5) {
    return createAuto5ScenesDataset(targetBoardId);
  } else if (sceneCount === 20) {
    return createAuto20ScenesDataset(targetBoardId);
  } else {
    return createAuto50ScenesDataset(targetBoardId);
  }
}
