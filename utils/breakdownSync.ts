import { Beat, BreakdownData, BreakdownItem, AppTask, TaskSubtask, ViewMode } from '../types';
import { ContinuityLook } from '../components/views/ContinuityView';

export interface DepartmentClassification {
  departmentId: string;
  departmentName: string;
  continuityDept?: 'costume' | 'makeup' | 'vehicle' | 'props';
  isVehicle: boolean;
  isWeapon: boolean;
}

// Vehicle identification patterns
const VEHICLE_KEYWORDS = [
  'suv', 'car', 'truck', 'sedan', 'jeep', 'cruiser', 'van', 'automobile',
  'motorcycle', 'bike', 'scooter', 'bus', 'ambulance', 'taxi', 'cab',
  'limousine', 'limo', 'pickup', 'patrol car', 'police car', 'squad car',
  'getaway car', 'helicopter', 'chopper', 'plane', 'boat', 'yacht', 'speedboat',
  'tractor', 'wagon', 'lorry', 'auto rickshaw', 'rickshaw', 'fortuner', 'thar',
  'scorpio', 'innova', 'bmw', 'mercedes', 'audi', 'ford', 'mustang', 'honda'
];

// Weapon identification patterns
const WEAPON_KEYWORDS = [
  'gun', 'pistol', 'revolver', 'rifle', 'shotgun', 'knife', 'dagger', 'blade',
  'machete', 'sword', 'weapon', 'firearm', 'holster', 'bullet', 'grenade',
  'explosive', 'bomb', 'glock', 'beretta', 'sniper', 'ar-15', 'ak-47'
];

// Costume / Wardrobe keywords
const COSTUME_KEYWORDS = [
  'dress', 'shirt', 'suit', 'jacket', 't-shirt', 'pants', 'trousers', 'jeans',
  'coat', 'blazer', 'hoodie', 'uniform', 'boots', 'shoes', 'sneakers', 'hat',
  'cap', 'tie', 'scarf', 'shawl', 'sari', 'saree', 'dhoti', 'kurta', 'gloves',
  'sunglasses', 'glasses', 'watch', 'jewelry', 'necklace', 'ring', 'mask',
  'cloak', 'armor', 'vest', 'outfit', 'costume', 'wardrobe'
];

// Makeup / Prosthetics keywords
const MAKEUP_KEYWORDS = [
  'blood', 'wound', 'scar', 'cut', 'bruise', 'prosthetic', 'burn', 'scratch',
  'gash', 'bleeding', 'black eye', 'stitches', 'bandage', 'cast', 'makeup',
  'wig', 'beard', 'mustache', 'hair', 'teeth', 'tattoo', 'gore', 'sweat',
  'dirt on face', 'pale skin'
];

// SFX Practical effects keywords
const SFX_KEYWORDS = [
  'fire', 'explosion', 'blast', 'smoke', 'rain', 'storm', 'flame', 'spark',
  'squib', 'bullet hit', 'fog', 'wind', 'dust', 'shatter', 'debris', 'pyro',
  'glass shatter', 'water spray'
];

// VFX keywords
const VFX_KEYWORDS = [
  'cgi', 'vfx', 'green screen', 'blue screen', 'digital', 'tracking marker',
  'sky replacement', 'wire removal', 'monster', 'creature', 'portal', 'laser',
  'hologram', 'tidal wave', 'giant', 'alien', 'magic', 'destruction'
];

// Sound keywords
const SOUND_KEYWORDS = [
  'sound', 'sfx', 'thunder', 'screech', 'siren', 'gunshot', 'explosion sound',
  'ambient', 'whisper', 'footsteps', 'door creak', 'engine roar', 'music cue',
  'score', 'melody', 'ringtone'
];

// Location keywords
const LOCATION_KEYWORDS = [
  'bridge', 'warehouse', 'alley', 'rooftop', 'highway', 'street', 'forest',
  'lake', 'beach', 'mountain', 'temple', 'church', 'hospital', 'police station',
  'courtroom', 'abandoned', 'apartment', 'mansion', 'hideout', 'office',
  'parking lot', 'dock', 'harbor', 'station', 'airport', 'tunnel'
];

