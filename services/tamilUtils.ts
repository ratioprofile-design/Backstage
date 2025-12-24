// A robust phonetic map for English to Tamil with Dictionary Support

// --- DICTIONARY ---
// Comprehensive list of colloquial words, verb forms, and screenplay terms (Top 500+ Frequency Weighted)
const DICTIONARY: Record<string, string[]> = {
  // --- 1. PRONOUNS & PERSONS (HIGH FREQUENCY) ---
  "nan": ["நான்"], "naan": ["நான்"], "en": ["என்"], "ennoda": ["என்னோட"], "enakku": ["எனக்கு"], "ennai": ["என்னை"], "enkitta": ["என்கிட்ட"],
  "nee": ["நீ"], "un": ["உன்"], "unnoda": ["உன்னோட"], "unakku": ["உனக்கு"], "unnai": ["உன்னை"], "unkitta": ["உன்கிட்ட"],
  "neenga": ["நீங்க"], "neengal": ["நீங்கள்"], "ungal": ["உங்கள்"], "ungaloda": ["உங்களோட"], "ungalukku": ["உங்களுக்கு"],
  "avan": ["அவன்"], "avanoda": ["அவனோட"], "avanukku": ["அவனுக்கு"], "avanai": ["அவனை"],
  "ivan": ["இவன்"], "ivanoda": ["இவனோட"], "ivanukku": ["இவனுக்கு"],
  "avar": ["அவர்"], "ivar": ["இவர்"],
  "ava": ["அவ", "அவள்"], "aval": ["அவள்"], "avaloda": ["அவளோட"], "avalukku": ["அவளுக்கு"],
  "iva": ["இவ", "இவள்"], "ival": ["இவள்"],
  "adhu": ["அது"], "adhukku": ["அதுக்கு"], "adhnala": ["அதுனால"], "idhu": ["இது"], "idhukku": ["இதுக்கு"],
  "avanga": ["அவங்க"], "avargal": ["அவர்கள்"], "ivanga": ["இவங்க"],
  "nanga": ["நாங்க"], "naangal": ["நாங்கள்"], "nam": ["நாம்"], "namma": ["நம்ம"], "namakku": ["நமக்கு"],
  "yar": ["யார்"], "yaru": ["யாரு"], "yarkitta": ["யார்கிட்ட"], "yaroda": ["யாரோட"], "yarukku": ["யாருக்கு"],
  "ellam": ["எல்லாம்"], "ellarum": ["எல்லாரும்"],
  "oru": ["ஒரு"], "oruthar": ["ஒருத்தர்"], "oruthana": ["ஒருத்தன"],

  // --- 2. QUESTIONS (INTERROGATIVES) ---
  "enna": ["என்ன"], "ennada": ["என்னடா"], "ennadi": ["என்னடி"], "ennachu": ["என்னாச்சு"],
  "ethu": ["எது"], "ethukku": ["எதுக்கு"], "ethnal": ["எதுனால"],
  "eppo": ["எப்போ", "எப்ப"], "eppadi": ["எப்படி"], "epdi": ["எப்படி"],
  "enga": ["எங்க"], "engay": ["எங்கே"], "engayo": ["எங்கேயோ"],
  "yen": ["ஏன்"], "yenna": ["ஏன்னா"],
  "evlo": ["எவ்ளோ"], "evalavu": ["எவ்வளவு"],
  "vandhaayaa": ["வந்தாயா"], "poniyaa": ["போனியா"], "sonniyaa": ["சொன்னியா"],
  "paarththiyaa": ["பார்த்தியா"], "kettiyaa": ["கேட்டியா"], 
  "theriyumaa": ["தெரியுமா"], "sariyaaa": ["சரியா"], "appadiyaa": ["அப்படியா"],
  "ama": ["ஆமா"], "aama": ["ஆமா"], "illaya": ["இல்லையா"],

  // --- 3. VERBS: EXISTENCE & STATE (IRU) ---
  "iru": ["இரு"], "irukku": ["இருக்கு"], "illa": ["இல்ல"], "illai": ["இல்லை"],
  "iruken": ["இருக்கேன்"], "irukka": ["இருக்கா"], "irukkirom": ["இருக்கிறோம்"], "irukanga": ["இருக்காங்க"],
  "irundhen": ["இருந்தேன்"], "irundhadhu": ["இருந்தது"], "irundha": ["இருந்தா"],
  "iruppen": ["இருப்பேன்"], "irukkum": ["இருக்கும்"],

  // --- 4. VERBS: MOVEMENT (VAA / PO) ---
  "va": ["வா"], "vaa": ["வா"], "vanga": ["வாங்க"], 
  "varen": ["வறேன்"], "varuva": ["வருவா"], "varum": ["வரும்"],
  "vandhen": ["வந்தேன்"], "vandhan": ["வந்தான்"], "vandha": ["வந்தா"], "vandhuta": ["வந்துட்டா"], "vandhchu": ["வந்துச்சு"],
  "po": ["போ"], "ponga": ["போங்க"], 
  "poren": ["போறேன்"], "poran": ["போறான்"], "pogum": ["போகும்"],
  "ponen": ["போனேன்"], "ponan": ["போனான்"], "pona": ["போனா", "போன"], "poita": ["போயிட்டா"], "pochu": ["போச்சு"],

  // --- 5. VERBS: COMMUNICATION (SOL / PESU / KELU) ---
  "sollu": ["சொல்லு"], "sol": ["சொல்"], "sollunga": ["சொல்லுங்க"],
  "solren": ["சொல்றேன்"], "solluven": ["சொல்லுவேன்"],
  "sonnen": ["சொன்னேன்"], "sonna": ["சொன்னா", "சொன்ன"], "sonnan": ["சொன்னான்"],
  "pesu": ["பேசு"], "pesunga": ["பேசுங்க"], "pesuren": ["பேசுறேன்"], "pesinen": ["பேசினேன்"],
  "kelu": ["கேளு"], "kelunga": ["கேளுங்க"], "kekuren": ["கேக்குறேன்"], "ketten": ["கேட்டேன்"], "keta": ["கேட்டா"],
  "koopidu": ["கூப்பிடு"], "kathu": ["கத்து"],

  // --- 6. VERBS: ACTION (PANNU / SEI / EDU / KUDU / VAI) ---
  "pannu": ["பண்ணு"], "pannunga": ["பண்ணுங்க"], "panren": ["பண்றேன்"], "pannen": ["பண்ணேன்"], "pannuven": ["பண்ணுவேன்"],
  "sei": ["செய்"], "seiyanum": ["செய்யணும்"],
  "edu": ["எடு"], "edunga": ["எடுங்க"], "eduthu": ["எடுத்து"], "edukuren": ["எடுக்குறேன்"],
  "kodu": ["கொடு"], "kudu": ["குடு"], "kudunga": ["குடுங்க"], "kudukuren": ["குடுக்குறேன்"], "kuduthen": ["குடுத்தேன்"],
  "vai": ["வை"], "vainga": ["வைங்க"], "vechuruken": ["வச்சிருக்கேன்"],

  // --- 7. VERBS: SENSES & COGNITION (PAAR / NINA / THERI / PURI) ---
  "paaru": ["பாரு"], "parunga": ["பாருங்க"], "paar": ["பார்"],
  "pakuren": ["பாக்குறேன்"], "pathen": ["பாத்தேன்"], "patha": ["பாத்தா"], "pathukalam": ["பாத்துக்கலாம்"],
  "ninai": ["நினை"], "nenaikiren": ["நினைக்கிறேன்"], "nenachen": ["நினைச்சேன்"],
  "theriyum": ["தெரியும்"], "theriyadhu": ["தெரியாது"], "theriyala": ["தெரியல"], "therinjiduchu": ["தெரிஞ்சுடுச்சு"],
  "puriyum": ["புரியும்"], "puriyadhu": ["புரியாது"], "puriyala": ["புரியல"], "purinjiduchu": ["புரிஞ்சிடுச்சு"],
  "yosi": ["யோசி"], "yosikira": ["யோசிக்கிற"],

  // --- 8. VERBS: DAILY LIFE (SAPDU / THOONGU / ODU / NADA) ---
  "saapidu": ["சாப்பிடு"], "sapdu": ["சாப்பிடு"], "sapdunga": ["சாப்பிடுங்க"],
  "sapdren": ["சாப்பிடுறேன்"], "sapten": ["சாப்பிட்டேன்"], "saptiya": ["சாப்பிட்டியா"],
  "thoongu": ["தூங்கு"], "thoongunga": ["தூங்குங்க"], "thoonguren": ["தூங்குறேன்"],
  "elundhu": ["எழுந்துரு"], "elundhukko": ["எழுந்துக்கோ"],
  "odu": ["ஓடு"], "nada": ["நட"], "nadakuthu": ["நடக்குது"], "nadanthuchu": ["நடந்துச்சு"],
  "ukkaru": ["உக்காரு"], "nillu": ["நில்லு"],

  // --- 9. MODALS & NEGATION (WANT / CAN / NOT) ---
  "venum": ["வேணும்"], "vendam": ["வேண்டாம்"], "venam": ["வேணாம்"],
  "mudiyum": ["முடியும்"], "mudiyadhu": ["முடியாது"], "mudiyala": ["முடியல"],
  "pidikkum": ["பிடிக்கும்"], "pidikkadhu": ["பிடிக்காது"], "pidikkala": ["பிடிக்கல"],
  "kidayathu": ["கிடையாது"], "matten": ["மாட்டேன்"], "mattum": ["மட்டும்"],
  "koodathu": ["கூடாது"],
  "varala": ["வரல"], "pogala": ["போகல"], "sollala": ["சொல்லல"], "pannala": ["பண்ணல"],

  // --- 10. TIME (HIGH FREQUENCY) ---
  "ippo": ["இப்போ", "இப்ப"], "appo": ["அப்போ", "அப்ப"],
  "inniki": ["இன்னைக்கு"], "naalaiki": ["நாளைக்கு"], "nethu": ["நேத்து"],
  "kaalai": ["காலை"], "maalai": ["மாலை"], "rathiri": ["ராத்திரி"], "night": ["நைட்"],
  "mani": ["மணி"], "neram": ["நேரம்"], "seekkiram": ["சீக்கிரம்"], "medhuva": ["மெதுவா"],
  "appram": ["அப்புறம்"], "munnadi": ["முன்னாடி"], "pinnadi": ["பின்னாடி"],
  "epovume": ["எப்பவுமே"], "ippothaikku": ["இப்போதைக்கு"],

  // --- 11. PLACE & DIRECTION ---
  "inga": ["இங்க"], "anga": ["அங்க"],
  "veedu": ["வீடு"], "veetla": ["வீட்ல"], "veetukku": ["வீட்டுக்கு"],
  "ooru": ["ஊரு"], "oorla": ["ஊர்ல"],
  "veliya": ["வெளிய"], "ulla": ["உள்ள"],
  "mela": ["மேல"], "keela": ["கீழ"],
  "pakkam": ["பக்கம்"], "dhooram": ["தூரம்"],
  "office": ["ஆபீஸ்"], "school": ["ஸ்கூல்"], "chennai": ["சென்னை"],

  // --- 12. RELATIONS (FAMILY & SOCIAL) ---
  "amma": ["அம்மா"], "appa": ["அப்பா"], "thambi": ["தம்பி"], "annan": ["அண்ணன்"],
  "akka": ["அக்கா"], "thangachi": ["தங்கச்சி"], "thangai": ["தங்கை"],
  "mama": ["மாமா"], "machi": ["மச்சி"], "machan": ["மச்சான்"], 
  "nanban": ["நண்பன்"], "friend": ["நண்பன்", "ப்ரெண்ட்"], "dosth": ["தோஸ்த்"],
  "pondatti": ["பொண்டாட்டி"], "purushan": ["புருஷன்"], "manaivi": ["மனைவி"], "kanavan": ["கணவன்"],
  "kudumbam": ["குடும்பம்"], "family": ["குடும்பம்"], "paiyan": ["பையன்"], "ponnu": ["பொண்ணு"],
  "sir": ["சார்"], "madam": ["மேடம்"], "thalaiva": ["தலைவா"], "thala": ["தல"],

  // --- 13. ADJECTIVES & ADVERBS ---
  "nalla": ["நல்ல"], "nallarku": ["நல்லா இருக்கு"], "super": ["சூப்பர்"],
  "ketta": ["கெட்ட", "கேட்ட"], "mosam": ["மோசம்"],
  "periya": ["பெரிய"], "chinna": ["சின்ன"],
  "puthu": ["புது"], "pazhaya": ["பழைய"],
  "azhagu": ["அழகு"], "alaga": ["அழகா"],
  "romba": ["ரொம்ப"], "konjam": ["கொஞ்சம்"], "neraya": ["நிறைய"],
  "suma": ["சும்மா"], "thirumba": ["திரும்ப"], "marubadiyum": ["மறுபடியும்"],
  "kandippa": ["கண்டிப்பா"], "nichayama": ["நிச்சயமா"],
  "unmai": ["உண்மை"], "poi": ["பொய்"],

  // --- 14. CONNECTORS & FILLERS ---
  "aana": ["ஆனா"], "but": ["ஆனா"],
  "adhunala": ["அதுனால"], "so": ["சோ", "அதுனால"],
  "because": ["ஏன்னா"],
  "adhukkapuram": ["அதுக்கப்புறம்"],
  "sari": ["சரி"], "seri": ["சரி"], "ok": ["சரி"], "saridhaan": ["சரிதான்"],
  "paravala": ["பரவாயில்லை", "பரவால்ல"],
  "podhum": ["போதும்"], "podhume": ["போதுமே"],

  // --- 15. COMMON NOUNS ---
  "thanni": ["தண்ணி"], "saapadu": ["சாப்பாடு"], "soru": ["சோறு"], "kaapi": ["காபி"], "tea": ["டீ"],
  "vandi": ["வண்டி"], "car": ["கார்"], "bike": ["பைக்"], "bus": ["பஸ்"],
  "phone": ["போன்"], "panam": ["பணம்"], "kaasu": ["காசு"], "rubai": ["ரூபாய்"],
  "prachanai": ["பிரச்சனை"], "problem": ["பிரச்சனை"], "vishayam": ["விஷயம்"],
  "kalyanam": ["கல்யாணம்"], "kadhal": ["காதல்"], "love": ["காதல்"],
  "mazhai": ["மழை"], "veyil": ["வெயில்"],
  "kai": ["கை"], "kaal": ["கால்"], "kann": ["கண்"], "thalai": ["தலை"], "manasu": ["மனசு"],

  // --- 16. NUMBERS ---
  "onnu": ["ஒண்ணு"], "rendu": ["ரெண்டு"], "moonu": ["மூணு"],
  "naalu": ["நாலு"], "anju": ["அஞ்சு"], "aaru": ["ஆறு"], "yezhu": ["ஏழு"], "ettu": ["எட்டு"], "onbathu": ["ஒன்பது"], "pathu": ["பத்து"],
  "nooru": ["நூறு"], "aayiram": ["ஆயிரம்"], "laksham": ["லட்சம்"], "kodi": ["கோடி"],
  "mudhal": ["முதல்"], "rendavathu": ["ரெண்டாவது"],

  // --- 17. EMOTIONS & EXCLAMATIONS ---
  "kovam": ["கோபம்"], "santhosham": ["சந்தோஷம்"], "bayam": ["பயம்"],
  "aiyo": ["ஐயோ"], "aiyyo": ["ஐயோ"], "ada": ["அட"], "adadaa": ["அடடா"], "cha": ["சே"],
  "dei": ["டேய்"], "da": ["டா"], "di": ["டி"],

  // --- 18. COMPLEX FORMS / SANDHI ---
  "vandhadhunaala": ["வந்ததுனால"], "sonnadhukkapuram": ["சொன்னதுக்கப்புறம்"],
  "paarththadhaala": ["பார்த்ததால"], "kettavudan": ["கேட்டவுடன்"],
  "ponapiragu": ["போனபிறகு"], "panninadhukku": ["பண்ணினதுக்கு"],
  "nadandhadhukkapuram": ["நடந்ததுக்குப்புறம்"],
  "vandhaale": ["வந்தாலே"], "ponaale": ["போனாலே"], "sonnaale": ["சொன்னாலே"],
  "kettaale": ["கேட்டாலே"], "paarthaale": ["பார்த்தாலே"], "nadandhaale": ["நடந்தாலே"],
  
  // --- 19. PHONETIC VARIANTS (ERROR CORRECTION) ---
  "vanda": ["வந்த"], "wantha": ["வந்த"],
  "paartha": ["பார்த்த"],
  "saptia": ["சாப்பிட்டியா"], "saptiyaa": ["சாப்பிட்டியா"],
  "varlai": ["வரல"],
  "therila": ["தெரியல"], 
  "purila": ["புரியல"]
};

