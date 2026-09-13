/**
 * High-Accuracy Bamini / Tamil Typewriter to Unicode Screenplay Transcoder
 * Handles exact typewriter layouts, Grantha characters (~, ], [, \\), special numerals (&, $, }),
 * prefixes, suffixes, and screenplay sluglines.
 */

export function transcodeBaminiToUnicode(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Screenplay Structure Headers & Sluglines
  text = text.replace(/fhl;rp\s*:\s*/g, 'காட்சி: ');
  text = text.replace(/fhl;rp/g, 'காட்சி');
  text = text.replace(/,lk;\s*:\s*/g, 'இடம்: ');
  text = text.replace(/,lk;/g, 'இடம்');
  text = text.replace(/Neuk;\s*:\s*/g, 'நேரம்: ');
  text = text.replace(/Neuk;/g, 'நேரம்');
  text = text.replace(/ebfh;fs;\s*:\s*/g, 'நடிகர்கள்: ');
  text = text.replace(/ebfh;fs;/g, 'நடிகர்கள்');
  text = text.replace(/Jizebfh;fs;/g, 'துணைநடிகர்கள்');
  text = text.replace(/Jizebfh;fs/g, 'துணைநடிகர்கள்');
  text = text.replace(/tha;\]\s*:\s*/g, 'வாய்ஸ்: ');
  text = text.replace(/tha;\]\s*Xth;\s*fhl;rp\s*:\s*/g, 'வாய்ஸ் ஓவர் காட்சி:\n');
  text = text.replace(/tha;\]\s*Xth;/g, 'வாய்ஸ் ஓவர்');
  text = text.replace(/tha;\]/g, 'வாய்ஸ்');
  text = text.replace(/,ilNtis/g, 'இடைவேளை');
  text = text.replace(/Kw;Wk;/g, 'முற்றும்');

  // 2. Specialized Multi-letter Grantha & Compound Glyphs (~ = ஷ, ] = ஸ்/ஷ், [ = ஜ, & = ரூ, $ = கூ)
  text = text.replace(/&gh/g, 'ரூபாய்');
  text = text.replace(/&/g, 'ரூ');
  text = text.replace(/\$/g, 'கூ');
  text = text.replace(/NghyP\];ir/g, 'போலீஸை');
  text = text.replace(/NghyP\];fpl;l/g, 'போலீஸ்கிட்ட');
  text = text.replace(/NghyP\];fspd;/g, 'போலீஸ்களின்');
  text = text.replace(/NghyP\];fspy;/g, 'போலீஸ்களில்');
  text = text.replace(/NghyP\];f;F/g, 'போலீஸுக்கு');
  text = text.replace(/NghyP\];y/g, 'போலீஸில்');
  text = text.replace(/NghyP\];/g, 'போலீஸ்');
  text = text.replace(/NghyP\]/g, 'போலீஸ்');
  text = text.replace(/NghyPruhy;/g, 'போலீஸாரால்');
  text = text.replace(/NghyP];/g, 'போலீஸ்');
  text = text.replace(/NghyP\];ir/g, 'போலீஸை');
  text = text.replace(/\]k;/g, 'ஸ்');
  text = text.replace(/\]k/g, 'ஸ்');
  text = text.replace(/\];/g, 'ஸ்');
  text = text.replace(/\[;/g, 'ஜ்');
  text = text.replace(/\\;/g, 'ஹ்');
  text = text.replace(/F;/g, 'க்ஷ்');

  // Character ~ (Bamini Sha / Sh)
  text = text.replace(/~;/g, 'ஷ்');
  text = text.replace(/~k;/g, 'ஷம்');
  text = text.replace(/~k/g, 'ஷம்');
  text = text.replace(/~d;/g, 'ஷன்');
  text = text.replace(/~d/g, 'ஷன்');
  text = text.replace(/N~/g, 'ஷே');
  text = text.replace(/n~/g, 'ஷெ');
  text = text.replace(/i~/g, 'ஷை');
  text = text.replace(/~h/g, 'ஷா');
  text = text.replace(/~p/g, 'ஷி');
  text = text.replace(/~P/g, 'ஷீ');
  text = text.replace(/~/g, 'ஷ');

  // 3. Common Proper Names & Colloquial Tamil Words in Screenplay
  text = text.replace(/uq;fh/g, 'ரங்கா');
  text = text.replace(/uq;fht/g, 'ரங்காவை');
  text = text.replace(/uq;fhit/g, 'ரங்காவை');
  text = text.replace(/uq;fhtpd;/g, 'ரங்காவின்');
  text = text.replace(/uq;fhtplk;/g, 'ரங்காவிடம்');
  text = text.replace(/uq;fhTf;F/g, 'ரங்காவுக்கு');
  text = text.replace(/uq;fhNthl/g, 'ரங்காவோட');
  text = text.replace(/uq;f/g, 'ரங்கா');
  text = text.replace(/rPjh/g, 'சீதா');
  text = text.replace(/rPj;jh/g, 'சீதா');
  text = text.replace(/rq;ftP/g, 'சங்கவி');
  text = text.replace(/rq;ftp/g, 'சங்கவி');
  text = text.replace(/rq;fPjh/g, 'சங்கீதா');
  text = text.replace(/fhq;Nfad;/g, 'காங்கேயன்');
  text = text.replace(/fhq;Nfaid/g, 'காங்கேயனை');
  text = text.replace(/fhq;NfaDf;F/g, 'காங்கேயனுக்கு');
  text = text.replace(/fhq;Nad;/g, 'காங்கேயன்');
  text = text.replace(/fhNfad;/g, 'காங்கேயன்');
  text = text.replace(/VOkiy/g, 'ஏழுமலை');
  text = text.replace(/vOkiy/g, 'ஏழுமலை');
  text = text.replace(/fdpad;/g, 'கனியன்');
  text = text.replace(/fzpad;/g, 'கனியன்');
  text = text.replace(/fd;dpk;kh/g, 'கன்னியம்மா');
  text = text.replace(/fd;dpak;kh/g, 'கன்னியம்மா');
  text = text.replace(/eurpk;kh/g, 'நரசிம்மா');
  text = text.replace(/erpk;kh/g, 'நரசிம்மா');
  text = text.replace(/Ntq;flhrygjp/g, 'வேங்கடாசலபதி');
  text = text.replace(/ntq;flhrygjp/g, 'வேங்கடாசலபதி');
  text = text.replace(/Ntq;flrygjp/g, 'வேங்கடாசலபதி');
  text = text.replace(/Ntq;lhrygjp/g, 'வேங்கடாசலபதி');
  text = text.replace(/ntq;lhrygjp/g, 'வேங்கடாசலபதி');
  text = text.replace(/Nryk;/g, 'சேலம்');
  text = text.replace(/nts;spkiy/g, 'வெள்ளிமலை');
  text = text.replace(/Me;jpuh/g, 'ஆந்திரா');
  text = text.replace(/Jg;ghfp/g, 'துப்பாக்கி');
  text = text.replace(/Jg;ghf;fp/g, 'துப்பாக்கி');
  text = text.replace(/J}g;ghf;fp/g, 'துப்பாக்கி');
  text = text.replace(/Kdpag;gd;/g, 'முனியப்பன்');
  text = text.replace(/E}w;WIk;gJ/g, 'நூற்றைம்பது');
  text = text.replace(/E}W/g, 'நூறு');
  text = text.replace(/E}/g, 'நூ');
  text = text.replace(/J}f;fp/g, 'தூக்கி');
  text = text.replace(/J}/g, 'தூ');
  text = text.replace(/O/g, 'ழு'); // Bamini capital O is 'ழு'

  // Special Words with 'h;' (ர்) and combinations
  text = text.replace(/ghh;j;Jk;/g, 'பார்த்தும்');
  text = text.replace(/ghh;j;J/g, 'பார்த்து');
  text = text.replace(/ghh;f;f/g, 'பார்க்க');
  text = text.replace(/ghh;g;gJ/g, 'பார்ப்பது');
  text = text.replace(/ghh;gJ/g, 'பார்ப்பது');
  text = text.replace(/ghh;fpwhh;/g, 'பார்க்கிறார்');
  text = text.replace(/ghh;fpwhd;/g, 'பார்க்கிறான்');
  text = text.replace(/ghh;j;jhh;fs;/g, 'பார்த்தார்கள்');
  text = text.replace(/ghh;j;jhh;/g, 'பார்த்தார்');
  text = text.replace(/ghh;j;jhd;/g, 'பார்த்தான்');
  text = text.replace(/fhh;/g, 'கார்');
  text = text.replace(/khh;/g, 'மார்');
  text = text.replace(/thh;/g, 'வார்');
  text = text.replace(/whh;fs;\.\./g, 'றார்கள்..');
  text = text.replace(/whh;fs;/g, 'றார்கள்');
  text = text.replace(/whh;fs/g, 'றார்கள்');
  text = text.replace(/whh;/g, 'றார்');
  text = text.replace(/RLfpwhh;\./g, 'சுடுகிறார்.');
  text = text.replace(/RLfpwhh;/g, 'சுடுகிறார்');
  text = text.replace(/myhp/g, 'அலறி');

  // 4. Double-vowel kombu + kaal (ோ, ொ, ௌ)
  // Long Oo (N + consonant + h = ோ)
  text = text.replace(/Nfh/g, 'கோ');
  text = text.replace(/Ngh/g, 'போ');
  text = text.replace(/Nrh/g, 'சோ');
  text = text.replace(/Njh/g, 'தோ');
  text = text.replace(/Neh/g, 'நோ');
  text = text.replace(/Nkh/g, 'மோ');
  text = text.replace(/Nlh/g, 'டோ');
  text = text.replace(/Nzh/g, 'ணோ');
  text = text.replace(/Nah/g, 'யோ');
  text = text.replace(/Nuh/g, 'ரோ');
  text = text.replace(/Nyh/g, 'லோ');
  text = text.replace(/Nth/g, 'வோ');
  text = text.replace(/Nhh/g, 'ழோ');
  text = text.replace(/Nsh/g, 'ளோ');
  text = text.replace(/Nwh/g, 'றோ');
  text = text.replace(/Ndh/g, 'னோ');
  text = text.replace(/N\[h/g, 'ஜோ');

  // Short O (n + consonant + h = ொ)
  text = text.replace(/nfh/g, 'கொ');
  text = text.replace(/ngh/g, 'பொ');
  text = text.replace(/nrh/g, 'சொ');
  text = text.replace(/njh/g, 'தொ');
  text = text.replace(/neh/g, 'நொ');
  text = text.replace(/nkh/g, 'மொ');
  text = text.replace(/nlh/g, 'டொ');
  text = text.replace(/nzh/g, 'ணொ');
  text = text.replace(/nah/g, 'யொ');
  text = text.replace(/nuh/g, 'ரொ');
  text = text.replace(/nyh/g, 'லொ');
  text = text.replace(/nth/g, 'வொ');
  text = text.replace(/nhh/g, 'ழொ');
  text = text.replace(/nsh/g, 'ளொ');
  text = text.replace(/nwh/g, 'றொ');
  text = text.replace(/ndh/g, 'னொ');
  text = text.replace(/n\[h/g, 'ஜொ');

  // Au (n + consonant + s = ௌ)
  text = text.replace(/nfs/g, 'கௌ');
  text = text.replace(/ngs/g, 'பௌ');
  text = text.replace(/nrs/g, 'சௌ');
  text = text.replace(/njs/g, 'தௌ');
  text = text.replace(/nes/g, 'நௌ');
  text = text.replace(/nks/g, 'மௌ');
  text = text.replace(/nls/g, 'டௌ');
  text = text.replace(/nzs/g, 'ணௌ');
  text = text.replace(/nas/g, 'யௌ');
  text = text.replace(/nus/g, 'ரௌ');
  text = text.replace(/nys/g, 'லௌ');
  text = text.replace(/nts/g, 'வௌ');
  text = text.replace(/nhs/g, 'ழௌ');
  text = text.replace(/nss/g, 'ளௌ');
  text = text.replace(/nws/g, 'றௌ');
  text = text.replace(/nds/g, 'னௌ');

  // 5. Rettai Kombu (N + consonant = ே)
  text = text.replace(/Nf/g, 'கே');
  text = text.replace(/Ng/g, 'பே');
  text = text.replace(/Nr/g, 'சே');
  text = text.replace(/Nj/g, 'தே');
  text = text.replace(/Ne/g, 'நே');
  text = text.replace(/Nk/g, 'மே');
  text = text.replace(/Nl/g, 'டே');
  text = text.replace(/Nz/g, 'ணே');
  text = text.replace(/Na/g, 'யே');
  text = text.replace(/Nu/g, 'ரே');
  text = text.replace(/Ny/g, 'லே');
  text = text.replace(/Nt/g, 'வே');
  text = text.replace(/Nh/g, 'ழே');
  text = text.replace(/No/g, 'ழே');
  text = text.replace(/Ns/g, 'ளே');
  text = text.replace(/Nw/g, 'றே');
  text = text.replace(/Nd/g, 'னே');
  text = text.replace(/N\[/g, 'ஜே');
  text = text.replace(/N\]/g, 'ஷே');
  text = text.replace(/N\\/g, 'ஹே');

  // 6. Ottai Kombu (n + consonant = ெ)
  text = text.replace(/nf/g, 'கெ');
  text = text.replace(/ng/g, 'பெ');
  text = text.replace(/nr/g, 'செ');
  text = text.replace(/nj/g, 'தெ');
  text = text.replace(/ne/g, 'நெ');
  text = text.replace(/nk/g, 'மெ');
  text = text.replace(/nl/g, 'டெ');
  text = text.replace(/nz/g, 'ணெ');
  text = text.replace(/na/g, 'யெ');
  text = text.replace(/nu/g, 'ரெ');
  text = text.replace(/ny/g, 'லெ');
  text = text.replace(/nt/g, 'வெ');
  text = text.replace(/nh/g, 'ழெ');
  text = text.replace(/no/g, 'ழெ');
  text = text.replace(/ns/g, 'ளெ');
  text = text.replace(/nw/g, 'றெ');
  text = text.replace(/nd/g, 'னெ');
  text = text.replace(/n\[/g, 'ஜெ');
  text = text.replace(/n\]/g, 'ஷெ');
  text = text.replace(/n\\/g, 'ஹெ');

  // 7. Ai (i + consonant = ை)
  text = text.replace(/if/g, 'கை');
  text = text.replace(/ig/g, 'பை');
  text = text.replace(/ir/g, 'சை');
  text = text.replace(/ij/g, 'தை');
  text = text.replace(/ie/g, 'நை');
  text = text.replace(/ik/g, 'மை');
  text = text.replace(/il/g, 'டை');
  text = text.replace(/iz/g, 'ணை');
  text = text.replace(/ia/g, 'யை');
  text = text.replace(/iu/g, 'ரை');
  text = text.replace(/iy/g, 'லை');
  text = text.replace(/it/g, 'வை');
  text = text.replace(/io/g, 'ழை');
  text = text.replace(/ih/g, 'ழை');
  text = text.replace(/is/g, 'ளை');
  text = text.replace(/iw/g, 'றை');
  text = text.replace(/id/g, 'னை');
  text = text.replace(/i\[/g, 'ஜை');
  text = text.replace(/i\]/g, 'ஷை');
  text = text.replace(/i\\/g, 'ஹை');

  // 8. Suffix Combinations with Pulli
  text = text.replace(/h;fs;/g, 'ர்கள்');
  text = text.replace(/h;fs/g, 'ர்கள்');
  text = text.replace(/h;/g, 'ர்');

  // 9. Suffix Vowel Ee (ீ) (consonant + P)
  text = text.replace(/fP/g, 'கீ');
  text = text.replace(/gP/g, 'பீ');
  text = text.replace(/rP/g, 'சீ');
  text = text.replace(/jP/g, 'தீ');
  text = text.replace(/eP/g, 'நீ');
  text = text.replace(/kP/g, 'மீ');
  text = text.replace(/B/g, 'டீ');
  text = text.replace(/zP/g, 'ணீ');
  text = text.replace(/aP/g, 'யீ');
  text = text.replace(/uP/g, 'ரீ');
  text = text.replace(/yP/g, 'லீ');
  text = text.replace(/tP/g, 'வீ');
  text = text.replace(/hP/g, 'ழீ');
  text = text.replace(/oP/g, 'ழீ');
  text = text.replace(/sP/g, 'ளீ');
  text = text.replace(/wP/g, 'றீ');
  text = text.replace(/dP/g, 'னீ');
  text = text.replace(/\[P/g, 'ஜீ');
  text = text.replace(/\]P/g, 'ஷீ');
  text = text.replace(/\\P/g, 'ஹீ');

  // 10. Suffix Vowel I (ி) (consonant + p)
  text = text.replace(/fp/g, 'கி');
  text = text.replace(/gp/g, 'பி');
  text = text.replace(/rp/g, 'சி');
  text = text.replace(/jp/g, 'தி');
  text = text.replace(/ep/g, 'நி');
  text = text.replace(/kp/g, 'மி');
  text = text.replace(/b/g, 'டி');
  text = text.replace(/zp/g, 'ணி');
  text = text.replace(/ap/g, 'யி');
  text = text.replace(/up/g, 'ரி');
  text = text.replace(/yp/g, 'லி');
  text = text.replace(/tp/g, 'வி');
  text = text.replace(/hp/g, 'ழி');
  text = text.replace(/op/g, 'ழி');
  text = text.replace(/sp/g, 'ளி');
  text = text.replace(/wp/g, 'றி');
  text = text.replace(/dp/g, 'னி');
  text = text.replace(/\[p/g, 'ஜி');
  text = text.replace(/\]p/g, 'ஷி');
  text = text.replace(/\\p/g, 'ஹி');

  // 11. Suffix Vowels U (ு) and Oo (ூ)
  text = text.replace(/F/g, 'கு');
  text = text.replace(/T/g, 'வு');
  text = text.replace(/R\+/g, 'சூ');
  text = text.replace(/R/g, 'சு');
  text = text.replace(/\^/g, 'டூ');
  text = text.replace(/L/g, 'டு');
  text = text.replace(/Z\+/g, 'ணூ');
  text = text.replace(/Z/g, 'ணு');
  text = text.replace(/J\}/g, 'தூ');
  text = text.replace(/J\+/g, 'தூ');
  text = text.replace(/J/g, 'து');
  text = text.replace(/E\+/g, 'நூ');
  text = text.replace(/E/g, 'நு');
  text = text.replace(/G\+/g, 'பூ');
  text = text.replace(/G/g, 'பு');
  text = text.replace(/K\+/g, 'மூ');
  text = text.replace(/K/g, 'மு');
  text = text.replace(/A\+/g, 'யூ');
  text = text.replace(/A/g, 'யு');
  text = text.replace(/U\+/g, 'ரூ');
  text = text.replace(/U/g, 'ரு');
  text = text.replace(/Y\+/g, 'லூ');
  text = text.replace(/Y/g, 'லு');
  text = text.replace(/H\+/g, 'ழூ');
  text = text.replace(/H/g, 'ழு');
  text = text.replace(/S\+/g, 'ளூ');
  text = text.replace(/S/g, 'ளு');
  text = text.replace(/W\+/g, 'றூ');
  text = text.replace(/W/g, 'று');
  text = text.replace(/d\+/g, 'னூ');
  text = text.replace(/D\}/g, 'னூ');
  text = text.replace(/D/g, 'னு');

  // 12. Pure Consonants with Pulli (க், ங், ச், ஞ், ட், ண், த், ந், ப், ம், ய், ர், ல், வ், ழ், ள், ற், ன்)
  text = text.replace(/f;/g, 'க்');
  text = text.replace(/q;/g, 'ங்');
  text = text.replace(/';/g, 'ங்');
  text = text.replace(/r;/g, 'ச்');
  text = text.replace(/l;/g, 'ட்');
  text = text.replace(/z;/g, 'ண்');
  text = text.replace(/j;/g, 'த்');
  text = text.replace(/e;/g, 'ந்');
  text = text.replace(/g;/g, 'ப்');
  text = text.replace(/k;/g, 'ம்');
  text = text.replace(/a;/g, 'ய்');
  text = text.replace(/u;/g, 'ர்');
  text = text.replace(/y;/g, 'ல்');
  text = text.replace(/t;/g, 'வ்');
  text = text.replace(/o;/g, 'ழ்');
  text = text.replace(/s;/g, 'ள்');
  text = text.replace(/w;/g, 'ற்');
  text = text.replace(/d;/g, 'ன்');
  text = text.replace(/\[;/g, 'ஜ்');
  text = text.replace(/\];/g, 'ஷ்');
  text = text.replace(/\\;/g, 'ஹ்');

  // 13. Consonant + Kaal (ா)
  text = text.replace(/fh/g, 'கா');
  text = text.replace(/gh/g, 'பா');
  text = text.replace(/rh/g, 'சா');
  text = text.replace(/jh/g, 'தா');
  text = text.replace(/eh/g, 'நா');
  text = text.replace(/kh/g, 'மா');
  text = text.replace(/lh/g, 'டா');
  text = text.replace(/zh/g, 'ணா');
  text = text.replace(/ah/g, 'யா');
  text = text.replace(/uh/g, 'ரா');
  text = text.replace(/yh/g, 'லா');
  text = text.replace(/th/g, 'வா');
  text = text.replace(/hh/g, 'ழா');
  text = text.replace(/oh/g, 'ழா');
  text = text.replace(/sh/g, 'ளா');
  text = text.replace(/wh/g, 'றா');
  text = text.replace(/dh/g, 'னா');
  text = text.replace(/\[h/g, 'ஜா');
  text = text.replace(/\]h/g, 'ஷா');
  text = text.replace(/\\h/g, 'ஹா');

  // 14. Independent Uyir Vowels (அ, ஆ, இ, ஈ, உ, ஊ, எ, ஏ, ஐ, ஒ, ஓ, ஔ, ஃ)
  text = text.replace(/xs/g, 'ஔ');
  text = text.replace(/m/g, 'அ');
  text = text.replace(/M/g, 'ஆ');
  text = text.replace(/,/g, 'இ');
  text = text.replace(/</g, 'ஈ');
  text = text.replace(/c/g, 'உ');
  text = text.replace(/C/g, 'ஊ');
  text = text.replace(/v/g, 'எ');
  text = text.replace(/V/g, 'ஏ');
  text = text.replace(/I/g, 'ஐ');
  text = text.replace(/x/g, 'ஒ');
  text = text.replace(/X/g, 'ஓ');
  text = text.replace(/\/@/g, 'ஃ');
  text = text.replace(/%/g, 'ஃ');

  // 15. Single Consonants (அகர வரிசை)
  text = text.replace(/f/g, 'க');
  text = text.replace(/g/g, 'ப');
  text = text.replace(/r/g, 'ச');
  text = text.replace(/j/g, 'த');
  text = text.replace(/e/g, 'ந');
  text = text.replace(/k/g, 'ம');
  text = text.replace(/l/g, 'ட');
  text = text.replace(/z/g, 'ண');
  text = text.replace(/a/g, 'ய');
  text = text.replace(/u/g, 'ர');
  text = text.replace(/y/g, 'ல');
  text = text.replace(/t/g, 'வ');
  text = text.replace(/h/g, 'ழ');
  text = text.replace(/o/g, 'ழ');
  text = text.replace(/s/g, 'ள');
  text = text.replace(/w/g, 'ற');
  text = text.replace(/d/g, 'ன');
  text = text.replace(/\[/g, 'ஜ');
  text = text.replace(/\]/g, 'ஷ');
  text = text.replace(/\\/g, 'ஹ');

  // 16. Clean up punctuation & delimiters
  text = text.replace(/>/g, ',');

  return text;
}

