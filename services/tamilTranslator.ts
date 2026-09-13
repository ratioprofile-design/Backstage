/**
 * High-performance Tamil cinema terminology and script translation engine.
 * Converts all production breakdown items, categories, descriptions, and scene meta
 * into authentic Kollywood / Tamil cinema terms.
 */

const DICTIONARY: Record<string, string> = {
  // Characters & Roles
  'aadhi': 'ஆதி',
  'rathinam': 'ரத்தினம்',
  'vikram': 'விக்ரம்',
  'commissioner vikram': 'கமிஷனர் விக்ரம்',
  'elena': 'எலினா',
  'marcus': 'மார்கஸ்',
  'henchmen': 'சண்டைக் கலைஞர்கள் / அடியாட்கள்',
  '20 henchmen': '20 சண்டைக் கலைஞர்கள் / அடியாட்கள்',
  '20 fighter goons': '20 சண்டைக் கலைஞர்கள் (ஸ்டண்ட் யூனியன்)',
  'devotees': 'கோயில் திருவிழாக் கூட்டம் / பக்தர்கள்',
  'crowd': 'பொதுமக்கள் / கூட்டம்',
  'temple crowd': 'கோயில் திருவிழாக் கூட்டம்',
  'police': 'காவல்துறை அதிகாரிகள்',
  'bodyguards': 'துப்பாக்கி ஏந்திய பாதுகாவலர்கள்',
  'hero lead': 'நாயகன் (Hero Lead)',
  'antagonist lead': 'வில்லன் (Antagonist Lead)',

  // Weapons & Props
  'machete': 'கனத்த இரும்பு அரிவாள்',
  'silver machete': 'வெள்ளி கைப்பிடி வெட்டருவாள்',
  'sword': 'பட்டாக் கத்தி / வாள்',
  'gun': 'துப்பாக்கி',
  'gold gun': 'தங்கத் துப்பாக்கி',
  'pistol': 'கைத்துப்பாக்கி',
  'revolver': 'ரிவால்வர்',
  'knife': 'கத்தி',
  'cigar': 'சுருட்டு',
  'fire torches': 'எரியும் தீப்பந்தங்கள்',
  'brass lamps': 'பித்தளை குத்துவிளக்குகள்',
  'holy ash': 'நெற்றியில் திருநீறு',
  'silver chain': 'வெள்ளிச் சங்கிலி',
  'dynamite': 'டைனமைட் வெடிபொருள்',
  'megaphone': 'மெகாபோன் ஒலிபெருக்கி',
  'briefcase': 'பணப் பெட்டி',
  'bag': 'பயணப் பை',
  'phone': 'கைப்பேசி (போன்)',
  'bottle': 'மது பாட்டில்',
  'key': 'சாவி',
  'laptop': 'மடிக்கணினி',

  // Stunts & SFX
  'action': 'சண்டைக் காட்சி',
  'machete fight choreography': 'வெட்டருவாள் சண்டைப் பயிற்சி (Stunt)',
  'action choreography & wire work': 'சண்டைப் பயிற்சி & கயிறு பாதுகாப்பு (Wire Stunts)',
  'wire stunts': 'கயிறு சாகச பயிற்சி',
  'car crash': 'கார் மோதல் & கண்ணாடி உடைப்பு',
  'glass shatter': 'கண்ணாடி சுக்குநூறாக உடையும் காட்சி',
  'explosion': 'வெடி விபத்து காட்சி',
  'rain machine': 'செயற்கை மழை இயந்திரம் (Rain Machine)',
  'practical rain': 'செயற்கை மழை பொழிவு',
  'smoke machine': 'தரைமட்ட புகை இயந்திரம் (Low Fog)',
  'ground fog': 'தரைமட்ட புகை இயந்திரம்',
  'sparks': 'தீப்பொறி சாகசம்',
  'fire squibs': 'துப்பாக்கி குண்டு வெடிப்பு எஃபெக்ட்',
  'bridge jump': 'பாலத்திலிருந்து ஆற்றில் குதிக்கும் சண்டை',

  // Vehicles
  'bolero': 'மஹிந்திரா பொலிரோ கார்கள்',
  'mahindra bolero': 'மஹிந்திரா பொலிரோ கார்கள்',
  '3 black bolero cars': '3 கறுப்பு பொலிரோ கார்கள்',
  'police jeep': 'காவல்துறை ஜீப்',
  '6 police jeeps': '6 போலீஸ் ஜீப்புகள்',
  'hero bike': 'நாயகன் மோட்டார் பைக்',
  'car': 'படப்பிடிப்பு கார்',
  'vanity van': 'கேரவன் / வேனிட்டி வேன்',

  // Wardrobe & Makeup
  'black veshti': 'கருப்பு பட்டு வேட்டி',
  'black shirt': 'மழையில் நனைந்த கருப்பு சட்டை',
  'white silk shirt': 'வெள்ளை பட்டுச் சட்டை',
  'bulletproof vest': 'துப்பாக்கி குண்டு துளைக்காத அங்கி',
  'tactical suit': 'கருப்பு கமாண்டோ உடை',
  'blood makeup': 'இரத்தக் காயம் ஒப்பனை',
  'blood level 2 makeup': 'இரத்தக் காயம் ஒப்பனை (Level 2)',
  'wet hair prep': 'மழைக்கால ஈர முடி & உடல் ஒப்பனை',
  'wound': 'வெட்டுக் காயம் ஒப்பனை',

  // Camera & Grip
  'technocrane': '30 அடி டெக்னோகிரேன் கேமரா அமைப்பு',
  'steadicam': 'ஸ்டெடிகாம் கேமரா அமைப்பு',
  'high speed camera': 'அதிவேக கேமரா (Phantom 240 FPS)',
  'night lighting': 'இரவு நேர HMI நிலா வெளிச்ச விளக்குகள்',
  'drone': 'ட்ரோன் வான்வழி கேமரா',

  // Production Departments
  'cast': 'நடிகர்கள்',
  'extras': 'துணை நடிகர்கள் / கூட்டம்',
  'stunts': 'சண்டைப் பயிற்சி / ஆக்ஷன்',
  'vehicles': 'வாகனங்கள்',
  'props': 'பொருட்கள் (Props)',
  'sfx': 'சிறப்பு விளைவுகள் (SFX)',
  'wardrobe': 'உடைகள்',
  'makeup': 'ஒப்பனை & சிகை அலங்காரம்',
  'animals': 'விலங்குகள்',
  'sound': 'ஒலி & இசை குறிப்புகள்',
  'set_dressing': 'அரங்க அலங்காரம்',
  'greenery': 'தாவரங்கள் & பூக்கள்',
  'special_equipment': 'சிறப்பு கேமரா உபகரணங்கள்',
  'lighting_grip': 'விளக்கு & கிரிப் அமைப்புகள்',
  'safety': 'பாதுகாப்பு ஏற்பாடுகள்',

  // Slugs
  'int': 'உள் (INT)',
  'ext': 'வெளி (EXT)',
  'int/ext': 'உள்/வெளி (INT/EXT)',
  'night': 'இரவு (NIGHT)',
  'day': 'பகல் (DAY)',
  'dawn': 'விடியல் (DAWN)',
  'dusk': 'மாலை (DUSK)',
};

