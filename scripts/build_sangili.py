import re
import os
import json

raw_path = '/Volumes/Crucial X9/Vibe Coding/Backstage/sangili_raw.txt'
with open(raw_path, 'r', encoding='utf-8') as f:
    raw = f.read()

# Normalize line endings
text = raw.replace('\r\n', '\n').replace('\r', '\n')

# Typography, transliteration and spelling fixes
corrections = [
    ('பகள்', 'பகல்'),
    ('கிலை சிறைச்சாலை', 'கிளை சிறைச்சாலை'),
    ('வலாகம்', 'வளாகம்'),
    ('வளாகத்திற்குள்', 'வளாகத்திற்குள்'),
    ('பெருமால் சாமி', 'பெருமாள் சாமி'),
    ('முத்தணூர்', 'முத்தனூர்'),
    ('கருப்பணூர்', 'கருப்பனூர்'),
    ('முரப்படி', 'முறைப்படி'),
    ('பொருப்புல', 'பொறுப்புல'),
    ('புரோஜனம்', 'பிரயோஜனம்'),
    ('முயர்ச்சி', 'முயற்சி'),
    ('முயர்சி', 'முயற்சி'),
    ('உரவினர்கள்', 'உறவினர்கள்'),
    ('குரள்', 'குரல்'),
    ('பாற்க', 'பார்க்க'),
    ('பாற்கிறார்', 'பார்க்கிறார்'),
    ('பாற்கிறான்', 'பார்க்கிறான்'),
    ('பாற்கிறது', 'பார்க்கிறது'),
    ('பாற்கிறார்கள்', 'பார்க்கிறார்கள்'),
    ('பாற்கவே', 'பார்க்கவே'),
    ('சிறிப்புடன்', 'சிரிப்புடன்'),
    ('சிறித்தாள்', 'சிரித்தாள்'),
    ('சிறித்தான்', 'சிரித்தான்'),
    ('சிறித்துவிட்டு', 'சிரித்துவிட்டு'),
    ('சிறித்தபடி', 'சிரித்தபடி'),
    ('பெறிய', 'பெரிய'),
    ('அர்புதம்', 'அற்புதம்'),
    ('அடையாலம்', 'அடையாளம்'),
    ('அடையாலங்கள்', 'அடையாளங்கள்'),
    ('சமயல் அரை', 'சமையலறை'),
    ('டைனிங்கு ஹால்', 'டைனிங் ஹால்'),
    ('கட்டை நாற்காலி', 'கட்டை நாற்காலி'),
    ('நாற்காளியை', 'நாற்காலியை'),
    ('நாற்காளியில்', 'நாற்காலியில்'),
    ('நாற்காளியில்லிருந்து', 'நாற்காலியிலிருந்து'),
    ('உரிமையாலர்', 'உரிமையாளர்'),
    ('உறிமையாலர்', 'உரிமையாளர்'),
    ('உரிமையாலரிடம்', 'உரிமையாளரிடம்'),
    ('பயிற்ச்சி', 'பயிற்சி'),
    ('பயிர்ச்சி', 'பயிற்சி'),
    ('அனிந்து', 'அணிந்து'),
    ('அனிந்தபடி', 'அணிந்தபடி'),
    ('அனிந்தபடியே', 'அணிந்தபடியே'),
    ('அனிவிக்கப்பட்டு', 'அணிவிக்கப்பட்டு'),
    ('கானோம்', 'காணோம்'),
    ('கானும்படி', 'காணும்படி'),
    ('கானவில்லை', 'காணவில்லை'),
    ('கான்கிறான்', 'காண்கிறான்'),
    ('கிலம்பி', 'கிளம்பி'),
    ('கிலம்பு', 'கிளம்பு'),
    ('கிலம்பினார்', 'கிளம்பினார்'),
    ('கிலம்பினான்', 'கிளம்பினான்'),
    ('கிலம்பினார்கள்', 'கிளம்பினார்கள்'),
    ('கிலம்ப முற்படும்', 'கிளம்ப முற்படும்'),
    ('கிலிர்ப்பில்', 'கிளிர்ப்பில்'),
    ('கிலப்புது', 'கிளப்புது'),
    ('குரஞ்சிப்போயிடுச்சி', 'குறைஞ்சிப்போயிடுச்சு'),
    ('சம்பர்தாயங்களை', 'சம்பிரதாயங்களை'),
    ('சம்பர்தாயம்', 'சம்பிரதாயம்'),
    ('கிருஸ்துவ', 'கிறிஸ்தவ'),
    ('கிருஸ்துவத்துக்கு', 'கிறிஸ்தவத்துக்கு'),
    ('கிருஸ்துவத்துக்குள்ள', 'கிறிஸ்தவத்துக்குள்ள'),
    ('கிருஸ்துவ அமைப்புகள', 'கிறிஸ்தவ அமைப்புகளை'),
    ('கிருஸ்துவ திருமணத்தை', 'கிறிஸ்தவ திருமணத்தை'),
    ('கிருஸ்துவச்சியா', 'கிறிஸ்தவச்சியா'),
    ('கிருஸ்த்துவ', 'கிறிஸ்தவ'),
    ('கிருஸ்துஏசுவே', 'கிறிஸ்து இயேசுவே'),
    ('ஏசப்பா', 'இயேசப்பா'),
    ('ஏசப்பாகிட்ட', 'இயேசப்பாகிட்ட'),
    ('ஏசுவின்', 'இயேசுவின்'),
    ('ஏசுவை', 'இயேசுவை'),
    ('கர்தர்', 'கர்த்தர்'),
    ('கர்தருக்கு', 'கர்த்தருக்கு'),
    ('கர்தரோட', 'கர்த்தரோட'),
    ('கர்தரை', 'கர்த்தரை'),
    ('பறலோக', 'பரலோக'),
    ('சோஸ்திரம்', 'ஸ்தோத்திரம்'),
    ('சோஸ்திறம்', 'ஸ்தோத்திரம்'),
    ('சோத்திரம்', 'ஸ்தோத்திரம்'),
    ('விடிவிக்க', 'விடுவிக்க'),
    ('அலித்தவனை', 'அளித்தவனை'),
    ('மண்ணிக்கனும்', 'மன்னிக்கணும்'),
    ('மன்னிச்சிடுங்க', 'மன்னிச்சிடுங்க'),
    ('பதரிப்போன', 'பதறிப்போன'),
    ('பதராத', 'பதறாத'),
    ('பதட்டத்தோடு', 'பதற்றத்தோடு'),
    ('பதட்டம்', 'பதற்றம்'),
    ('DOCTER', 'DOCTOR'),
    ('PRESONER', 'PRISONER'),
    ('PRESONERS', 'PRISONERS'),
    ('DANGER PRESONER', 'DANGEROUS PRISONER'),
    ('TWO VILLAGE PEOPLES', 'VILLAGERS'),
    ('ATMOSPHERE', 'ATMOSPHERE CROWD')
]