export type FontEncoding = 'BAMINI' | 'TAM' | 'TAB' | 'TSCII' | 'AUTO';

/**
 * Checks if a text has Bamini font markers or legacy typewriter characters.
 */
export function isLegacyBamini(text: string): boolean {
  if (!text) return false;
  const unicodeCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
  if (unicodeCount > 30) return false;
  const baminiFingerprints = /(fhl;rp|ntsp|kJiu|Nfh|kPzh|mk;kd;|tPjp|,uth|jp|gp|f;|r;|j;|k;|g;|e;|u;|d;|y;|s;|ebfh;fs;|fl;ilia|nrk;kuj;ij|uq;fh|RNu~;)/;
  return baminiFingerprints.test(text);
}

/**
 * Master conversion function. Converts text to Unicode if legacy font detected or requested.
 */
export function convertToUnicode(text: string, encoding: FontEncoding | boolean = 'BAMINI'): string {
  if (!text) return '';
  if (encoding !== true && /[\u0B80-\u0BFF]{10,}/.test(text) && !/(fhl;rp|ntsp|kJiu|Nfh|kPzh|ebfh;fs;|fl;ilia|nrk;kuj;ij|uq;fh|RNu~;)/.test(text)) {
    return text;
  }
  return transcodeBaminiToUnicode(text);
}