/**
 * Translates any item name to pure Tamil.
 */
export function translateToTamil(text?: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Direct exact match
  if (DICTIONARY[lower]) {
    return DICTIONARY[lower];
  }

  // Substring match
  for (const [key, val] of Object.entries(DICTIONARY)) {
    if (lower === key) return val;
  }

  // Already contains Tamil characters
  if (/[\u0B80-\u0BFF]/.test(trimmed)) {
    return trimmed;
  }

  // Common replacements
  let res = trimmed;
  if (/machete/i.test(res)) return 'கனத்த இரும்பு அரிவாள்';
  if (/sword|blade/i.test(res)) return 'பட்டாக் கத்தி / வாள்';
  if (/gun|pistol/i.test(res)) return 'துப்பாக்கி';
  if (/knife/i.test(res)) return 'கத்தி';
  if (/crowd|extras|devotees/i.test(res)) return 'கோயில் திருவிழாக் கூட்டம்';
  if (/police/i.test(res)) return 'காவல்துறை அதிகாரிகள்';
  if (/stunt|fight/i.test(res)) return 'சண்டைப் பயிற்சி & ஆக்ஷன்';
  if (/rain/i.test(res)) return 'மழை இயந்திரம்';
  if (/blood/i.test(res)) return 'இரத்தக் காயம் ஒப்பனை';
  if (/crane/i.test(res)) return 'கேமரா கிரேன்';
  if (/lighting/i.test(res)) return 'இரவு நேர விளக்கு அமைப்பு';
  if (/car|jeep|vehicle/i.test(res)) return 'படப்பிடிப்பு வாகனம்';
  if (/aadhi/i.test(res)) return 'ஆதி';
  if (/rathinam/i.test(res)) return 'ரத்தினம்';

  return trimmed;
}