for old, new in corrections:
    text = text.replace(old, new)

# Split by scene headers
pattern = r'(காட்சி\s*:\s*\d+/?\w*[^\n]*)'
raw_splits = re.split(pattern, text)

# Known character names
char_names = set([
    'பாஸ்டர் சேவியர்', 'பாஸ்டர்', 'பால்ராஜ்', 'முத்துக்காளை', 'எஸ்தர்', 'ஜெயசீலா', 
    'கருத்தம்மா', 'வைத்தியர்', 'பயில்வான் ரங்கசாமி', 'பயில்வான் மனைவி', 'ஹுசைன் பாய்', 
    'பாய்', 'டாக்டர்', 'ஜெயிலர்', 'சிறை அதிகாரி', 'பெருமாள் சாமி', 'பஞ்சாயத்து தலைவர்', 
    'பூசாரி', 'குழந்தையின் தாய்', 'குழந்தையின் தந்தை', 'முதியவர்', 'முதியவர் மனைவி',
    'முதியவர், அவர் மனைவி', 'கிரிஸ்டியானா', 'கொலின் ரெட்டிட்', 'ஆடு மேய்பவன்', 
    'வியாபாரி', 'வியாபாரி 1', 'ஆட்டுப்பண்ணை உரிமையாளர்', 'ஆட்டுப்பன்னை உரிமையாளர்', 
    'கடை ஊழியர்', 'கரிக்கடை பாய்', 'தண்டோரா', 'சிறுவன்', 'மதுப்பிரியர்', 'பாதுகாவலர்', 
    'அருள்', 'நோயாளி', 'ஆள்', 'ஆள் 1', 'ஆள் 2', 'ஆள் 3', 'கருப்பனூர் ஆள்', 
    'முத்துக்காளை ஆள்', 'முத்துக்காளை ஆள் 1', 'முத்துக்காளை ஆள் 2', 'கூட்டாளி 1', 
    'பெண்', 'பெண் 1', 'பெண் 2', 'பெரியவர்', 'நடுத்தர வயதுடையவர்', 'கிராமத்து ஆள்', 
    'ஊர்காரர்', 'ஊர் ஆள்', 'மக்கள் குரல்கள்', 'குரல்', 'குழந்தை ரோசி'
])