// Stunt keywords
const STUNT_KEYWORDS = [
  'stunt', 'fight', 'punch', 'kick', 'fall', 'car chase', 'crash', 'wire work',
  'tackle', 'jump', 'flip', 'brawl', 'combat'
];

/**
 * Intelligent Department & Continuity Classifier
 */
export function detectDepartmentForItem(
  itemName: string,
  category: string
): DepartmentClassification {
  const lower = itemName.toLowerCase();

  // 1. Vehicle detection (high priority: routes to transportation & continuity vehicle)
  const isVehicle = VEHICLE_KEYWORDS.some(kw => {
    const reg = new RegExp(`\\b${kw}\\b`, 'i');
    return reg.test(lower);
  });

  if (isVehicle) {
    return {
      departmentId: 'transportation',
      departmentName: 'Transportation',
      continuityDept: 'vehicle',
      isVehicle: true,
      isWeapon: false
    };
  }

  // 2. Makeup / Prosthetics / Blood & Wound detection
  const isMakeup = MAKEUP_KEYWORDS.some(kw => lower.includes(kw));
  if (isMakeup) {
    return {
      departmentId: 'makeup',
      departmentName: 'Makeup & Prosthetics',
      continuityDept: 'makeup',
      isVehicle: false,
      isWeapon: false
    };
  }

  // 3. Weapon detection (under props)
  const isWeapon = WEAPON_KEYWORDS.some(kw => {
    const reg = new RegExp(`\\b${kw}\\b`, 'i');
    return reg.test(lower);
  });

  // 4. Category-based and semantic detection
  if (category === 'costume' || COSTUME_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'costume',
      departmentName: 'Costume & Wardrobe',
      continuityDept: 'costume',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (category === 'practical' || SFX_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'sfx',
      departmentName: 'Special Effects (SFX)',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (category === 'vfx' || VFX_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'vfx',
      departmentName: 'VFX Department',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (category === 'sound' || SOUND_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'sound',
      departmentName: 'Sound Department',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (category === 'location' || LOCATION_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'locations',
      departmentName: 'Locations',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (STUNT_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      departmentId: 'stunts',
      departmentName: 'Stunts Unit',
      isVehicle: false,
      isWeapon: false
    };
  }

  if (category === 'props' || isWeapon) {
    return {
      departmentId: 'props',
      departmentName: 'Props Unit',
      continuityDept: 'props',
      isVehicle: false,
      isWeapon
    };
  }

  if (category === 'cast') {
    return {
      departmentId: 'direction',
      departmentName: 'Direction',
      isVehicle: false,
      isWeapon: false
    };
  }

  // Default fallback to Props Unit
  return {
    departmentId: 'props',
    departmentName: 'Props Unit',
    continuityDept: 'props',
    isVehicle: false,
    isWeapon: false
  };
}

/**
 * Generate rich, film-production-accurate subtasks for any breakdown item
 */
export function generateDefaultSubtasks(
  itemName: string,
  category: string,
  departmentId: string,
  sceneText: string = '',
  existingDetails?: Record<string, string>
): { subtasks: TaskSubtask[]; details: Record<string, string> } {
  const subtasks: TaskSubtask[] = [];
  const details: Record<string, string> = { ...(existingDetails || {}) };
  const lowerItem = itemName.toLowerCase();
  const lowerText = sceneText.toLowerCase();

  // 1. VEHICLE SUBTASKS (e.g. SUV, Police Cruiser, Getaway Car)
  if (departmentId === 'transportation' || VEHICLE_KEYWORDS.some(kw => lowerItem.includes(kw))) {
    // Numberplate
    const plateMatch = sceneText.match(/\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4})\b/i);
    const numberplate = details.numberplate || (plateMatch ? plateMatch[1].toUpperCase() : 'TN 09 BK 7721');
    details.numberplate = numberplate;

    // Model Year
    const yearMatch = sceneText.match(/\b(19\d\d|20[0-2]\d)\b/);
    const modelYear = details.modelYear || (yearMatch ? `${yearMatch[1]} ${itemName}` : `2023 ${itemName}`);
    details.modelYear = modelYear;

    // Color
    const colorMatch = sceneText.match(/\b(black|white|silver|grey|gray|red|blue|matte black|midnight blue|charcoal)\b/i);
    const color = details.color || (colorMatch ? colorMatch[1] : (lowerItem.includes('black') ? 'Gloss Jet Black' : 'Matte Charcoal Grey'));
    details.color = color;

    // Damage & Condition
    let damage = details.damage || 'Pristine / Showroom Condition';
    if (lowerText.includes('dent') || lowerText.includes('smash') || lowerText.includes('crash') || lowerText.includes('bullet') || lowerText.includes('scratch')) {
      damage = 'Action Weathering: Front bumper dent, bullet grazing & side scrapes';
    }
    details.damage = damage;

    subtasks.push(
      { id: 'sub-v-plate', title: 'Vehicle Numberplate Verification', completed: false, value: numberplate, category: 'numberplate' },
      { id: 'sub-v-year', title: 'Model & Manufacturing Year Spec', completed: false, value: modelYear, category: 'modelYear' },
      { id: 'sub-v-color', title: 'Exterior & Interior Color Palette Check', completed: false, value: color, category: 'color' },
      { id: 'sub-v-damage', title: 'Damage / Continuity Wear State', completed: false, value: damage, category: 'damage' },
      { id: 'sub-v-driver', title: 'Stunt Driver / Key Assignment', completed: false, value: 'Assigned to Action Driver Team', category: 'driver' },
      { id: 'sub-v-rig', title: 'Camera Suction Mount & Rigging Inspection', completed: false, value: 'Certified for 3-Point Hood Mount', category: 'rigging' },
      { id: 'sub-v-permit', title: 'RTO Filming Transit & Insurance Permit', completed: false, value: 'Cleared with Local Police / Traffic Dept', category: 'permit' }
    );

    return { subtasks, details };
  }

  // 2. PROPS & WEAPONS SUBTASKS
  if (departmentId === 'props') {
    const isWeapon = WEAPON_KEYWORDS.some(kw => lowerItem.includes(kw));

    if (isWeapon) {
      const make = details.make || `${itemName} (Hero Replica)`;
      const safety = details.safety || 'Deactivated Armory Certified';
      details.make = make;
      details.safety = safety;

      subtasks.push(
        { id: 'sub-p-make', title: 'Make / Model / Serial Registration', completed: false, value: make, category: 'make' },
        { id: 'sub-p-double', title: 'Hero vs Rubber Stunt Doubles (x2 units)', completed: false, value: '2 Stunt Replicas Ready', category: 'doubles' },
        { id: 'sub-p-safety', title: 'Armorer On-Set Safety Certification', completed: false, value: safety, category: 'safety' },
        { id: 'sub-p-weathering', title: 'Scratches & Barrel Weathering Check', completed: false, value: 'Worn grip & matte barrel finish', category: 'weathering' },
        { id: 'sub-p-reset', title: 'Take Reset & Cleaning Protocol', completed: false, value: 'Fast turnaround kit on set', category: 'reset' }
      );
    } else {
      subtasks.push(
        { id: 'sub-p-spec', title: 'Material & Design Specification', completed: false, value: `${itemName} Hero Spec`, category: 'spec' },
        { id: 'sub-p-double', title: 'Hero vs Backup Double Count', completed: false, value: '1 Primary + 1 Backup Double', category: 'doubles' },
        { id: 'sub-p-weathering', title: 'Aging & Distress Continuity Level', completed: false, value: 'Pre-production matched aging', category: 'weathering' },
        { id: 'sub-p-case', title: 'On-Set Protective Case & Handler Log', completed: false, value: 'Assigned to Prop Master Mani', category: 'handling' }
      );
    }

    return { subtasks, details };
  }

  // 3. COSTUME & WARDROBE SUBTASKS
  if (departmentId === 'costume') {
    const fabric = details.fabric || 'Cotton / Silk Blend with distressed edges';
    const distress = details.distress || (lowerText.includes('torn') || lowerText.includes('dirty') || lowerText.includes('mud') ? 'Stage 2: Knee tears & mud spray' : 'Stage 1: Clean & pressed');
    details.fabric = fabric;
    details.distress = distress;

    subtasks.push(
      { id: 'sub-c-fabric', title: 'Fabric, Cut & Palette Camera Test', completed: false, value: fabric, category: 'fabric' },
      { id: 'sub-c-distress', title: 'Distress / Tear / Weathering Progression', completed: false, value: distress, category: 'distress' },
      { id: 'sub-c-doubles', title: 'Stunt & Double Duplicate Sets (x3)', completed: false, value: '3 identical sets fitted for stunts', category: 'doubles' },
      { id: 'sub-c-fitting', title: 'Actor Tailoring & Movement Fitting', completed: false, value: 'Measurements confirmed with actor', category: 'fitting' },
      { id: 'sub-c-tag', title: 'Digital Polaroid Continuity Tagging', completed: false, value: 'Tagged in Continuity catalog', category: 'continuity' }
    );

    return { subtasks, details };
  }

  // 4. MAKEUP & PROSTHETICS SUBTASKS
  if (departmentId === 'makeup' || departmentId === 'hair') {
    const bloodStage = details.bloodStage || (lowerText.includes('fresh') ? 'Stage 1: Fresh active bleeding' : 'Stage 2: Dried dark crust');
    const applicationTime = details.applicationTime || '45 minutes prior to first call';
    details.bloodStage = bloodStage;
    details.applicationTime = applicationTime;

    subtasks.push(
      { id: 'sub-m-piece', title: 'Prosthetic Piece Silicone Grade / Sculp', completed: false, value: `${itemName} Appliance`, category: 'prosthetic' },
      { id: 'sub-m-blood', title: 'Blood Stage & Viscosity Tracking', completed: false, value: bloodStage, category: 'blood' },
      { id: 'sub-m-time', title: 'Application & Touch-up Call Time Window', completed: false, value: applicationTime, category: 'timing' },
      { id: 'sub-m-allergy', title: 'Skin Barrier & Adhesive Allergy Test', completed: false, value: 'Passed patch test', category: 'safety' },
      { id: 'sub-m-photo', title: 'Macro Continuity Reference Photo Tag', completed: false, value: 'High-res continuity logged', category: 'photo' }
    );

    return { subtasks, details };
  }

  // 5. SPECIAL EFFECTS (SFX) SUBTASKS
  if (departmentId === 'sfx') {
    subtasks.push(
      { id: 'sub-sfx-rig', title: 'Rig Placement & Fluid/Charge Calibration', completed: false, value: 'Calibrated for 3-take burst', category: 'rig' },
      { id: 'sub-sfx-permit', title: 'Fire Dept / Municipality Safety NOC', completed: false, value: 'Local fire safety clearance granted', category: 'permit' },
      { id: 'sub-sfx-turnaround', title: 'Reset & Recharge Turnaround Window', completed: false, value: '15-minute reset between takes', category: 'timing' },
      { id: 'sub-sfx-medical', title: 'First Aid & Paramedic Standby Protocol', completed: false, value: 'Safety officer on standby', category: 'safety' }
    );

    return { subtasks, details };
  }

  // 6. VFX SUBTASKS
  if (departmentId === 'vfx') {
    subtasks.push(
      { id: 'sub-vfx-markers', title: 'Tracking Markers & Witness Cam Setup', completed: false, value: 'Set tracking markers placed', category: 'tracking' },
      { id: 'sub-vfx-hdri', title: 'HDRI Chrome Ball & Clean Plate Capture', completed: false, value: '360 HDRI & clean lock-off plate', category: 'hdri' },
      { id: 'sub-vfx-vendor', title: 'Post-Production Asset Turnover Spec', completed: false, value: 'OpenEXR format, 4K log spec', category: 'spec' }
    );

    return { subtasks, details };
  }

  // 7. LOCATIONS SUBTASKS
  if (departmentId === 'locations') {
    subtasks.push(
      { id: 'sub-loc-permit', title: 'Municipality & Police Filming NOC', completed: false, value: 'Official shooting permit obtained', category: 'permit' },
      { id: 'sub-loc-power', title: 'Generator Truck & 3-Phase Power Hookup', completed: false, value: '125kVA generator spot reserved', category: 'power' },
      { id: 'sub-loc-base', title: 'Vanity Van Parking & Basecamp Layout', completed: false, value: 'Vanity park 50m from set', category: 'basecamp' },
      { id: 'sub-loc-weather', title: 'Weather Contingency & Cover Set Plan', completed: false, value: 'Cover set identified nearby', category: 'contingency' }
    );

    return { subtasks, details };
  }

  // 8. SOUND SUBTASKS
  if (departmentId === 'sound') {
    subtasks.push(
      { id: 'sub-snd-boom', title: 'Boom Placement & Radio Lavalier Prep', completed: false, value: 'Dual boom + lavaliers on actors', category: 'mic' },
      { id: 'sub-snd-wild', title: 'Room Tone & Environmental Wild Tracks', completed: false, value: '60s room tone scheduled at wrap', category: 'ambient' },
      { id: 'sub-snd-foley', title: 'Specific SFX Foley Cue Tagging', completed: false, value: 'Foley session scheduled for post', category: 'foley' }
    );

    return { subtasks, details };
  }

  // Default generic subtasks
  subtasks.push(
    { id: 'sub-gen-1', title: 'Requirement Procurement & Sourcing', completed: false, value: 'Sourcing in progress', category: 'source' },
    { id: 'sub-gen-2', title: 'Pre-production Director Sign-off', completed: false, value: 'Pending review', category: 'review' },
    { id: 'sub-gen-3', title: 'On-set Continuity Alignment', completed: false, value: 'Continuity registered', category: 'continuity' }
  );

  return { subtasks, details };
}

/**
 * Enriches a breakdown item with detected department and rich subtasks
 */
export function enrichBreakdownItem(
  item: string | BreakdownItem,
  category: string,
  sceneText: string = ''
): BreakdownItem {
  const name = typeof item === 'string' ? item : item.name;
  const source = typeof item === 'object' ? item.source : undefined;
  const existingSubtasks = typeof item === 'object' ? item.subtasks : undefined;
  const existingDetails = typeof item === 'object' ? item.details : undefined;

  const classification = detectDepartmentForItem(name, category);
  const { subtasks, details } = (existingSubtasks && existingSubtasks.length > 0)
    ? { subtasks: existingSubtasks, details: existingDetails || {} }
    : generateDefaultSubtasks(name, category, classification.departmentId, source || sceneText, existingDetails);

  return {
    name,
    source: source || name,
    departmentId: classification.departmentId,
    subtasks,
    details,
    continuityDept: classification.continuityDept
  };
}

/**
 * Enriches all items in a BreakdownData object
 */
export function enrichBreakdownData(
  breakdown: BreakdownData,
  sceneText: string = ''
): BreakdownData {
  const categories: (keyof BreakdownData)[] = [
    'sound', 'props', 'costume', 'vfx', 'practical', 'cast', 'location'
  ];

  const enriched: BreakdownData = { ...breakdown };

  categories.forEach(cat => {
    const list = breakdown[cat] || [];
    enriched[cat] = list.map(item => enrichBreakdownItem(item, cat, sceneText));
  });

  return enriched;
}

/**
 * Synchronizes Breakdown items across all scenes into:
 * 1. Crew Department Tasks (with subtasks) in app_inbox_tasks
 * 2. Continuity Looks in backstage_continuity_looks
 */
export function syncBreakdownToDepartmentsAndContinuity(
  beats: Beat[],
  existingTasks: AppTask[] = []
): {
  updatedTasks: AppTask[];
  updatedLooks: ContinuityLook[];
  stats: {
    tasksCreated: number;
    tasksUpdated: number;
    looksCreated: number;
    deptsCount: number;
  };
} {
  // Read current saved tasks if not passed
  let tasksPool = [...existingTasks];
  if (tasksPool.length === 0 && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('app_inbox_tasks');
      if (saved) tasksPool = JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }

  // Read current saved continuity looks
  let looksPool: ContinuityLook[] = [];
  if (typeof window !== 'undefined') {
    try {
      const savedLooks = localStorage.getItem('backstage_continuity_looks');
      if (savedLooks) looksPool = JSON.parse(savedLooks);
    } catch (e) {
      console.error(e);
    }
  }

  let tasksCreated = 0;
  let tasksUpdated = 0;
  let looksCreated = 0;
  const involvedDepartments = new Set<string>();

  // Map to aggregate items by unique key: `${departmentId}:${itemName.toLowerCase()}`
  const aggregatedItems = new Map<string, {
    name: string;
    departmentId: string;
    departmentName: string;
    category: string;
    scenes: string[];
    subtasks: TaskSubtask[];
    details: Record<string, string>;
    continuityDept?: 'costume' | 'makeup' | 'vehicle' | 'props';
    sourceTexts: string[];
    isVehicle: boolean;
  }>();

  (beats || []).forEach((beat, bIdx) => {
    const scNum = beat.sceneNumber || `${bIdx + 1}`;
    if (!beat.breakdown) return;

    const div = document.createElement('div');
    div.innerHTML = beat.content || '';
    const scriptText = div.textContent || div.innerText || '';

    const categories: (keyof BreakdownData)[] = [
      'props', 'costume', 'practical', 'vfx', 'sound', 'location', 'cast'
    ];

    categories.forEach(cat => {
      const items = beat.breakdown?.[cat] || [];
      items.forEach(rawItem => {
        const enriched = enrichBreakdownItem(rawItem, cat, scriptText);
        const name = enriched.name.trim();
        if (!name) return;

        const deptId = enriched.departmentId || 'props';
        involvedDepartments.add(deptId);

        const key = `${deptId}:${name.toLowerCase()}`;
        const classification = detectDepartmentForItem(name, cat);

        if (!aggregatedItems.has(key)) {
          aggregatedItems.set(key, {
            name,
            departmentId: deptId,
            departmentName: classification.departmentName,
            category: cat,
            scenes: [scNum],
            subtasks: enriched.subtasks || [],
            details: enriched.details || {},
            continuityDept: enriched.continuityDept,
            sourceTexts: enriched.source ? [enriched.source] : [],
            isVehicle: classification.isVehicle
          });
        } else {
          const existing = aggregatedItems.get(key)!;
          if (!existing.scenes.includes(scNum)) {
            existing.scenes.push(scNum);
          }
          if (enriched.source && !existing.sourceTexts.includes(enriched.source)) {
            existing.sourceTexts.push(enriched.source);
          }
          if (enriched.details) {
            existing.details = { ...existing.details, ...enriched.details };
          }
        }
      });
    });
  });

  // 1. Process Department Tasks
  const newTasksList = [...tasksPool];

  aggregatedItems.forEach((item) => {
    const sceneLabel = item.scenes.length === 1 ? `Scene ${item.scenes[0]}` : `Scenes ${item.scenes.join(', ')}`;
    const taskTitle = `[Breakdown] ${item.name} (${sceneLabel})`;

    // Check if task already exists for this item and department
    const existingIndex = newTasksList.findIndex(t => 
      (t.departmentId === item.departmentId && t.sourceBreakdownItem?.toLowerCase() === item.name.toLowerCase()) ||
      (t.title.toLowerCase().includes(item.name.toLowerCase()) && t.departmentId === item.departmentId)
    );

    if (existingIndex >= 0) {
      // Update existing task with merged subtasks & scene references
      const existing = newTasksList[existingIndex];
      const mergedSubtasks = [...(existing.subtasks || [])];

      item.subtasks.forEach(newSub => {
        const hasSub = mergedSubtasks.some(s => s.title === newSub.title || s.category === newSub.category);
        if (!hasSub) {
          mergedSubtasks.push(newSub);
        }
      });

      newTasksList[existingIndex] = {
        ...existing,
        relatedScene: sceneLabel,
        subtasks: mergedSubtasks,
        details: { ...(existing.details || {}), ...item.details },
        sourceBreakdownItem: item.name,
        sourceCategory: item.category
      };
      tasksUpdated++;
    } else {
      // Create new department task with full subtasks
      const newTask: AppTask = {
        id: `tk-bd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: taskTitle,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        owner: `${item.departmentName} HOD`,
        priority: item.departmentId === 'transportation' || item.isVehicle ? 'Critical' : 'High',
        deadline: '2026-08-10',
        status: 'To Do',
        relatedScene: sceneLabel,
        targetView: 'crew',
        notes: `Auto-generated from Screenplay Breakdown. Sources: ${item.sourceTexts.slice(0, 3).join(' | ')}`,
        subtasks: item.subtasks,
        sourceBreakdownItem: item.name,
        sourceCategory: item.category,
        details: item.details,
        isRead: false,
        history: [
          {
            id: `h-${Date.now()}`,
            timestamp: 'Just now',
            author: 'Breakdown Sync Engine',
            changeType: 'created',
            comment: `Task created with ${item.subtasks.length} department subtasks for ${item.name}.`
          }
        ]
      };
      newTasksList.unshift(newTask);
      tasksCreated++;
    }

    // 2. Process Continuity Looks
    if (item.continuityDept) {
      const rowKey = `${item.continuityDept}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const minScene = Math.min(...item.scenes.map(s => parseInt(s, 10) || 1));
      const maxScene = Math.max(...item.scenes.map(s => parseInt(s, 10) || minScene));

      const existingLookIndex = looksPool.findIndex(l => 
        l.dept === item.continuityDept && (l.rowKey === rowKey || l.targetName.toLowerCase() === item.name.toLowerCase())
      );

      const lookTitle = item.continuityDept === 'vehicle' 
        ? `Vehicle State: ${item.details.modelYear || item.name} (${item.details.damage || 'Pristine'})`
        : item.continuityDept === 'costume'
        ? `Costume Look: ${item.name} (${item.details.distress || 'Stage 1'})`
        : item.continuityDept === 'makeup'
        ? `Makeup Continuity: ${item.name} (${item.details.bloodStage || 'Stage 1'})`
        : `Prop Continuity: ${item.name}`;

      const lookDesc = [
        item.details.numberplate ? `Plate: ${item.details.numberplate}` : null,
        item.details.color ? `Color: ${item.details.color}` : null,
        item.details.modelYear ? `Model: ${item.details.modelYear}` : null,
        item.details.damage ? `Damage/Condition: ${item.details.damage}` : null,
        item.details.fabric ? `Fabric: ${item.details.fabric}` : null,
        item.details.distress ? `Wear: ${item.details.distress}` : null,
        item.details.bloodStage ? `Blood Stage: ${item.details.bloodStage}` : null,
        `Active in Scenes: ${item.scenes.join(', ')}`
      ].filter(Boolean).join(' • ');

      if (existingLookIndex >= 0) {
        // Update existing continuity look
        const currentLook = looksPool[existingLookIndex];
        looksPool[existingLookIndex] = {
          ...currentLook,
          fromScene: Math.min(currentLook.fromScene, minScene),
          toScene: Math.max(currentLook.toScene, maxScene),
          description: lookDesc || currentLook.description,
          damageLevel: (item.details.damage?.includes('dent') || item.details.damage?.includes('bullet')) ? 'Moderate' : currentLook.damageLevel,
          bloodLevel: item.details.bloodStage?.includes('bleeding') ? 'Active Bleeding' : currentLook.bloodLevel,
          notes: `Synced from Screenplay Breakdown (${sceneLabel})`
        };
      } else {
        // Create new continuity look
        const newLook: ContinuityLook = {
          id: `look-bd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          dept: item.continuityDept,
          rowKey,
          targetName: item.name,
          lookNumber: 1,
          title: lookTitle,
          fromScene: minScene,
          toScene: maxScene,
          description: lookDesc,
          damageLevel: (item.details.damage?.includes('dent') || item.details.damage?.includes('bullet')) ? 'Moderate' : 'None',
          bloodLevel: item.details.bloodStage?.includes('bleeding') ? 'Active Bleeding' : 'None',
          status: 'Verified',
          notes: `Synced from Screenplay Breakdown (${sceneLabel})`
        };
        looksPool.push(newLook);
        looksCreated++;
      }
    }
  });

  // Save to localStorage & dispatch events
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('app_inbox_tasks', JSON.stringify(newTasksList));
      localStorage.setItem('backstage_continuity_looks', JSON.stringify(looksPool));
      window.dispatchEvent(new Event('app_tasks_updated'));
      window.dispatchEvent(new Event('backstage_continuity_updated'));
    } catch (e) {
      console.error('Failed saving to localStorage', e);
    }
  }

  return {
    updatedTasks: newTasksList,
    updatedLooks: looksPool,
    stats: {
      tasksCreated,
      tasksUpdated,
      looksCreated,
      deptsCount: involvedDepartments.size
    }
  };
}