const VOWELS: Record<string, string> = {
  'a': 'அ', 'aa': 'ஆ', 'A': 'ஆ', 'i': 'இ', 'ii': 'ஈ', 'I': 'ஈ',
  'u': 'உ', 'uu': 'ஊ', 'U': 'ஊ', 'e': 'எ', 'ee': 'ஏ', 'E': 'ஏ',
  'ai': 'ஐ', 'o': 'ஒ', 'oo': 'ஓ', 'O': 'ஓ', 'au': 'ஔ', 'ou': 'ஔ'
};

const VOWEL_SIGNS: Record<string, string> = {
  'a': '', 'aa': 'ா', 'A': 'ா', 'i': 'ி', 'ii': 'ீ', 'I': 'ீ',
  'u': 'ு', 'uu': 'ூ', 'U': 'ூ', 'e': 'ெ', 'ee': 'ே', 'E': 'ே',
  'ai': 'ை', 'o': 'ஒ', 'oo': 'ோ', 'O': 'ோ', 'au': 'ௌ', 'ou': 'ௌ'
};

const CONSONANTS: Record<string, string> = {
  'sri': 'ஸ்ரீ', 'ksh': 'க்ஷ்', 'sh': 'ஷ்', 'ss': 'ஸ்', 's': 'ஸ்',
  'h': 'ஹ்', 'j': 'ஜ்',
  'ng': 'ங்', 'nj': 'ஞ்', 
  'n': 'ன்', 'N': 'ண்', 'nh': 'ந்', 'gn': 'ஞ்',
  'm': 'ம்',
  'zh': 'ழ்', 'z': 'ழ்', 'Z': 'ழ்',
  'l': 'ல்', 'L': 'ள்',
  'r': 'ர்', 'R': 'ற்',
  'y': 'ய்', 'v': 'வ்', 'w': 'வ்',
  'th': 'த்', 'dh': 'த்', 
  't': 'ட்', 'T': 'ட்', 'd': 'ட்', 'D': 'ட்',
  'p': 'ப்', 'b': 'ப்',
  'k': 'க்', 'g': 'க்', 'c': 'க்', 'q': 'க்',
  'ch': 'ச்' 
};