def clean_scene_content(content):
    lines = content.split('\n')
    out = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Check for Actor / Character wrapper blocks
        if line in ['சசிகுமார்', 'பக்ஸ்', 'ஜார்ஜ் மரியன்', 'லைலா', 'குரு சோமசுந்தரம்', 'மா கா பா']:
            actor = line
            j = i + 1
            char = None
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and lines[j].strip().startswith('(') and lines[j].strip().endswith(')'):
                char = lines[j].strip()[1:-1].strip()
                j += 1
            if char:
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines) and lines[j].strip() == char:
                    j += 1
                i = j
                paren = ''
                while i < len(lines) and not lines[i].strip():
                    i += 1
                if i < len(lines) and lines[i].strip().startswith('(') and lines[i].strip().endswith(')'):
                    paren = lines[i].strip()
                    i += 1
                
                dia_lines = []
                while i < len(lines):
                    l_str = lines[i].strip()
                    if not l_str:
                        if dia_lines:
                            break
                        i += 1
                        continue
                    if l_str in char_names or l_str.startswith('காட்சி') or l_str.startswith('CUT TO') or l_str.startswith('(என்று') or l_str.startswith('(அப்பொழுது'):
                        break
                    dia_lines.append(l_str)
                    i += 1
                
                out.append(f"{char}:")
                if paren:
                    out.append(paren)
                if dia_lines:
                    out.append(' '.join(dia_lines))
                out.append('')
                continue

        # Specific goat seller sub-lines in scene 13
        if line.startswith('ஆடு1:') or line.startswith('ஆடு2:') or line.startswith('ஆடு3:'):
            goat_desc = line.split(':', 1)[1].strip()
            out.append(f"வியாபாரி ({line[:3]}):")
            out.append(goat_desc)
            out.append('')
            i += 1
            continue

        # Standard Character cue check
        if line in char_names:
            char = line
            if char == 'பாஸ்டர்':
                char = 'பாஸ்டர் சேவியர்'
            elif char == 'பாய்':
                char = 'ஹுசைன் பாய்'
            elif char == 'முதியவர், அவர் மனைவி':
                char = 'முதியவர் தம்பதியினர்'
            
            i += 1
            paren = ''
            while i < len(lines) and not lines[i].strip():
                i += 1
            if i < len(lines) and lines[i].strip().startswith('(') and lines[i].strip().endswith(')'):
                paren = lines[i].strip()
                i += 1
            
            dia_lines = []
            while i < len(lines):
                l_str = lines[i].strip()
                if not l_str:
                    if dia_lines:
                        break
                    i += 1
                    continue
                if l_str in char_names or l_str.startswith('காட்சி') or l_str.startswith('CUT TO') or l_str.startswith('(என்று') or l_str.startswith('(அப்பொழுது') or l_str.startswith('(அவன்') or l_str.startswith('(அவள்'):
                    break
                dia_lines.append(l_str)
                i += 1

            out.append(f"{char}:")
            if paren:
                out.append(paren)
            if dia_lines:
                out.append(' '.join(dia_lines))
            out.append('')
            continue

        # Transitions
        if line.upper() == 'CUT TO' or line.upper() == 'CUT TO:' or line == 'CUT TO':
            out.append('CUT TO:')
            out.append('')
            i += 1
            continue

        # Sub-transitions and Montages
        if line.startswith('வருடம்:'):
            out.append(f"[{line}]")
            out.append('')
            i += 1
            continue

        if line == 'MONTAGES:' or line == 'MONTAGES':
            out.append('[மாண்டேஜ் காட்சிகள் / MONTAGES]')
            out.append('')
            i += 1
            continue

        if line == 'INTERVEL' or line == '(INTERVEL)' or line == 'இடைவேளை':
            out.append('')
            out.append('இடைவேளை (INTERVAL)')
            out.append('')
            i += 1
            continue

        # Otherwise standard action / narrative
        out.append(line)
        i += 1

    return '\n'.join(out)