/**
 * Translates item description to Tamil.
 */
export function translateDescriptionToTamil(desc?: string): string {
  if (!desc) return '';
  const trimmed = desc.trim();
  if (/[\u0B80-\u0BFF]/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('speaking character')) return 'காட்சியில் பேசும் முதன்மைக் கதாபாத்திரம்';
  if (lower.includes('action prop') || lower.includes('held or used')) return 'நடிகர் பயன்படுத்தும் ஆக்ஷன் பொருள்';
  if (lower.includes('stunt') || lower.includes('fight') || lower.includes('combat')) return 'பாதுகாப்பு அட்டையுடன் கூடிய சண்டைக் காட்சி';
  if (lower.includes('lighting') || lower.includes('night ambience')) return 'இரவு நேர சூழல் மற்றும் விளக்கு அமைப்பு';
  if (lower.includes('wet') || lower.includes('blood')) return 'மழைக்கால ஈரப்பத ஒப்பனை மற்றும் காயம்';
  if (lower.includes('crowd') || lower.includes('background')) return 'பின்னணி துணை நடிகர்கள் கூட்டம்';

  return translateToTamil(trimmed);
}

/**
 * Translates INT/EXT to Tamil
 */
export function translateIntExtToTamil(intExt: string): string {
  const upper = (intExt || '').toUpperCase();
  if (upper.includes('உள்') || upper.includes('வெளி')) return intExt;
  if (upper.includes('INT') && upper.includes('EXT')) return 'உள்/வெளி (INT/EXT)';
  if (upper.includes('INT')) return 'உள் (INT)';
  if (upper.includes('EXT')) return 'வெளி (EXT)';
  return intExt;
}

/**
 * Translates Time of Day to Tamil
 */
export function translateTimeOfDayToTamil(time: string): string {
  const upper = (time || '').toUpperCase();
  if (/[\u0B80-\u0BFF]/.test(time)) return time;
  if (upper.includes('NIGHT')) return 'இரவு (NIGHT)';
  if (upper.includes('DAY')) return 'பகல் (DAY)';
  if (upper.includes('DAWN')) return 'விடியல் (DAWN)';
  if (upper.includes('DUSK')) return 'மாலை (DUSK)';
  return time;
}

/**
 * Translates Scene Location to Tamil
 */
export function translateLocationToTamil(loc: string): string {
  if (!loc) return '';
  if (/[\u0B80-\u0BFF]/.test(loc)) return loc;

  const lower = loc.toLowerCase();
  if (lower.includes('temple')) return 'மதுரை மீனாட்சி அம்மன் கோயில் வீதி';
  if (lower.includes('warehouse') || lower.includes('mill')) return 'பழைய நெல் கிடங்கு / ஆலை';
  if (lower.includes('bridge') || lower.includes('river')) return 'வைகை ஆற்றுப் பாலம்';
  if (lower.includes('vault') || lower.includes('corridor')) return 'பாதுகாப்பு பெட்டக தாழ்வாரம்';
  if (lower.includes('office') || lower.includes('room')) return 'அலுவலக அறை';

  return loc;
}
