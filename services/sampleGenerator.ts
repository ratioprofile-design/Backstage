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
// 20-SCENE FEATURETTE: "பேரழிவு: சுந்தரத்தின் மகள்" (TAMIL DISASTER SCREENPLAY)
// ============================================================================
export function createAuto20ScenesDataset(targetBoardId: number = 0) {
  const timestamp = Date.now();
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  const tints = ['#1e293b', '#2e1065', '#4d072b', '#451a03', '#022c22'];

  const actTitles = [
    'காண்டம் 1 — சென்னை கடற்கரை சீற்றம் (CHENNAI STORM SURGE)',
    'காண்டம் 2A — காவேரி படுகை வெள்ளம் (CAUVERY DELTA FLOODS)',
    'காண்டம் 2B — தஞ்சை & திருச்சி பயணம் (THANJAVUR & TRICHY RESCUE)',
    'காண்டம் 3 — மதுரை & தாமிரபரணி பாய்வு (MADURAI & TIRUNELVELI CROSSING)',
    'முடிவுரை — கன்னியாகுமரி அணை மீட்பு (KANYAKUMARI DAM RESCUE)'
  ];

  const sceneDetails = [
    // Act I - Chennai
    {
      title: '1. மெரினா கடற்கரை புயல் எச்சரிக்கை', loc: 'சென்னை - மெரினா கடற்கரை', time: 'பகல்', type: 'EXT',
      sum: 'வங்கக்கடலில் உருவான அதிதீவிர மகா சூறாவளி சென்னையின் மெரினா கடற்கரையைத் தாக்குகிறது. 8 வயது சிறுமி அபிராமி தன் தாய் மலருடன் அவசர எச்சரிக்கை சங்கு முழக்கத்தைக் கேட்கிறாள்.',
      speaker: 'மலர்', dialogue: 'அபிராமி, பிடியைக் விடாதே! சூறாவளி எச்சரிக்கை சைரன் ஒலிக்குது! உடனே போகணும்!',
      action: 'கருமேகங்கள் வானத்தை மூட, ராட்சத அலைகள் கரையை நோக்கிச் சீறிப் பாய்கின்றன. அபிராமி தன் தந்தையின் பழைய பாக்கெட் கடிகாரத்தை இறுக்கமாகப் பற்றிக் கொள்கிறாள்.'
    },
    {
      title: '2. அடையாறு மேம்பால வெள்ளப்பெருக்கு', loc: 'சென்னை - அடையாறு மேம்பாலம்', time: 'இரவு', type: 'EXT',
      sum: 'மழைநீரும் கடல்நீரும் இணைந்து அடையாறு பாலத்தை மூழ்கடிக்கின்றன. மக்கள் கூட்டத்தில் அபிராமி தன் தாயைப் பிரிகிறாள், தந்தையைத் தேடித் தெற்கு நோக்கிச் செல்லத் தீர்மானிக்கிறாள்.',
      speaker: 'அபிராமி', dialogue: '(கண்ணீருடன்) அம்மா! அப்பா கன்னியாகுமரி அணையில இருக்காரு... நான் அவர தேடிப் போவேன்!',
      action: 'வெள்ளநீரின் உக்கிரத்தில் வாகனங்கள் மிதக்கின்றன. அபிராமி துணிச்சலுடன் தெற்கு நோக்கிச் செல்லும் நிவாரண ரயிலைப் நோக்கி ஓடுகிறாள்.'
    },
    {
      title: '3. செங்கல்பட்டு ரயில் நிலைய நிவாரணப் பெட்டி', loc: 'செங்கல்பட்டு - ரயில் நிலையம்', time: 'நள்ளிரவு', type: 'INT',
      sum: 'மின்சாரம் துண்டிக்கப்பட்ட நிலையில் நிவாரண ரயிலில் பயணிக்கும் அபிராமி, சக பயணிகளிடம் தன் தந்தை சுந்தரம் கன்னியாகுமரி தடுப்பணையில் பணியாற்றும் தலைமை பொறியாளர் என்று கூறுகிறாள்.',
      speaker: 'அபிராமி', dialogue: 'என் அப்பா சுந்தரம் கன்னியாகுமரி கடலணை இன்ஜினியர்! இந்த புயல் வராம தடுக்க அவரு தான் அணை கதவை மூடணும்!',
      action: 'ரயிலின் கூரையில் கனமழை தட்டுகிறது. இருண்ட பெட்டியில் அகல் விளக்கின் ஒளியில் அபிராமி தந்தையின் புகைப்படத்தைப் பார்க்கிறாள்.'
    },
    {
      title: '4. மேல்மருவத்தூர் நெடுஞ்சாலைப் பிளவு', loc: 'மேல்மருவத்தூர் - தேசிய நெடுஞ்சாலை', time: 'அதிகாலை', type: 'EXT',
      sum: 'ரயில் பாதை வெள்ளத்தில் அடித்துச் செல்லப்பட்டதால், அபிராமி நெடுஞ்சாலையில் நடக்கும் நிவாரணப் பணியாளர்கள் மற்றும் ஓட்டுநர் கதிரவனுடன் இணைகிறாள்.',
      speaker: 'கதிரவன்', dialogue: 'பாப்பா! தனுஷ்கோடி வரைக்கும் புயல் வீசுது. இந்த சின்ன வயசுல தனியாவா போற? என் பஸ்ஸுல ஏறு, திருச்சி வரைக்கும் போவோம்!',
      action: 'தேசிய நெடுஞ்சாலையில் ராட்சத மரங்கள் சாய்ந்து கிடக்கின்றன. அரசுப் பேருந்து ஓட்டுநர் கதிரவன் அபிராமியை பேருந்தில் ஏற்றி அணைக்கிறார்.'
    },

    // Act IIA - Cauvery Delta
    {
      title: '5. தென்பெண்ணை ஆற்றுப் பாலச் சீற்றம்', loc: 'விழுப்புரம் - தென்பெண்ணை ஆறு', time: 'பகல்', type: 'EXT',
      sum: 'தென்பெண்ணை ஆற்றில் ஆபத்தான அளவில் வெள்ளம் பெருக்கெடுத்து ஓடுகிறது. கதிரவனின் பேருந்து பாலத்தைக் கடக்கும்போது நீர்மட்டம் பாலத்தைத் தொடுகிறது.',
      speaker: 'கதிரவன்', dialogue: 'எல்லாரும் சீட் பெல்ட்ட பிடிங்க! ஆற்று வெள்ளம் பாலத்தைக் கடக்குது! தைரியமா இருங்க!',
      action: 'சீறிப் பாயும் சிவப்பு வெள்ள நீர் பேருந்தின் சக்கரங்களைத் தீண்டுகிறது. அபிராமி நம்பிக்கையுடன் தன் தந்தையின் பாக்கெட் கடிகாரத்தை அழுத்துகிறாள்.'
    },
    {
      title: '6. கடலூர் துறைமுக இடிபாடுகள்', loc: 'கடலூர் - கடலோரப் பகுதி', time: 'மாலை', type: 'EXT',
      sum: 'கடலூரில் சுனாமி போன்ற பேரலைகள் மோதி வீடுகளைச் சிதைக்கின்றன. அபிராமி வெள்ளத்தில் சிக்கிய ஒரு சிறு நாய்க்குட்டியைக் காப்பாற்றிப் பேருந்தில் சேர்க்கிறாள்.',
      speaker: 'அபிராமி', dialogue: 'பயப்படாதே குட்டி! உன்னையும் காப்பாத்தி என் அப்பாகிட்ட கூட்டிட்டுப் போறேன்!',
      action: 'பாழடைந்த படகுகளும் இடிபாடுகளும் கரைக்கு அடித்து வரப்படுகின்றன. காற்று மணிக்கு 120 கி.மீ வேகத்தில் சுழன்றடிக்கிறது.'
    },
    {
      title: '7. சிதம்பரம் கோவில் வெளிப்பிரகாரம்', loc: 'சிதம்பரம் - நடராஜர் கோவில்', time: 'இரவு', type: 'INT',
      sum: 'பழமையான கோவில் கல்மண்டபத்தில் நூற்றுக்கணக்கான மக்கள் தஞ்சம் அடைந்துள்ளனர். வானொலிச் செய்தியில் கன்னியாகுமரி அணை ஆபத்தில் உள்ளதாக அறிவிக்கப்படுகிறது.',
      speaker: 'வானொலி அறிவிப்பாளர்', dialogue: 'முக்கியச் செய்தி: கன்னியாகுமரி சூறாவளித் தடுப்பணையின் 4-வது கதவு பழுதாகியுள்ளது. பொறியாளர் சுந்தரம் அபாயகட்டத்தில் போராடுகிறார்!',
      action: 'அபிராமி வானொலியின் அருகில் ஓடிவந்து செய்தியைக் கேட்டு அதிர்ச்சியடைகிறாள். அவள் கண்கள் உறுதியுடன் பிரகாசிக்கின்றன.'
    },
    {
      title: '8. மயிலாடுதுறை காவேரி கரை பாய்ச்சல்', loc: 'மயிலாடுதுறை - காவேரி ஆறு', time: 'நள்ளிரவு', type: 'EXT',
      sum: 'காவேரி ஆற்றின் கரை உடைந்து வெள்ளநீர் ஊருக்குள் புகுகிறது. கதிரவன் மற்றும் அபிராமி கரையோர மக்களை எச்சரித்து மேடான பகுதிக்கு வழிகாட்டுகிறார்கள்.',
      speaker: 'அபிராமி', dialogue: 'எல்லாரும் கோவில் மேட்டுக்கு ஓடுங்க! வெள்ளம் வருது! அங்கிள், சீக்கிரம் வாங்க!',
      action: 'மின்னல் ஒளியில் சீறிப்பாயும் காவிரி நீர் வெட்டவெளியை மூழ்கடிக்கிறது. அபிராமி கதிரவனின் கரத்தைப் பிடித்து வழிகாட்டுகிறாள்.'
    },

    // Act IIB - Thanjavur & Trichy
    {
      title: '9. கும்பகோணம் நிவாரண முகாம் சந்திப்பு', loc: 'கும்பகோணம் - பள்ளி நிவாரண முகாம்', time: 'அதிகாலை', type: 'INT',
      sum: 'மருத்துவ முகாமில் காயமடைந்தவர்களுக்குச் சிகிச்சை அளிக்கப்படுகிறது. அங்குள்ள ராணுவத் தொடர்பாளர் அபிராமியின் தந்தை சுந்தரம் உயிருடன் இருப்பதை உறுதிப்படுத்துகிறார்.',
      speaker: 'ராணுவ அதிகாரி', dialogue: 'தம்பி சுந்தரம் தான் கன்னியாகுமரி அணையை உடைஞ்சிடாம பிடிச்சிருக்காரு! அவர் பொண்ணு நீதானா? உன்னை மதுரை ஹெலிகாப்டர் கேம்ப்புக்கு அனுப்புறேன்!',
      action: 'அபிராமியின் முகத்தில் நம்பிக்கைக் கண்ணீர் வழிகிறது. அவள் சூடான கஞ்சியை அருந்திவிட்டு தெற்கு நோக்கிப் பயணத்தைத் தொடர்கிறாள்.'
    },
    {
      title: '10. தஞ்சாவூர் பெரிய கோவில் சூறாவளி', loc: 'தஞ்சாவூர் - பெரிய கோவில் வளாகம்', time: 'பகல்', type: 'EXT',
      sum: 'தஞ்சைப் பெரிய கோவிலின் விமானத்தைச் சுற்றிப் புயல் காற்று சுழன்றடிக்கிறது. நிவாரண ஹெலிகாப்டர் தரை இறங்க முடியாமல் காற்றில் ஆடுகிறது.',
      speaker: 'கதிரவன்', dialogue: 'காற்றோட வேகம் அதிகமாகுது! நாம தரை வழியாகவே திருச்சிக்குக் கிளம்புவோம் பாப்பா!',
      action: 'கோவில் கோபுரத்தின் உச்சியில் மின்னல் வெட்டுகிறது. அபிராமி கதிரவனுடன் ராணுவ ஆம்புலன்ஸ் வாகனத்தில் ஏறுகிறாள்.'
    },
    {
      title: '11. திருச்சி காவேரி இரும்புப் பாலம்', loc: 'திருச்சி - காவேரி பாலம்', time: 'மாலை', type: 'EXT',
      sum: 'திருச்சி இரும்புப் பாலத்தை நீர்மட்டம் தொடுகிறது. மலைக்கோட்டையின் பின்னணியில் ராணுவ வாகனங்கள் தென் மாவட்டங்களை நோக்கிப் புயல் வேகத்தில் செல்கின்றன.',
      speaker: 'ராணுவ ஓட்டுநர்', dialogue: 'மதுரை பைபாஸ் வரைக்கும் தான் ரோடு இருக்கு! அதுக்கு அப்புறம் படகுல தான் போவணும்!',
      action: 'மழையின் உக்கிரத்தில் மலைக்கோட்டை கோவில் மங்கலாகத் தெரிகிறது. அபிராமி வானொலிச் சிக்னலைச் சீரமைக்க முயல்கிறாள்.'
    },
    {
      title: '12. புதுக்கோட்டை நெடுஞ்சாலைத் தடை', loc: 'புதுக்கோட்டை - சோதனைச் சாவடி', time: 'இரவு', type: 'EXT',
      sum: 'பொதுமக்கள் போக்குவரத்துக்கு ராணுவம் தடை விதிக்கிறது. அபிராமி தான் சுந்தரத்தின் மகள் என்று கூறி பாதுகாப்பு அதிகாரியை சம்மதிக்க வைக்கிறாள்.',
      speaker: 'அபிராமி', dialogue: 'சார்! எங்க அப்பா கன்னியாகுமரி அணையில் தனியா போராடுறாரு! நான் போய் அவரைப் பார்க்கணும், வழி விடுங்க சார்!',
      action: 'பாதுகாப்பு அதிகாரி அபிராமியின் துணிச்சலைக் கண்டு வியந்து, ராணுவ மீட்புக் குழு வாகனத்தில் அவளுக்கு இடம் அளிக்கிறார்.'
    },

    // Act III - Madurai & Tirunelveli
    {
      title: '13. மதுரை மீனாட்சி அம்மன் கோவில் தெப்பக்குளம்', loc: 'மதுரை - தெப்பக்குளம்', time: 'நள்ளிரவு', type: 'EXT',
      sum: 'மதுரை நகரே வெள்ளத்தில் மூழ்கியுள்ளது. தெப்பக்குளத்து நீர் வீதிகளில் பாய்கிறது. ஹேம் ரேடியோவில் சுந்தரத்தின் குரல் ஒலிபரப்பாகிறது.',
      speaker: 'சுந்தரம் (வானொலியில்)', dialogue: 'கன்னியாகுமரி கடலணை இன்னும் 2 மணி நேரம் தாங்கும்! கதவுகளைப் பூட்ட உதவி தேவை... யாராவது கேட்கிறீர்களா?',
      action: 'வானொலியில் தந்தையின் குரலைக் கேட்ட அபிராமி கதறி அழுகிறாள். அப்பா! நான் வந்துட்டிருக்கேன் அப்பா! என்று மைக்கில் கத்துகிறாள்.'
    },
    {
      title: '14. விருதுநகர் தொழிற்பேட்டைப் தீ விபத்து', loc: 'விருதுநகர் - தேசிய நெடுஞ்சாலை', time: 'அதிகாலை', type: 'EXT',
      sum: 'வெள்ளநீரிலும் காற்றினாலும் பட்டாசு ஆலை வளாகத்தில் தீ விபத்து ஏற்படுகிறது. அபிராமி பாதுகாப்பான பாதையைக் காட்டி மீட்புக் குழுவை வழிநடத்துகிறாள்.',
      speaker: 'கதிரவன்', dialogue: 'பாப்பாவுக்கு இந்த ஊர் வழி நல்லா தெரிஞ்சிருக்கு! அவ சொல்ற பாதையில வண்டிய விடுங்க!',
      action: 'அபிராமி வரைபடத்தைப் பார்த்து உயரமான மேட்டுப் பாதையைச் சுட்டிக்காட்டுகிறாள். ராணுவ வாகனம் தீ மண்டலத்தைக் கடக்கிறது.'
    },
    {
      title: '15. சாத்தூர் வைப்பார் ஆற்றுப் பாலம்', loc: 'சாத்தூர் - வைப்பார் ஆறு', time: 'பகல்', type: 'EXT',
      sum: 'வைப்பார் ஆற்றின் பாலம் பகுதி இடிந்து விழுகிறது. அபிராமியும் கதிரவனும் ஆபத்தான கயிறுப் பாலத்தின் வழியே ஆற்றைக் கடக்கிறார்கள்.',
      speaker: 'அபிராமி', dialogue: 'அங்கிள், பயப்படாதீங்க! கைப்பிடியை இறுக்கிப் பிடிங்க! நாம திருநெல்வேலி போயிருவோம்!',
      action: 'சீறிப் பாயும் வெள்ளத்தின் மேல் தொங்கும் கயிற்றில் அபிராமி துணிச்சலுடன் அடியெடுத்து வைக்கிறாள்.'
    },
    {
      title: '16. திருநெல்வேலி தாமிரபரணி வெள்ளம்', loc: 'திருநெல்வேலி - தாமிரபரணி ஆறு', time: 'மாலை', type: 'EXT',
      sum: 'தாமிரபரணி ஆற்றில் வரலாறு காணாத வெள்ளப்பெருக்கு. ராணுவ விசைப்படகில் அபிராமி கன்னியாகுமரி எல்லையை நோக்கிய பயணத்தைத் தொடர்கிறாள்.',
      speaker: 'படகோட்டி', dialogue: 'நெல்லை கடந்துட்டா கன்னியாகுமரி 40 கி.மீ தான்! அங்கே புயல் உச்சக்கட்டத்துல இருக்கு!',
      action: 'அலையடிக்கும் தாமிரபரணியின் நடுவே விசைப்படகு புயலைக் கிழித்துக்கொண்டு முன்னோக்கிப் பாய்கிறது.'
    },

    // Epilogue - Kanyakumari Rescue
    {
      title: '17. நாங்குநேரி காற்றாலை மண்டலம்', loc: 'நாங்குநேரி - காற்றாலைப் பண்ணை', time: 'இரவு', type: 'EXT',
      sum: 'மணிக்கு 150 கி.மீ வேகப் புயல் சுழல் காற்றாலைச் சிறகுகளை உடைத்தெறிகிறது. அபிராமி பயணிக்கும் வாகனம் காற்றின் வேகத்தில் ஆடுகிறது.',
      speaker: 'கதிரவன்', dialogue: 'கன்னியாகுமரி எல்லை வந்துட்டோம் பாப்பா! இதோ கடலணை வெளிச்சம் தெரியுது!',
      action: 'தூரத்தில் கன்னியாகுமரி சூறாவளித் தடுப்பணையின் பிரம்மாண்ட சிவப்புச் சிக்னல் விளக்குகள் புயல் இருளில் ஒளிர்கின்றன.'
    },
    {
      title: '18. கன்னியாகுமரி திருவள்ளுவர் சிலை கடல் பாறை', loc: 'கன்னியாகுமரி - விவேகானந்தர் பாறை முகம்', time: 'நள்ளிரவு', type: 'EXT',
      sum: '50 அடி உயர ராட்சத அலைகள் திருவள்ளுவர் சிலையையும் தடுப்பணையையும் மோதித் தகர்க்க முயல்கின்றன. சுந்தரம் தனியாக அணைக்கதவின் கியரை இயக்குகிறார்.',
      speaker: 'சுந்தரம்', dialogue: '(மூச்சிரைக்க) இந்த கடைசி லீவரை இழுத்துட்டா தென் தமிழகமே தப்பிக்கும்... ஆனா கை வலிக்குதே!',
      action: 'ராட்சத அலைகள் கட்டுப்பாட்டு அறையின் கண்ணாடியை மோதி உடைக்கின்றன. சுந்தரம் தன் முழு பலத்தையும் திரட்டி லீவரைப் பிடிக்கிறார்.'
    },
    {
      title: '19. கன்னியாகுமரி கடலணை கட்டுப்பாட்டு அறை', loc: 'கன்னியாகுமரி - அணை கட்டுப்பாட்டு அறை', time: 'அதிகாலை', type: 'INT',
      sum: 'புயலை ஊடுருவி அபிராமி கட்டுப்பாட்டு அறைக்குள் ஓடி வருகிறாள். அப்பா! என்ற அவளது குரல் அலை ஓசையையும் தாண்டி சுந்தரத்தின் காதில் விழுகிறது.',
      speaker: 'அபிராமி', dialogue: '(கதறியபடி) அப்பா! நான் வந்துட்டேன் அப்பா! பாக்கெட் கடிகாரத்தைக் கொண்டு வந்திருக்கேன்!',
      action: 'சுந்தரம் அதிர்ச்சியுடன் திரும்பிப் பார்க்கிறார். அபிராமி ஓடிவந்து தந்தையின் கரத்துடன் சேர்ந்து அணைக்கதவு லீவரைப் பலமாக இழுக்கிறாள்!'
    },
    {
      title: '20. கன்னியாகுமரி முக்கடல் சங்கமத்தில் விடியல்', loc: 'கன்னியாகுமரி - முக்கடல் சங்கமம்', time: 'விடியல்', type: 'EXT',
      sum: 'தடுப்பணையின் பிரம்மாண்ட இரும்புக் கதவு முழுமையாக மூடி, கடல் சுனாமியைத் தடுக்கிறது. புயல் ஓய்ந்து, முக்கடல் சங்கமத்தில் தங்க நிறச் சூரியன் உதிக்கிறது.',
      speaker: 'சுந்தரம்', dialogue: '(கண்ணீருடன் அபிராமியைக் கட்டிப்பிடித்து) என் செல்லக் குட்டி... தமிழ்நாடு முழுதும் கடந்து வந்து என் உயிரையும் தென் தமிழகத்தையும் காப்பாத்திட்டாய்மா!',
      action: 'அபிராமி தன் தந்தையின் மார்பில் சாய்ந்து கொள்ள, பாக்கெட் கடிகாரத்தின் டிக்-டிக் சப்தமும் கடல் அலைகளின் அமைதியான ஓசையும் ஒலிக்க படம் நிறைவடைகிறது.'
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
      content: `<p class="sc-action" style="margin-bottom: 0.5rem;">${sc.action}</p>
<p class="sc-character" style="margin-top: 0.75rem; text-align: center; font-weight: bold;">${sc.speaker}</p>
<p class="sc-dialogue" style="margin-bottom: 0.5rem; text-align: center;">${sc.dialogue}</p>`,
      notes: [{ id: `note-${sceneId}-1`, content: `<b>காட்சி ${sceneId}:</b> ${sc.title}`, color: colors[actIdx % colors.length], timestamp }],
      // Manual breakdown details empty as requested
      breakdown: {
        sound: [],
        props: [],
        costume: [],
        vfx: [],
        practical: [],
        cast: [],
        location: []
      },
      versions: []
    });

    if (i > 0) {
      connections.push({ from: i, to: sceneId, boardId: targetBoardId, style: 'zigzag' });
    }
  });

  const annotations: Annotation[] = [
    { id: 201, type: 'text', x: 80, y: 30, w: 550, h: 50, text: 'பேரழிவு: சுந்தரத்தின் மகள் (20-SCENE TAMIL DISASTER FEATURE FILM)', fontSize: 14, boardId: targetBoardId, color: '#f5a623' }
  ];

  const characterData: Record<string, CharacterData> = {
    'அபிராமி (ABHIRAMI)': {
      id: 'c-abhirami', name: 'அபிராமி (ABHIRAMI)', age: 8, gender: 'Female', ethnicity: 'Tamil', hair: 'Short braided dark hair', eyes: 'Expressive Brown', build: 'Slender', occupation: 'Student', archetype: 'The Courageous Child', physiology: 'Clutches silver pocket watch.', sociology: 'Daughter of Chief Engineer.', psychology: 'Determined, brave, deeply devoted to father.', backstory: 'Traveled across Tamil Nadu during mega storm to find her father.', images: [], relationships: [{ target: 'சுந்தரம் (SUNDARAM)', type: 'Father', description: 'Chief Dam Engineer at Kanyakumari.' }]
    },
    'சுந்தரம் (SUNDARAM)': {
      id: 'c-sundaram', name: 'சுந்தரம் (SUNDARAM)', age: 42, gender: 'Male', ethnicity: 'Tamil', hair: 'Grey stubble, short hair', eyes: 'Dark Brown', build: 'Strong, athletic', occupation: 'Chief Structural Engineer', archetype: 'The Heroic Father', physiology: 'Weathered hands from field work.', sociology: 'Public Works Department Engineer.', psychology: 'Selfless, relentless sense of duty.', backstory: 'Designed and built the Kanyakumari Disaster Sea Wall.', images: [], relationships: []
    },
    'மலர் (MALAR)': {
      id: 'c-malar', name: 'மலர் (MALAR)', age: 36, gender: 'Female', ethnicity: 'Tamil', hair: 'Long dark hair', eyes: 'Warm Brown', build: 'Average', occupation: 'Homemaker', archetype: 'The Loving Mother', physiology: 'Weary from storm evacuation.', sociology: 'Lives in Chennai with Abhirami.', psychology: 'Protective and resilient.', backstory: 'Separated during Adyar flyover flash flood.', images: [], relationships: []
    },
    'கதிரவன் (KATHIRAVAN)': {
      id: 'c-kathiravan', name: 'கதிரவன் (KATHIRAVAN)', age: 55, gender: 'Male', ethnicity: 'Tamil', hair: 'Salt and pepper hair', eyes: 'Kind Dark', build: 'Broad-shouldered', occupation: 'Government Bus Driver', archetype: 'The Wise Protector', physiology: 'Steady driving posture.', sociology: '30-year veteran bus driver.', psychology: 'Compassionate mentor.', backstory: 'Guarded Abhirami across highways and flooded districts.', images: [], relationships: []
    }
  };

  const generatedShots: Shot[] = [
    { id: 'shot-1', scene: '1', shotSize: 'EXTREME WIDE', angle: 'HIGH ANGLE', lens: '24mm Prime', movement: 'Crane Down', subject: 'Marina Beach Storm Surge', description: 'High aerial shot panning down from storm clouds to massive ocean waves battering Marina Beach.', scriptReference: 'கருமேகங்கள் வானத்தை மூட, ராட்சத அலைகள் கரையை நோக்கிச் சீறிப் பாய்கின்றன...', sourceType: 'manual', durationSec: 6 }
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