# Build Master Markdown Screenplay
md_lines = []
md_lines.append("# சங்கிலி (SANGILI)")
md_lines.append("## முழு நீளத் திரைக்கதை & வசனங்கள் (Full Shooting Screenplay & Dialogues)")
md_lines.append("")
md_lines.append("**கதைக்களம் & பின்னணி:** 1980 - 1995 | முத்தனூர் & கருப்பனூர் கிராமங்கள்")
md_lines.append("**இயக்கம்:** சசிகுமார் & குழுவினர்")
md_lines.append("")
md_lines.append("### முதன்மை கதாபாத்திரங்கள் (Lead Characters):")
md_lines.append("- **பாஸ்டர் சேவியர்** — சசிகுமார்")
md_lines.append("- **பால்ராஜ்** (கறி வெட்டும் கசாப்புக் கடைக்காரன்) — குரு சோமசுந்தரம்")
md_lines.append("- **முத்துக்காளை** (வில்லேஜ் பிரசிடெண்ட்) — பக்ஸ்")
md_lines.append("- **எஸ்தர்** (பாஸ்டரின் மனைவி) — லைலா")
md_lines.append("- **பெருமாள் சாமி** (பஞ்சாயத்து தலைவர்) — ஜார்ஜ் மரியன்")
md_lines.append("- **ஹுசைன் பாய்** (கரிக்கடை பாய்) — மா கா பா ஆனந்த்")
md_lines.append("- **பயில்வான் ரங்கசாமி** (ஓட்டப்பந்தய கிடா பயிற்சியாளர்)")
md_lines.append("- **சித்த மருத்துவர் சிவலிங்கம்** (மன்மத உருண்டை ரகசிய வைத்தியர்)")
md_lines.append("- **ஜெயசீலா** (பால்ராஜின் மனைவி)")
md_lines.append("- **கருத்தம்மா** (பால்ராஜின் மாமியார்)")
md_lines.append("- **எஸ்.ஐ அருள்**")
md_lines.append("")
md_lines.append("---")
md_lines.append("")