// Map base forms
const BASE_CONSONANTS: Record<string, string> = {};
Object.entries(CONSONANTS).forEach(([eng, tam]) => {
    if (tam.endsWith('்')) BASE_CONSONANTS[tam] = tam.slice(0, -1);
    else BASE_CONSONANTS[tam] = tam;
});
BASE_CONSONANTS['ற்'] = 'ற';
BASE_CONSONANTS['ன்'] = 'ன';

export function toTamil(text: string): string {
  // Check exact dictionary match first
  const lower = text.toLowerCase();
  if (DICTIONARY[lower]) return DICTIONARY[lower][0];
  return convert(text, {});
}

export function generateTamilSuggestions(text: string, userDictionary: Record<string, string[]> = {}): string[] {
  const candidates = new Set<string>();
  const lowerText = text.toLowerCase();

  // 0. User Dictionary Matches (Highest Priority & Learned)
  if (userDictionary[lowerText]) {
      userDictionary[lowerText].forEach(w => candidates.add(w));
  }

  // 1. Exact Dictionary Matches
  if (DICTIONARY[lowerText]) {
      DICTIONARY[lowerText].forEach(w => candidates.add(w));
  }

  // 2. Prefix Dictionary Matches (Prediction)
  // Only if text length > 1 to avoid noisy single letter matches
  if (lowerText.length > 1) {
      const matches = Object.keys(DICTIONARY).filter(k => k.startsWith(lowerText) && k !== lowerText);
      // Sort by length (shortest match is likely what they want)
      matches.sort((a, b) => a.length - b.length);
      matches.slice(0, 4).forEach(k => {
          DICTIONARY[k].forEach(w => candidates.add(w));
      });
  }

  // 3. Phonetic Generation (Fallback & Variations)
  // Always include the literal conversion as a fallback
  candidates.add(convert(text, {}));
  
  // 4. Generate variants for common ambiguities
  if (lowerText.includes('n')) {
      candidates.add(convert(text, { forceN: 'ந்' })); 
      candidates.add(convert(text, { forceN: 'ண்' })); 
      candidates.add(convert(text, { forceN: 'ன்' }));
  }
  if (lowerText.includes('l')) {
      candidates.add(convert(text, { forceL: 'ள்' }));
      candidates.add(convert(text, { forceL: 'ழ்' }));
      candidates.add(convert(text, { forceL: 'ல்' }));
  }
  if (lowerText.includes('r')) {
      candidates.add(convert(text, { forceR: 'ற்' }));
  }
  if (lowerText.includes('t') && !lowerText.includes('th')) {
      candidates.add(convert(text, { forceT: 'த்' }));
  }
  if (lowerText.includes('s') && !lowerText.includes('sh')) {
       candidates.add(convert(text, { forceS: 'ச்' }));
  }

  // Ensure we don't return too many. Dictionary hits come first.
  return Array.from(candidates).slice(0, 9);
}