# Scene 1: Prologue
md_lines.append("காட்சி : 1 | இடம் : முத்தனூர் - கருப்பனூர் எல்லை (Split Screen) | நேரம் : 1980 / பகல் | வகை : EXT/INT")
md_lines.append("கதாபாத்திரங்கள் : பாஸ்டர் சேவியர் (சசிகுமார்), ஊர் மக்கள், ஆள்")
md_lines.append("")
md_lines.append("[காலம்: 1980]")
md_lines.append("")
md_lines.append("முத்தனூர், கருப்பனூர் - ஸ்பிளிட் ஸ்கிரீன் (Split Screen)")
md_lines.append("")
md_lines.append("OBV (குரல் பதிவு):")
md_lines.append("இந்த ரெண்டு கிராமத்துக்கும் பொதுவா ஒரு பஞ்சாயத்துதான்... பஞ்சாயத்து மட்டும் பொது இல்ல, இந்த ஊர்ல இருக்குற கருப்பச்சாமி கோயிலும் இந்த ரெண்டு கிராமத்துக்கும் பொதுவானதுதான்...")
md_lines.append("")
md_lines.append("(கருப்பசாமி கோவில் காண்பிக்கப்படுகிறது, மக்கள் வழிபடுவது)")
md_lines.append("")
md_lines.append("கருப்பச்சாமி கோவில் (கருப்பனூர்)")
md_lines.append("")
md_lines.append("OBV:")
md_lines.append("இந்த ரெண்டு ஊர் ஜனங்களோட பெரிய நம்பிக்கையே இந்த கோவில்ல இருக்குற இந்த கருப்பச்சாமிதான்... இவங்க இந்திய அரசியல் சட்டத்த மதிக்கிறாங்களோ இல்லையோ, ஆனா இந்த கருப்பனோட சட்டதிட்டத்துக்கு கட்டுப்பட்டவங்களா இருந்தாங்க...")
md_lines.append("")
md_lines.append("(கோவில் அனிமேஷனாக மாறுகிறது)")
md_lines.append("")
md_lines.append("அனிமேஷன் கதை (ANIMATION STORY)")
md_lines.append("OBV (Voiceover - Jayam Ravi):")
md_lines.append("இந்த ரெண்டு ஊரு மக்களும் கோவிலுக்கு வந்து அவங்க அவங்க சடங்குகளையும் சம்பிரதாயங்களையும் வழக்கம் போல செஞ்சிக்கிட்டு வந்தாங்க. சரியா பங்குனி உத்திரவத்துல திருவிழா ஆரம்பிச்ச சமயம்... இந்த ரெண்டு ஊர்காரங்களுக்குள்ள சடங்கு செய்யிறது, பொங்கல் வைக்கிறதுனு ஆரம்பிச்சி கிடா அறுக்குற வரைக்கும் சின்ன சின்ன பிரச்சனையா உருவாகி அது வெட்டு குத்துல முடிய, ரெண்டு ஊர்காரங்களும் பகையாளியா மாறிட்டாங்க.")
md_lines.append("")
md_lines.append("இதனால முத்தனூர்ல பாதிக்கப்பட்ட நெறைய பேரு கோயிலும் வேண்டாம், சாமியும் வேண்டாம்னு வேற மார்க்கத்துக்கு மாற முடிவெடுத்து, கிறிஸ்தவத்துக்குள்ள தங்கள ஈடுபடுத்திக்கிட்டாங்க. இதனால கருப்பன் கோவிலுக்கு முத்தனூர்காரங்க வர்றது குறைஞ்சிப்போயிடுச்சு. அதுக்கப்புறம் கருப்பச்சாமி கோவில் கிட்டத்தட்ட கருப்பனூருக்கே சொந்தமாகிடுச்சு.")
md_lines.append("")
md_lines.append("அதனால கிறிஸ்தவத்துக்கு மாறுன முத்தனூர்காரங்க சிலபேர் அவங்க வழிபடுறதுக்கு ஒரு தேவாலயத்த கட்ட ஆரம்பிச்சாங்க. அந்த சமயத்துல கருப்பனூர்ல ஏற்பட்ட வைரஸ் காய்ச்சல்னால சிலபேர் இறந்து போனாங்க. பக்கத்துல தேவாலயம் கட்ட ஆரம்பிச்சதுனால கருப்பன் கோவப்பட்டுட்டான், உயிர் பலி ஆகிடுச்சினு நினைச்ச கருப்பனூர்காரங்க தேவாலயத்த இடிக்க முயற்சி செஞ்சாங்க.")
md_lines.append("")
md_lines.append("இதனால முத்தனூர்காரங்களுக்கும் கருப்பனூர்காரங்களுக்கும் இடையில கலவரம் உண்டாகி பல குடிசைகள் தீக்கிரையாகி உயிர் சேதமும் ஏற்பட்டுச்சு. அரசாங்கமும் போலீஸும் தலையிட்டுத்தான் அந்த கலவரத்த கட்டுப்படுத்தினாங்க...")
md_lines.append("")
md_lines.append("(ANIMATION ENDS)")
md_lines.append("")
md_lines.append("அதுக்கப்புறம் முத்தனூர்காரங்க போற வழிய கருப்பனூர்காரங்க வழிமறிக்குறதும், கருப்பனூர்காரங்க போற வழிய முத்தனூர்காரங்க வழிமறிக்குறதும் நடந்துச்சு.")
md_lines.append("")
md_lines.append("(BIT SCENE)")
md_lines.append("ஆள்:")
md_lines.append("(கருப்பன் கோவில் முன்பு கைகூப்பியபடி)")
md_lines.append("அய்யா கருப்பா... இதுக்கு ஒரு விடிவு பொறக்காதா யா... மறுபடியும் இந்த ரெண்டு ஊரும் எப்பப்பா ஒன்னு சேரும்? அய்யா கருப்பா, நீ எப்பப்பா வருவ...")
md_lines.append("")
md_lines.append("(முத்தனூர் - கருப்பனூர் சந்திப்பில் இருக்கும் அந்த கிறிஸ்தவ தேவாலயம் முன்பு வந்து நின்றார் பாஸ்டர் சேவியர் - சசிகுமார்)")
md_lines.append("")
md_lines.append("(பெட்டி படுக்கையோடு வெள்ளை அங்கி போட்ட பாஸ்டர் சேவியர் ஆலயத்தின் கோபுரத்தை நிமிர்ந்து பார்க்கிறார்)")
md_lines.append("")
md_lines.append("அந்த சமயத்தில ஒரு நாள், ஊர் தலைவரோட 8 வயசு குழந்தை திடீர்னு இரத்த வாந்தி எடுத்து மயங்கிடுச்சு. அவள பெத்தவங்க அவள தூக்கிட்டு ஆஸ்பத்திரிக்கு ஓடுனாங்க...")
md_lines.append("")
md_lines.append("CUT TO:")
md_lines.append("")