interface ConvertOptions {
    forceN?: string;
    forceL?: string;
    forceR?: string;
    forceT?: string;
    forceS?: string;
}

function convert(text: string, opts: ConvertOptions): string {
  let res = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    let match3 = text.substr(i, 3);
    let match2 = text.substr(i, 2);
    let match1 = text[i];
    
    let consKey = '';
    let consVal = '';
    let consLen = 0;

    if (CONSONANTS[match3]) { consKey = match3; consVal = CONSONANTS[match3]; consLen = 3; }
    else if (CONSONANTS[match2]) { consKey = match2; consVal = CONSONANTS[match2]; consLen = 2; }
    else if (CONSONANTS[match1]) { consKey = match1; consVal = CONSONANTS[match1]; consLen = 1; }

    if (consKey) {
        const isDouble = (i + consLen < len) && (text[i + consLen] === text[i]);
        
        if ((consKey === 'n' || consKey === 'N') && !['ng', 'nj', 'nh'].includes(match2)) {
            if (opts.forceN) consVal = opts.forceN + '्';
            else {
                if (i === 0) consVal = 'ந்' + '्';
                else if (i === len - 1 && !isDouble) consVal = 'ன்' + '्';
                else if (match2 === 'nn') { consVal = 'ண்' + '्'; }
                else if (match2 === 'nd') { consVal = 'ண்' + '्'; }
                else if (match2 === 'nt') { consVal = 'ந்' + '्'; }
                else consVal = 'ன' + '्';
            }
            consVal = consVal.replace('्', '');
        }

        if ((consKey === 'l' || consKey === 'L') && opts.forceL) consVal = opts.forceL;
        if ((consKey === 'r' || consKey === 'R') && opts.forceR) consVal = opts.forceR;
        if ((consKey === 't' || consKey === 'T') && opts.forceT) consVal = opts.forceT;
        if ((consKey === 's') && opts.forceS) consVal = opts.forceS;

        i += consLen;
        let vMatch2 = text.substr(i, 2);
        let vMatch1 = text[i];
        let vSign = undefined;
        let vLen = 0;

        if (VOWEL_SIGNS[vMatch2] !== undefined) { vSign = VOWEL_SIGNS[vMatch2]; vLen = 2; }
        else if (VOWEL_SIGNS[vMatch1] !== undefined) { vSign = VOWEL_SIGNS[vMatch1]; vLen = 1; }

        if (vSign !== undefined) {
            const base = BASE_CONSONANTS[consVal] || consVal;
            res += base + vSign;
            i += vLen;
        } else {
            res += consVal;
        }
    } else {
        if (VOWELS[match2]) { res += VOWELS[match2]; i += 2; }
        else if (VOWELS[match1]) { res += VOWELS[match1]; i += 1; }
        else {
            res += match1;
            i += 1;
        }
    }
  }
  return res;
}