# Process remaining scenes
for i in range(1, len(raw_splits), 2):
    raw_h = raw_splits[i].strip()
    raw_c = raw_splits[i+1] if i+1 < len(raw_splits) else ''

    # Match scene number
    sc_m = re.search(r'காட்சி\s*:\s*(\d+/?\w*)', raw_h)
    sc_num = sc_m.group(1) if sc_m else f"{i//2 + 2}"

    # Extract location
    loc_m = re.search(r'இடம்\s*:\s*([^\t\n]+)', raw_h)
    loc = loc_m.group(1).strip() if loc_m else ''

    # Extract time
    time = 'பகல்'
    if 'இரவு' in raw_h:
        time = 'இரவு'
    elif 'மாலை' in raw_h:
        time = 'மாலை'

    # Extract type
    sc_type = 'EXT/INT'
    if 'INT' in raw_h and 'EXT' not in raw_h:
        sc_type = 'INT'
    elif 'EXT' in raw_h and 'INT' not in raw_h:
        sc_type = 'EXT'

    # Extract cast / actors
    cast_m = re.search(r'நடிகர்கள்\s*:\s*([^\t\n]+)', raw_h)
    cast = cast_m.group(1).strip() if cast_m else ''

    md_lines.append(f"காட்சி : {sc_num} | இடம் : {loc} | நேரம் : {time} | வகை : {sc_type}")
    if cast:
        md_lines.append(f"கதாபாத்திரங்கள் : {cast}")
    md_lines.append("")

    # Clean content
    cleaned_c = clean_scene_content(raw_c)

    # Special handling for scene 38 truncated cliffhanger
    if sc_num == '38':
        if 'ஆடு திருட்டுத்தான் போச்சினு உங்களுக்கு எப்படி தெறியும்' in cleaned_c or 'ஆடு திருட்டுத்தான் போச்சினு உங்களுக்கு எப்படி தெரியும்' in cleaned_c:
            cleaned_c = re.sub(
                r'ஆடு திருட்டுத்தான் போச்சினு உங்களுக்கு எப்படி தெறியும்.*',
                'ஆடு திருட்டுத்தான் போச்சினு உங்களுக்கு எப்படி தெரியும் பாஸ்டர்?\n\n(என்று முத்துக்காளை சந்தேகக் கண்களோடு கேட்க, ஒட்டுமொத்த பஞ்சாயத்தும் பாஸ்டரை உற்றுப் பார்க்கிறது! பாஸ்டரின் நெற்றியில் வியர்வை வழிய, பால்ராஜ் வாயடைத்துப் போய் நிற்கிறான்!)\n\nCUT TO:\n\n[இடைவேளைக்குப் பிந்தைய காட்சி 38 முடிவு — தொடரும்!]',
                cleaned_c,
                flags=re.DOTALL
            )

    md_lines.append(cleaned_c)
    md_lines.append("")

final_md = '\n'.join(md_lines)

# Write to documents/SANGILI_Screenplay_Master.md
out_md_path = '/Volumes/Crucial X9/Vibe Coding/Backstage/documents/SANGILI_Screenplay_Master.md'
with open(out_md_path, 'w', encoding='utf-8') as f:
    f.write(final_md)

print(f"Generated {out_md_path} ({len(final_md)} bytes, {len(final_md.splitlines())} lines)")

# Now write services/sangiliScriptData.ts
ts_code = f'''import {{ ProductionDocument }} from '../types';
import {{ parseScreenplayToTamilLeftRight }} from './tamilLeftRightEngine';
import {{ markdownToHtml }} from './markdownEngine';

export const SANGILI_DOCUMENT_ID = 'doc-sangili-master';

export const SANGILI_RAW_MARKDOWN = {json.dumps(final_md, ensure_ascii=False)};

export function getSangiliDocument(projectId = 'default'): ProductionDocument {{
  const twoColData = parseScreenplayToTamilLeftRight(SANGILI_RAW_MARKDOWN, 'சங்கிலி (SANGILI) - திரைக்கதை & வசனங்கள்');
  
  return {{
    id: SANGILI_DOCUMENT_ID,
    projectId,
    title: 'சங்கிலி (SANGILI) - திரைக்கதை & வசனங்கள்',
    titleTa: 'சங்கிலி (SANGILI)',
    category: 'SCRIPT',
    fileName: 'SANGILI_Screenplay_Master.md',
    fileSize: '{len(final_md) // 1024} KB',
    fileType: 'md',
    pageCount: {len(raw_splits) // 2 + 1},
    uploadedAt: '2026-10-18T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    isStagedToScript: true,
    isLeftRightFormat: true,
    hasTwoColumnScript: true,
    author: 'Sasikumar & Team',
    status: 'approved',
    builtInType: 'script',
    textContent: SANGILI_RAW_MARKDOWN,
    htmlContent: markdownToHtml(SANGILI_RAW_MARKDOWN),
    twoColumnData: twoColData,
    annotations: []
  }};
}}
'''

out_ts_path = '/Volumes/Crucial X9/Vibe Coding/Backstage/services/sangiliScriptData.ts'
with open(out_ts_path, 'w', encoding='utf-8') as f:
    f.write(ts_code)

print(f"Generated {out_ts_path} ({len(ts_code)} bytes)")
