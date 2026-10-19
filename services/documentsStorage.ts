import { saveDocumentsToRustDisk, loadDocumentsFromRustDisk } from './localRustStorage';
import { ProductionDocument, DocumentAnnotation, DocumentCategory, DocumentFormat } from '../types';
import { 
  saveProjectDocumentToCloud, 
  saveProjectDocumentsToProjectData,
  fetchProjectDocumentsFromCloud, 
  fetchStorageFilesFromCloud,
  deleteProjectDocumentFromCloud,
  uploadDocumentBinaryToStorage,
  fetchProjectData,
  supabase,
  isSupabaseConfigured
} from './supabase';
import { saveLargeDocuments, loadLargeDocuments } from './largeStorage';
import { markdownToHtml } from './markdownEngine';
import { SANGILI_DOCUMENT_ID, getSangiliDocument } from './sangiliScriptData';

const STORAGE_KEY = 'backstage_production_documents';

// In-memory cache guarantees that uploaded documents are instantly available
// and never lost during rapid state switches, re-renders, or quota issues.
const inMemoryDocsCache: Record<string, ProductionDocument[]> = {};

export function getDocumentStorageKey(projectId?: string): string {
  if (projectId) return `backstage_production_documents_${projectId}`;
  try {
    const currentId = typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') : null;
    if (currentId) return `backstage_production_documents_${currentId}`;
  } catch {}
  return STORAGE_KEY;
}

const TOMBSTONE_STORAGE_KEY = 'backstage_deleted_document_ids';

/**
 * Returns the set of permanently deleted document IDs for a project.
 * Documents in this set will NEVER be resurrected by sync, fallback keys, or storage buckets.
 */
export function getDeletedDocumentIds(projectId?: string): Set<string> {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const set = new Set<string>();
  try {
    const rawLocal = localStorage.getItem(`${TOMBSTONE_STORAGE_KEY}_${activeProjId}`);
    if (rawLocal) {
      const arr = JSON.parse(rawLocal);
      if (Array.isArray(arr)) arr.forEach((id: string) => set.add(id));
    }
    const rawGlobal = localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    if (rawGlobal) {
      const arr = JSON.parse(rawGlobal);
      if (Array.isArray(arr)) arr.forEach((id: string) => set.add(id));
    }
  } catch {}
  return set;
}

/**
 * Permanently records a document deletion tombstone.
 */
export function recordDocumentDeletion(docIds: string | string[], projectId?: string): void {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const idsToAdd = Array.isArray(docIds) ? docIds : [docIds];
  const set = getDeletedDocumentIds(activeProjId);
  idsToAdd.forEach((id) => set.add(id));
  const arr = Array.from(set);
  try {
    localStorage.setItem(`${TOMBSTONE_STORAGE_KEY}_${activeProjId}`, JSON.stringify(arr));
    localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}


/**
 * Generate a pure client-side soft WAV audio data URL for voice note testing and starter memos.
 */
export function createSyntheticAudioDataUrl(frequency = 440, durationSec = 2): string {
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    // RIFF chunk
    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + numSamples, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    // fmt subchunk
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true); // 16 for PCM
    view.setUint16(20, 1, true); // PCM = 1
    view.setUint16(22, 1, true); // Mono = 1
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true); // block align
    view.setUint16(34, 8, true); // 8-bit
    // data subchunk
    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, numSamples, true);

    // Generate soft chord tones with fade-in and fade-out envelope
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, t * 8) * Math.max(0, 1 - t / durationSec);
      const sample =
        Math.sin(2 * Math.PI * frequency * t) * 0.5 +
        Math.sin(2 * Math.PI * (frequency * 1.5) * t) * 0.25;
      view.setUint8(44 + i, Math.floor(128 + sample * 55 * env));
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
  } catch {
    // Fallback silent WAV
    return 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICA';
  }
}

const SAMPLE_AUDIO_1 = createSyntheticAudioDataUrl(380, 3);
const SAMPLE_AUDIO_2 = createSyntheticAudioDataUrl(440, 4);

export const MASTER_BREAKDOWN_DOC_ID = 'doc-master-breakdown';

export function generateMasterBreakdownMarkdown(projectState?: any): string {
  const title = projectState?.title || 'Production Feature';
  const beats = Array.isArray(projectState?.beats) && projectState.beats.length > 0 ? projectState.beats : null;

  if (beats) {
    let scRows = '';
    const deptItems: Record<string, string[]> = {
      'Cast & Characters': [],
      'Stunts & Action': [],
      'Hero Props & Art': [],
      'SFX & Practical Effects': [],
      'VFX & Technical': [],
      'Safety & Medic': [],
    };

    beats.forEach((b: any, idx: number) => {
      const scNum = b.sceneNumber || idx + 1;
      const slug = b.slug ? `${b.slug.prefix || 'INT.'} ${b.slug.location || 'LOCATION'} - ${b.slug.time || 'DAY'}` : (b.title || `Scene ${scNum}`);
      const bd = b.breakdown || b.breakdownData || {};

      const castList: string[] = Array.isArray(bd.CAST) ? bd.CAST.map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean) : [];
      if (b.characterNames && Array.isArray(b.characterNames)) {
        b.characterNames.forEach((n: string) => { if (!castList.includes(n)) castList.push(n); });
      }
      const propsList: string[] = Array.isArray(bd.PROPS) ? bd.PROPS.map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean) : [];
      const stuntsList: string[] = Array.isArray(bd.STUNTS) ? bd.STUNTS.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean) : [];
      const sfxList: string[] = Array.isArray(bd.SFX) ? bd.SFX.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean) : [];
      const vfxList: string[] = Array.isArray(bd.VFX) ? bd.VFX.map((v: any) => typeof v === 'string' ? v : v.name).filter(Boolean) : [];
      const safetyList: string[] = Array.isArray(bd.SAFETY) ? bd.SAFETY.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean) : [];

      castList.forEach((c) => { if (!deptItems['Cast & Characters'].includes(c)) deptItems['Cast & Characters'].push(c); });
      stuntsList.forEach((s) => { if (!deptItems['Stunts & Action'].includes(s)) deptItems['Stunts & Action'].push(s); });
      propsList.forEach((p) => { if (!deptItems['Hero Props & Art'].includes(p)) deptItems['Hero Props & Art'].push(p); });
      sfxList.forEach((s) => { if (!deptItems['SFX & Practical Effects'].includes(s)) deptItems['SFX & Practical Effects'].push(s); });
      vfxList.forEach((v) => { if (!deptItems['VFX & Technical'].includes(v)) deptItems['VFX & Technical'].push(v); });
      safetyList.forEach((s) => { if (!deptItems['Safety & Medic'].includes(s)) deptItems['Safety & Medic'].push(s); });

      const castStr = castList.length ? castList.join(', ') : '—';
      const propsStr = propsList.length ? propsList.join(', ') : '—';
      const actionStr = [...stuntsList, ...sfxList].length ? [...stuntsList, ...sfxList].join(', ') : '—';
      const techStr = vfxList.length ? vfxList.join(', ') : 'Standard Coverage';
      const safeStr = safetyList.length ? safetyList.join(', ') : 'Standard Set Protocol';

      scRows += `| **Sc. ${scNum}** | ${slug} | ${castStr} | ${propsStr} | ${actionStr} | ${techStr} | ${safeStr} |\n`;
    });

    return `# MASTER PRODUCTION BREAKDOWN SHEET
**Project:** ${title}  
**Department:** 1st AD / Production Management  
**Master Document:** Unified Production Matrix (Markdown)  
**Total Scenes Cataloged:** ${beats.length}  

> [!NOTE]
> This is the single, unified **Master Production Breakdown Sheet** for **${title}**. All departments, scenes, cast requirements, and safety protocols are consolidated here in clean Markdown.

---

## 1. Master Scene Breakdown Matrix

| Sc # | Slugline / Setting | Cast & Extras | Props & Set Dressing | Stunts & SFX | VFX & Camera | Safety Directives |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
${scRows}
---

## 2. Master Department Requirements & Checklists

### 👥 Cast & Characters
${deptItems['Cast & Characters'].length ? deptItems['Cast & Characters'].map(c => `- [ ] **${c}**`).join('\n') : '- [ ] Standard Cast'}

### 💥 Stunts & Action Rigging
${deptItems['Stunts & Action'].length ? deptItems['Stunts & Action'].map(s => `- [ ] ${s}`).join('\n') : '- [ ] No major stunt rigs'}

### 🗝️ Hero Props & Art Department
${deptItems['Hero Props & Art'].length ? deptItems['Hero Props & Art'].map(p => `- [ ] ${p}`).join('\n') : '- [ ] Standard hand props'}

### 🔥 SFX & Practical Pyrotechnics
${deptItems['SFX & Practical Effects'].length ? deptItems['SFX & Practical Effects'].map(s => `- [ ] ${s}`).join('\n') : '- [ ] Atmosphere / Haze only'}

### 🎬 Visual Effects (VFX Plates) & Technical
${deptItems['VFX & Technical'].length ? deptItems['VFX & Technical'].map(v => `- [ ] ${v}`).join('\n') : '- [ ] Clean background plates'}

### 🛡️ Safety, Fire & Medical Directives
${deptItems['Safety & Medic'].length ? deptItems['Safety & Medic'].map(s => `- [ ] ${s}`).join('\n') : '- [ ] Certified on-set medic and fire marshal on standby'}

---

## 3. Production Notes & Directives

1. **Continuity Protocol:** Script Supervisor to verify hero props handoff between all consecutive scenes.
2. **Audio & Atmos:** Sound department to capture 60-second room tone for every unique location setup.
3. **Safety First:** Dedicated safety briefing prior to call time whenever stunts or practical effects are active.
`;
  }

  // Default Master Breakdown Sheet when beats are not yet loaded
  return `# MASTER PRODUCTION BREAKDOWN SHEET
**Project:** ${title}  
**Unit:** 1st AD / Production Management  
**Master Document:** Unified Production Matrix (Markdown)  
**Status:** Approved Master Breakdown  

> [!NOTE]
> This is the single, unified **Master Production Breakdown Sheet**. All scenes, cast rosters, department requirements, stunts, props, and safety protocols are consolidated here in clean Markdown for rapid editing and live preview.

---

## 1. Production Overview

| Metric | Specification |
| :--- | :--- |
| **Document Type** | Master Production Breakdown Sheet (.md) |
| **Supervising Unit** | 1st Assistant Director & Production Core |
| **Total Scenes** | 4 Key Production Sequences |
| **Lead Cast** | Maya (Heroine), Sterling (Vault Director), Security Detail |
| **Key Departments** | Cast, Stunts, Props, SFX, VFX, Sound, Set Dressing, Safety |

---

## 2. Master Scene Breakdown Matrix

| Sc # | Slugline / Setting | Cast & Extras | Props & Set Dressing | Stunts & SFX | VFX & Camera | Safety Directives |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sc. 1** | EXT. CHENNAI HARBOR DOCKS - NIGHT | Maya, Harbor Lookout | Tactical Binoculars, Heavy Rope | Wet Slip Hazard, Night Wind | 35mm Anamorphic, Drone Establishing | PFDs near water edge; medic on standby |
| **Sc. 2** | INT. SUB-LEVEL ACCESS CORRIDOR - NIGHT | Maya | Security Keycard, Lockpick Kit | Ventilation Grate Breach | Low-angle handheld tracker | Dust masks for vent duct crawling |
| **Sc. 3** | INT. PERIMETER LASER CORRIDOR - NIGHT | Maya, Tactical Officers (x2) | Thermal Visor, Wire Snips | Acrobatic Laser Avoidance | Anamorphic Red Perimeter Glow | Eye protection from laser rig beams |
| **Sc. 4** | INT. CENTRAL DATA VAULT & INCINERATOR - NIGHT | Maya, Sterling, Tactical Officers (x4) | Optical Core Amber Key, Land Deeds Dossier, Brass Wheel | 15ft Catwalk Drop, Combat at Incinerator Lip, Spark Discharge | Golden Holographic Stream (VFX), 50mm Kowa | 2 Fire Safety Marshals with CO2 extinguishers |

---

## 3. Master Department Requirements & Checklists

### 👥 Cast & Extras Roster
- [ ] **Maya (Lead / Heroine)** — Tactical stealth jumpsuit, wired earpiece, wet boots
- [ ] **Sterling (Vault Security Director)** — Bespoke charcoal 3-piece suit, gold cufflinks
- [ ] **Vault Security Tactical Officers (x4)** — Kevlar tactical vests, riot visors, sidearms
- [ ] **Harbor Lookout** — Weathered oilskin slicker, handheld VHF radio

### 💥 Stunts & Action Rigging
- [ ] **Catwalk Drop & Decelerator Rig** (Maya 15ft drop from ceiling vent to steel catwalk; load tested)
- [ ] **Incinerator Edge Hand-to-Hand Sequence** (Choreographed edge fall with safety harness & catch mats)
- [ ] **Breakaway Glass Panels** (Sugar glass display panes pre-scored for impact)

### 🗝️ Hero Props & Art Department
- [ ] **Optical Core Access Key** — Hero prop: amber cylindrical cryo-key with illuminated laser etching
- [ ] **Classified Land Deeds Dossier** — Vintage Tamil Nadu land revenue records, charred edges (3 duplicates)
- [ ] **Industrial Incinerator Release Wheel** — Heavy cast-brass wheel with release pin & pressure gauge
- [ ] **Tactical Thermal Visor & Lockpick Set** — Maya's operative kit

### 🔥 SFX & Pyrotechnics
- [ ] **Severed Conduit Spark Discharge** — Controlled pyro electrical arc box from severed trunk
- [ ] **Incinerator Heat Glow & Paper Ash Updraft** — Amber heating coils with lightweight burnt ash updraft
- [ ] **Atmospheric Haze (Level 2)** — Oil-free haze machine continuous on south intake vent

### 🎬 Visual Effects (VFX Plates) & Technical
- [ ] **Golden Holographic Data Stream** — Volumetric stream plate from core pedestal; tracking dots
- [ ] **Digital Core Readouts** — Multi-monitor LED graphics sync plate
- [ ] **Camera Package** — 50mm Kowa Anamorphic on 12-ft south wall slider track

### 🛡️ Safety, Fire & Medical Directives
- [ ] **Fire Safety Marshals** — 2 dedicated certified marshals on standby with Class C fire suppression
- [ ] **High-Fall Decelerator Inspection** — Stunt coordinator sign-off prior to first take
- [ ] **Paramedic Unit** — On-set ambulance & trauma kit staged at Stage B bay doors

---

## 4. Production Notes & Directives

1. **Prop Duplication:** 3 identical amber optical core keys provided (1 hero illuminated, 1 stunt rubber tip, 1 static backup).
2. **Audio Sync:** 40Hz subterranean turbine drone will play through cast wireless earpieces during takes for authentic vocal projection.
3. **Daily Sign-off:** 1st AD and Stunt Coordinator must sign off on safety clearance before lighting the incinerator pit.
`;
}

export function createMasterBreakdownDocument(projectState?: any, projectId?: string): ProductionDocument {
  const content = generateMasterBreakdownMarkdown(projectState);
  const now = new Date().toISOString();
  return {
    id: MASTER_BREAKDOWN_DOC_ID,
    projectId: projectId || undefined,
    title: 'Master Production Breakdown',
    titleTa: 'முதன்மை தயாரிப்பு முறிவு தாள்',
    category: 'BREAKDOWN',
    fileType: 'md',
    fileName: 'Master_Production_Breakdown.md',
    fileSize: `${Math.round(content.length / 1024) || 6} KB`,
    pageCount: 1,
    uploadedAt: now,
    updatedAt: now,
    builtInType: 'breakdown',
    author: '1st AD Breakdown Supervisor',
    textContent: content,
    htmlContent: markdownToHtml(content),
    status: 'approved',
    tags: ['Master Sheet', 'Breakdown', 'Markdown', '1st AD'],
    annotations: [],
  };
}

export const SCENE_4_BREAKDOWN_SHEET_DATA: any[][] = [
  ['#', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status'],
  ['1', 'CAST', 'Maya', 'Cast', 'Lead (Heroine) — Tactical stealth jumpsuit, wired earpiece', 'Confirmed'],
  ['2', 'CAST', 'Sterling', 'Cast', 'Vault Security Director — Bespoke charcoal 3-piece suit', 'Confirmed'],
  ['3', 'EXTRAS', 'Vault Security Tactical Officers (x4)', 'Extras / Atmosphere', 'Armed security detail in tactical gear, Kevlar vests & visors', 'Scheduled'],
  ['4', 'STUNTS', 'Catwalk Drop & Decelerator Rig', 'Stunts & Action', 'Maya drops 15ft from ventilation duct to steel catwalk; decelerator rig', 'Rigged & Tested'],
  ['5', 'STUNTS', 'Incinerator Edge Combat & Glass Break', 'Stunts & Action', 'Hand-to-hand combat sequence at incinerator lip; breakaway glass panels', 'Rehearsed'],
  ['6', 'PROPS', 'Optical Core Access Key', 'Props', 'Hero Prop: Cylindrical amber cryo-key with illuminated laser etching', 'Hero Prop Ready'],
  ['7', 'PROPS', 'Classified Land Deeds Dossier', 'Props', 'Vintage Tamil Nadu land revenue records, charred edges (3 duplicates)', '3 Sets Ready'],
  ['8', 'PROPS', 'Industrial Incinerator Release Wheel', 'Props / Art', 'Heavy cast-brass wheel with safety pin and pressure gauge', 'Checked'],
  ['9', 'SFX', 'Severed Conduit Spark Discharge', 'SFX / Practical', 'Controlled pyrotechnic electrical arc box from severed server trunk', 'Rigged by SFX'],
  ['10', 'SFX', 'Incinerator Heat Glow & Embers', 'SFX / Practical', 'Amber heating glow coils with micro paper ash updraft', 'SFX Ready'],
  ['11', 'VFX', 'Golden Holographic Data Stream', 'VFX / Post', 'Volumetric holographic stream rising from core pedestal; tracking dots', 'Post Plate'],
  ['12', 'SOUND', 'Subterranean Turbine Drone (40Hz)', 'Sound Design', 'Heavy mechanical hum, pneumatic vents, distant cooling fans', 'Pre-recorded'],
  ['13', 'SOUND', 'Pneumatic Vault Door Hydraulic Slam', 'Sound FX', 'Multi-point magnetic locking sound with deep metallic resonance', 'Mastered'],
  ['14', 'SET_DRESSING', 'Subterranean Core Server Racks', 'Set Dressing', '8 double-height server cabinets with sequential amber/blue fiber LEDs', 'Dressed & Checked'],
  ['15', 'LIGHTING_GRIP', 'Anamorphic Flare & Laser Boundary Grid', 'Camera / Grip', '50mm Kowa anamorphic; red perimeter laser lines + amber rim bounce', 'DOP Approved'],
  ['16', 'SAFETY', 'Fire Safety Officer & CO2 Extinguishers', 'Safety & Medic', '2 dedicated safety marshals on standby with Class C fire suppression', 'Standby Confirmed'],
];

export function generateBreakdownHtmlTable(
  sceneNumber: string | number,
  sceneHeading: string,
  rows: any[][],
  synopsis = '',
  shootDay = 'DAY 1',
  pages = '2 3/8 PGS'
): string {
  const dataRows = (rows && rows.length > 1) ? rows.slice(1) : [];
  const totalCount = dataRows.length;

  const categoryColorMap: Record<string, { bg: string; text: string; border: string }> = {
    CAST: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    EXTRAS: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
    STUNTS: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
    VEHICLES: { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
    PROPS: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
    SFX: { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
    VFX: { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
    WARDROBE: { bg: '#fce7f3', text: '#831843', border: '#f472b6' },
    MAKEUP: { bg: '#ffe4e6', text: '#9f1239', border: '#fda4af' },
    ANIMALS: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    SOUND: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    SET_DRESSING: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    GREENERY: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    SPECIAL_EQUIPMENT: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    LIGHTING_GRIP: { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' },
    SAFETY: { bg: '#fee2e2', text: '#b91c1c', border: '#f87171' },
  };

  const rowsHtml = dataRows
    .map((r, i) => {
      const num = r[0] || i + 1;
      const cat = String(r[1] || 'PROPS').toUpperCase();
      const name = r[2] || '';
      const dept = r[3] || cat;
      const notes = r[4] || '';
      const status = r[5] || 'Confirmed';

      const style = categoryColorMap[cat] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
      const zebraBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';

      const statusLower = String(status).toLowerCase();
      const statusColor = statusLower.includes('confirm') || statusLower.includes('ready') || statusLower.includes('approved')
        ? 'background: #dcfce7; color: #166534; border: 1px solid #86efac;'
        : statusLower.includes('rigged') || statusLower.includes('rehearsed')
        ? 'background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc;'
        : statusLower.includes('sched')
        ? 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;'
        : 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';

      return `
        <tr style="background: ${zebraBg}; border-bottom: 1px solid #e2e8f0;" class="doc-table-row">
          <td style="padding: 10px 12px; font-weight: 700; color: #64748b; font-family: 'JetBrains Mono', ui-monospace, monospace; text-align: center;">${num}</td>
          <td style="padding: 10px 12px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border};">
              ${cat}
            </span>
          </td>
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; font-size: 13px;">${name}</td>
          <td style="padding: 10px 12px; color: #475569; font-size: 12px; font-weight: 500;">
            <span style="background: #e2e8f0; color: #334155; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600;">
              ${dept}
            </span>
          </td>
          <td style="padding: 10px 12px; color: #334155; font-size: 12px; line-height: 1.4;">${notes}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-block; padding: 3px 9px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; ${statusColor}">
              ${status}
            </span>
          </td>
          <td style="padding: 8px 6px; text-align: center; width: 42px;" class="doc-action-cell">
            <button type="button" class="doc-delete-row-btn" data-delete-row="true" style="background: rgba(239,68,68,0.12); color: #dc2626; border: 1px solid rgba(239,68,68,0.35); border-radius: 5px; width: 24px; height: 24px; line-height: 22px; font-size: 11px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease;" title="Edit out (delete) this item">✕</button>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<div class="doc-document-wrapper breakdown-document" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: inherit; width: 100%;">
  <!-- Document Header -->
  <div style="margin-bottom: 20px; border-bottom: 2px solid rgba(148, 163, 184, 0.3); padding-bottom: 14px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="background: #f5a623; color: #000000; font-weight: 900; font-size: 10px; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.06em; text-transform: uppercase;">1ST AD BREAKDOWN</span>
      <span style="font-size: 11px; font-family: 'JetBrains Mono', ui-monospace, monospace; opacity: 0.8; text-transform: uppercase;">SHOOT DAY: ${shootDay} &bull; ${pages} &bull; ${totalCount} ITEMS</span>
    </div>
    <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: inherit;">Scene ${sceneNumber}: ${sceneHeading}</h1>
  </div>

  ${
    synopsis
      ? `<div style="background: rgba(245, 166, 35, 0.08); border-left: 4px solid #f5a623; padding: 12px 16px; border-radius: 4px; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
          <strong style="color: #f5a623; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Scene Synopsis & Scope</strong>
          ${synopsis}
        </div>`
      : ''
  }

  <!-- The Document Table -->
  <div style="overflow-x: auto; margin-bottom: 24px;">
    <table class="doc-vault-table" style="width: 100%; border-collapse: collapse; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12.5px; text-align: left; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: rgba(148, 163, 184, 0.15); border-bottom: 2px solid #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">
          <th style="padding: 10px 12px; width: 44px; text-align: center; border: 1px solid rgba(148, 163, 184, 0.25);">#</th>
          <th style="padding: 10px 12px; width: 110px; border: 1px solid rgba(148, 163, 184, 0.25);">Category</th>
          <th style="padding: 10px 12px; width: 210px; border: 1px solid rgba(148, 163, 184, 0.25);">Element / Item Name</th>
          <th style="padding: 10px 12px; width: 130px; border: 1px solid rgba(148, 163, 184, 0.25);">Department</th>
          <th style="padding: 10px 12px; border: 1px solid rgba(148, 163, 184, 0.25);">Notes & Specifications</th>
          <th style="padding: 10px 12px; width: 100px; text-align: center; border: 1px solid rgba(148, 163, 184, 0.25);">Status</th>
          <th style="padding: 10px 6px; width: 42px; text-align: center; border: 1px solid rgba(148, 163, 184, 0.25);">Edit</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <!-- Editable Notes & Directives Section Directly Below Table -->
  <div class="doc-notes-below-table" style="margin-top: 24px; padding-top: 18px; border-top: 2px solid rgba(148, 163, 184, 0.25);">
    <h3 style="font-size: 15px; font-weight: 800; margin: 0 0 10px 0; color: inherit; letter-spacing: -0.01em;">Additional Production Notes & Directives</h3>
    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">1. <strong>Safety Officer Standby:</strong> Two dedicated fire safety marshals with Class C extinguishers must remain adjacent to Camera B during pyrotechnic conduit sparks.</p>
    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">2. <strong>Props Handling:</strong> 3 identical brass optical core keys provided; stunt duplicate with rubberized safety tip for combat sequence.</p>
    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">3. <strong>Sound & Atmospheric Haze:</strong> Atmospheric haze density to remain constant at level 2; turbine drone pre-recording will play through cast earpieces.</p>
    <p style="font-size: 13px; line-height: 1.6; margin: 0 0 8px 0;">4. <strong>Camera Rigging:</strong> 50mm Kowa anamorphic rigged on 12-foot dolly track along south wall for Maya's tactical entrance.</p>
    <p class="doc-notes-placeholder" style="font-size: 13px; line-height: 1.6; opacity: 0.6; font-style: italic; margin-top: 14px; padding: 10px 14px; border: 1px dashed rgba(148, 163, 184, 0.4); border-radius: 6px;">(Click here or toggle Edit above to write additional notes, instructions, or text below this table...)</p>
  </div>
</div>
  `.trim();
}

export const SCENE_4_BREAKDOWN_HTML = generateBreakdownHtmlTable(
  '4',
  'STEEL DATA VAULT CORE (INT. NIGHT)',
  SCENE_4_BREAKDOWN_SHEET_DATA,
  'Maya executes tactical drop from ventilation shaft into subterranean core. Confronted by Sterling at the industrial incinerator pit while extracting optical core keys. Combat sequence ensues with pyrotechnic conduit breach.',
  'DAY 1',
  '2 3/8 PGS'
);

export function buildBreakdownSheetDataFromBeat(b: any): any[][] {
  const rows: any[][] = [
    ['#', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status']
  ];
  if (!b) return rows;

  let counter = 1;
  const breakdown = b.breakdown || b.breakdownData || {};

  Object.entries(breakdown).forEach(([catKey, val]: [string, any]) => {
    if (!val) return;
    const catUpper = catKey.toUpperCase();
    const items = Array.isArray(val) ? val : [val];
    items.forEach((item: any) => {
      const name = typeof item === 'string' ? item : item.name || '';
      if (!name) return;
      const dept = typeof item === 'object' && item.departmentId ? item.departmentId : catUpper;
      const notes = typeof item === 'object' ? (item.description || item.source || '') : '';
      const status = 'Confirmed';
      rows.push([String(counter++), catUpper, name, dept, notes, status]);
    });
  });

  return rows;
}

export const INITIAL_DOCUMENTS: ProductionDocument[] = [];

export function getProductionDocuments(projectId?: string): ProductionDocument[] {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const tombstones = getDeletedDocumentIds(activeProjId);

  // FAST PATH: Return in-memory cache immediately in 0.001ms without re-parsing or triggering re-saves
  if (inMemoryDocsCache[activeProjId] && inMemoryDocsCache[activeProjId].length > 0) {
    const cleanCache = inMemoryDocsCache[activeProjId].filter((d) => d && d.id && !tombstones.has(d.id));
    if (cleanCache.length !== inMemoryDocsCache[activeProjId].length) {
      inMemoryDocsCache[activeProjId] = cleanCache;
    }
    return cleanCache;
  }

  try {
    const key = getDocumentStorageKey(projectId);
    let raw = localStorage.getItem(key);
    let parsed: ProductionDocument[] = [];
    if (raw) {
      try {
        const item = JSON.parse(raw);
        if (Array.isArray(item)) {
          parsed = item;
        }
      } catch (parseErr) {}
    }

    const isBreakdownTrash = (doc: ProductionDocument) =>
      doc.id === 'doc-bd-1' ||
      doc.id.startsWith('harvest-breakdown-') ||
      doc.fileName?.startsWith('Breakdown_Sc') ||
      (doc.category === 'BREAKDOWN' && doc.id !== MASTER_BREAKDOWN_DOC_ID);

    const filtered = parsed.filter(
      (doc: ProductionDocument) =>
        doc &&
        doc.id &&
        !tombstones.has(doc.id) &&
        doc.id !== 'doc-ranga-1' &&
        doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
        !(doc.title && doc.title.includes('பைலட் ரங்கா')) &&
        !isBreakdownTrash(doc)
    );

    let hasMigrated = filtered.length !== parsed.length;

    // Ensure exactly ONE Master Production Breakdown sheet exists IF not explicitly deleted
    const hasMaster = filtered.some((d: ProductionDocument) => d.id === MASTER_BREAKDOWN_DOC_ID);
    if (!hasMaster && !tombstones.has(MASTER_BREAKDOWN_DOC_ID)) {
      hasMigrated = true;
      filtered.unshift(createMasterBreakdownDocument(undefined, activeProjId));
    }

    // Ensure SANGILI Master Screenplay exists in the vault and is staged to script IF not explicitly deleted
    const hasSangili = filtered.some((d: ProductionDocument) => d.id === SANGILI_DOCUMENT_ID);
    if (!hasSangili && !tombstones.has(SANGILI_DOCUMENT_ID)) {
      hasMigrated = true;
      filtered.unshift(getSangiliDocument(activeProjId));
    }

    const migrated: ProductionDocument[] = filtered.map((doc: ProductionDocument): ProductionDocument => {
      if (doc.id === MASTER_BREAKDOWN_DOC_ID) {
        if (!doc.textContent || doc.fileType !== 'md' || doc.fileName !== 'Master_Production_Breakdown.md') {
          hasMigrated = true;
          const content = doc.textContent || generateMasterBreakdownMarkdown();
          return {
            ...doc,
            fileType: 'md',
            fileName: 'Master_Production_Breakdown.md',
            textContent: content,
            htmlContent: markdownToHtml(content),
            builtInType: 'breakdown',
            category: 'BREAKDOWN' as const,
          };
        }
      }
      if (doc.id === SANGILI_DOCUMENT_ID) {
        const hasMisclassifiedChars = doc.twoColumnData?.scenes?.some((s: any) =>
          s.items?.some((it: any) => (it.type === 'title' || it.type === 'transition') && /^(?:ஜெயிலர்|பாஸ்டர்|பாஸ்டர் சேவியர்|டாக்டர்)/.test(it.rawText || ''))
        );
        if (!doc.isStagedToScript || !doc.twoColumnData || !doc.twoColumnData.scenes || doc.twoColumnData.scenes.length < 70 || hasMisclassifiedChars) {
          hasMigrated = true;
          const sangiliMaster = getSangiliDocument(activeProjId);
          return {
            ...sangiliMaster,
            ...doc,
            isStagedToScript: true,
            isLeftRightFormat: true,
            hasTwoColumnScript: true,
            category: 'SCRIPT' as const,
            twoColumnData: sangiliMaster.twoColumnData,
            textContent: sangiliMaster.textContent,
            htmlContent: sangiliMaster.htmlContent,
            pageCount: sangiliMaster.pageCount,
          };
        }
      }
      return doc;
    });

    if (typeof localStorage !== 'undefined') {
      try {
        if (!localStorage.getItem('active_two_column_doc_id')) {
          localStorage.setItem('active_two_column_doc_id', SANGILI_DOCUMENT_ID);
        }
      } catch {}
    }

    // If we have an in-memory cache, merge non-destructively so in-memory uploaded docs or heavy binaries are never lost
    let result = migrated;
    if (inMemoryDocsCache[activeProjId] && inMemoryDocsCache[activeProjId].length > 0) {
      inMemoryDocsCache[activeProjId] = inMemoryDocsCache[activeProjId].filter(
        (doc: ProductionDocument) =>
          doc.id !== 'doc-ranga-1' &&
          doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
          !(doc.title && doc.title.includes('பைலட் ரங்கா')) &&
          !isBreakdownTrash(doc)
      );
      result = mergeProductionDocuments(migrated, inMemoryDocsCache[activeProjId]);
    }

    // Safety fallback: Check other localStorage keys (STORAGE_KEY, default, empty-project)
    // so documents uploaded or harvested under base or default accounts are seamlessly preserved
    const fallbackKeys = [
      STORAGE_KEY,
      'backstage_production_documents_default',
      'backstage_production_documents_empty-project'
    ];
    let fallbackDocs: ProductionDocument[] = [];
    fallbackKeys.forEach((fbKey) => {
      if (fbKey !== key) {
        try {
          const fbRaw = localStorage.getItem(fbKey);
          if (fbRaw) {
            const fbParsed = JSON.parse(fbRaw);
            if (Array.isArray(fbParsed)) {
              fallbackDocs.push(...fbParsed);
            }
          }
        } catch {}
      }
    });

    if (fallbackDocs.length > 0) {
      const filteredFallback = fallbackDocs.filter(
        (doc: ProductionDocument) =>
          doc &&
          doc.id &&
          !tombstones.has(doc.id) &&
          doc.id !== 'doc-ranga-1' &&
          doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
          !(doc.title && doc.title.includes('பைலட் ரங்கா')) &&
          !isBreakdownTrash(doc)
      );
      const prevCount = result.length;
      result = mergeProductionDocuments(result, filteredFallback);
      if (result.length !== prevCount) {
        hasMigrated = true;
      }
    }

    inMemoryDocsCache[activeProjId] = result;

    if (hasMigrated) {
      saveProductionDocuments(result, projectId, true);
    }

    return result;
  } catch (e) {
    console.error('Failed to load production documents:', e);
    return inMemoryDocsCache[activeProjId] || [];
  }
}

/**
 * Asynchronously load full production documents from unlimited IndexedDB storage
 */
export async function loadProductionDocumentsAsync(projectId?: string): Promise<ProductionDocument[]> {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const currentSyncDocs = getProductionDocuments(activeProjId);
  try {
    const idbDocs = await loadLargeDocuments(activeProjId);
    if (idbDocs && Array.isArray(idbDocs) && idbDocs.length > 0) {
      const merged = mergeProductionDocuments(currentSyncDocs, idbDocs);
      inMemoryDocsCache[activeProjId] = merged;
      return merged;
    }
  } catch (e) {
    console.warn('[DocVault] Async IndexedDB document load note:', e);
  }
  return currentSyncDocs;
}

/**
 * Safely merge two lists of ProductionDocuments without losing in-flight edits or collaborators' new documents.
 * Uses timestamp-based conflict resolution: the newer version (by updatedAt) wins for metadata fields.
 * Binary assets are always preserved from whichever side has them (union).
 * Annotations and tags are merged additively (never dropped).
 */
export function mergeProductionDocuments(
  existingDocs: ProductionDocument[],
  incomingDocs: ProductionDocument[],
  projectId?: string
): ProductionDocument[] {
  const tombstones = getDeletedDocumentIds(projectId);
  const cleanExisting = (existingDocs || []).filter((d) => d && d.id && !tombstones.has(d.id));
  const cleanIncoming = (incomingDocs || []).filter((d) => d && d.id && !tombstones.has(d.id));

  if (!cleanIncoming || cleanIncoming.length === 0) return cleanExisting;
  if (!cleanExisting || cleanExisting.length === 0) return cleanIncoming;

  const map = new Map<string, ProductionDocument>();

  // Add existing docs first
  cleanExisting.forEach((doc) => {
    if (doc && doc.id) {
      map.set(doc.id, doc);
    }
  });

  // Merge incoming docs
  cleanIncoming.forEach((incoming) => {
    if (!incoming || !incoming.id) return;

    // 1. Look up by exact ID
    let existing = map.get(incoming.id);

    // 2. If not found by ID, look up by matching fileName or originalFileName
    // (Crucial for enriching storage bucket files or cross-table documents)
    if (!existing && (incoming.fileName || incoming.originalFileName)) {
      const stripTs = (s?: string) => (s || '').replace(/^\d+[-_]/, '').toLowerCase().trim();
      const incRaw = (incoming.fileName || incoming.originalFileName || '').toLowerCase().trim();
      const incClean = stripTs(incoming.fileName || incoming.originalFileName);

      for (const [, doc] of map.entries()) {
        const docRaw = (doc.fileName || doc.originalFileName || '').toLowerCase().trim();
        const docClean = stripTs(doc.fileName || doc.originalFileName);

        if (
          (docRaw && (docRaw === incRaw || docRaw === incClean)) ||
          (docClean && (docClean === incClean || docClean === incRaw))
        ) {
          existing = doc;
          break;
        }
      }
    }

    if (!existing) {
      // New document added by collaborator or found in cloud storage
      map.set(incoming.id, incoming);
    } else {
      // Timestamp-based conflict resolution: determine which version is newer for metadata
      const existingTime = new Date(existing.updatedAt || existing.uploadedAt || 0).getTime();
      const incomingTime = new Date(incoming.updatedAt || incoming.uploadedAt || 0).getTime();
      const incomingIsNewer = incomingTime >= existingTime;

      // The "winner" for metadata fields is whichever was edited more recently
      const base = incomingIsNewer ? existing : incoming;
      const winner = incomingIsNewer ? incoming : existing;

      // Merge annotations additively — never drop annotations from either side
      const mergedAnnos = [...(existing.annotations || [])];
      (incoming.annotations || []).forEach((inAnno) => {
        const idx = mergedAnnos.findIndex((a) => a.id === inAnno.id);
        if (idx >= 0) {
          mergedAnnos[idx] = inAnno;
        } else {
          mergedAnnos.push(inAnno);
        }
      });

      const mergedDoc: ProductionDocument = {
        ...base,
        ...winner,
        id: existing.id, // Preserve existing stable ID
        updatedAt: new Date(Math.max(existingTime, incomingTime)).toISOString(),
        // Preserve binary assets from whichever side has them (union, never clear)
        pdfDataUrl: incoming.pdfDataUrl || existing.pdfDataUrl,
        imageDataUrl: incoming.imageDataUrl || existing.imageDataUrl,
        thumbnailDataUrl: incoming.thumbnailDataUrl || existing.thumbnailDataUrl,
        audioUrl: incoming.audioUrl || existing.audioUrl,
        videoUrl: (incoming as any).videoUrl || (existing as any).videoUrl,
        originalFileDataUrl: incoming.originalFileDataUrl || existing.originalFileDataUrl,
        convertedDocxDataUrl: incoming.convertedDocxDataUrl || existing.convertedDocxDataUrl,
        fileSize: incoming.fileSize || existing.fileSize,
        // Content fields: prefer the winner (newer) version, but never clear if winner is empty
        htmlContent: winner.htmlContent || base.htmlContent,
        textContent: winner.textContent || base.textContent,
        sheetData: winner.sheetData || base.sheetData,
        twoColumnData: winner.twoColumnData || base.twoColumnData,
        hasTwoColumnScript: winner.hasTwoColumnScript ?? base.hasTwoColumnScript,
        isLeftRightFormat: winner.isLeftRightFormat ?? base.isLeftRightFormat,
        isBaminiConverted: winner.isBaminiConverted ?? base.isBaminiConverted,
        isBaminiDetected: winner.isBaminiDetected ?? base.isBaminiDetected,
        isStagedToScript: existing.isStagedToScript || incoming.isStagedToScript,
        annotations: mergedAnnos,
        tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])),
      };
      map.set(existing.id, mergedDoc);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
  );
}

/**
 * Debounced cloud save: only push dirty/changed documents to Supabase,
 * not the entire document list. Coalesces rapid saves into a single batch.
 */
const _pendingCloudDocs: Map<string, { projectId: string; doc: ProductionDocument }> = new Map();
let _cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
const CLOUD_SAVE_DEBOUNCE_MS = 2000;

function flushCloudSaves(): void {
  if (_pendingCloudDocs.size === 0) return;
  const batch = Array.from(_pendingCloudDocs.values());
  _pendingCloudDocs.clear();

  // Group by projectId and push
  const byProject = new Map<string, ProductionDocument[]>();
  batch.forEach(({ projectId, doc }) => {
    const list = byProject.get(projectId) || [];
    list.push(doc);
    byProject.set(projectId, list);
  });

  byProject.forEach((docs, projId) => {
    docs.forEach((doc) => {
      saveProjectDocumentToCloud(projId, doc).catch((cloudErr) => {
        console.warn('[DocVault] Cloud document save warning:', cloudErr);
      });
    });

    // Push individual dirty documents first; full list is only synced on explicit project save
    // to avoid freezing the main thread with 3MB JSON serialization every 2 seconds
  });
}

export function scheduleCloudSave(projectId: string, docs: ProductionDocument[], changedDocIds?: Set<string>): void {
  if (!isSupabaseConfigured || !projectId) return;

  // If specific changed IDs provided, only enqueue those; otherwise enqueue all
  const toSave = changedDocIds
    ? docs.filter((d) => changedDocIds.has(d.id))
    : docs;

  toSave.forEach((doc) => {
    _pendingCloudDocs.set(`${projectId}:${doc.id}`, { projectId, doc });
  });

  if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(flushCloudSaves, CLOUD_SAVE_DEBOUNCE_MS);
}

/**
 * Broadcast document updates across all active collaborator browsers in real-time.
 * Sends only changed documents (or all if changedDocIds not provided).
 * Strips huge base64 binaries so broadcast stays within WebSocket 256KB limit.
 */
export function broadcastDocumentsUpdated(
  docs: ProductionDocument[],
  projectId?: string,
  senderId?: string,
  senderInstanceId?: string,
  changedDocIds?: Set<string>
): void {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  if (!activeProjId) return;

  if (isSupabaseConfigured && supabase) {
    try {
      // Only broadcast changed docs (or all if not tracking changes)
      const docsToSend = changedDocIds
        ? docs.filter((d) => changedDocIds.has(d.id))
        : docs;

      // Strip heavy binaries from broadcast payload so WebSocket packet stays well under 256KB
      // Always include thumbnailDataUrl so collaborator laptops see image cards immediately
      const broadcastSafeDocs = docsToSend.map((doc) => ({
        ...doc,
        thumbnailDataUrl: doc.thumbnailDataUrl || undefined,
        pdfDataUrl: doc.pdfDataUrl && doc.pdfDataUrl.startsWith('http') ? doc.pdfDataUrl : (doc.pdfDataUrl && doc.pdfDataUrl.length < 150000 ? doc.pdfDataUrl : undefined),
        originalFileDataUrl: doc.originalFileDataUrl && doc.originalFileDataUrl.startsWith('http') ? doc.originalFileDataUrl : (doc.originalFileDataUrl && doc.originalFileDataUrl.length < 150000 ? doc.originalFileDataUrl : undefined),
        convertedDocxDataUrl: doc.convertedDocxDataUrl && doc.convertedDocxDataUrl.startsWith('http') ? doc.convertedDocxDataUrl : (doc.convertedDocxDataUrl && doc.convertedDocxDataUrl.length < 150000 ? doc.convertedDocxDataUrl : undefined),
        imageDataUrl: doc.imageDataUrl && doc.imageDataUrl.startsWith('http') ? doc.imageDataUrl : (doc.imageDataUrl && doc.imageDataUrl.length < 150000 ? doc.imageDataUrl : (doc.thumbnailDataUrl || undefined)),
      }));

      const payload = {
        projectId: activeProjId,
        documents: broadcastSafeDocs,
        senderId: senderId || 'user',
        senderInstanceId: senderInstanceId || Math.random().toString(36).substring(2, 10),
        timestamp: Date.now()
      };

      // Broadcast to dedicated vault channel
      const vaultChannel = supabase.channel(`vault_realtime_${activeProjId}`);
      vaultChannel.send({
        type: 'broadcast',
        event: 'vault_documents_updated',
        payload
      }).catch((err: any) => console.warn('Supabase vault channel broadcast failed:', err));

      // Also broadcast to project channel for legacy listeners
      const legacyChannel = supabase.channel(`project_changes_${activeProjId}`);
      legacyChannel.send({
        type: 'broadcast',
        event: 'vault_documents_updated',
        payload
      }).catch(() => {});
    } catch (e) {
      console.warn('Realtime channel document broadcast error:', e);
    }
  }
}

export function saveProductionDocuments(
  docs: ProductionDocument[],
  projectId?: string,
  skipCloud = false,
  broadcast = false,
  senderId?: string,
  senderInstanceId?: string,
  changedDocIds?: Set<string>
): void {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');

  // 1. Immediately cache in-memory so synchronous access never loses documents
  inMemoryDocsCache[activeProjId] = docs;

  // 1b. Rust-First Native Disk Storage (zero quota errors, saves 100MB+ safely to disk)
  saveDocumentsToRustDisk(activeProjId, docs).catch(() => {});

  // 2. Persist to unlimited IndexedDB storage (handles 50MB+ PDFs/DOCX with 0 quota errors)
  if (typeof indexedDB !== 'undefined') {
    saveLargeDocuments(activeProjId, docs).catch((idbErr) => {
      console.warn('[DocVault] IndexedDB save notice:', idbErr);
    });
  }

  // 3. Persist to localStorage with QuotaExceededError protection
  // Always strip heavy binaries from localStorage — IndexedDB holds the full versions
  try {
    const key = getDocumentStorageKey(projectId);
    // Slim metadata only for localStorage (under 5KB total) — full twoColumnData and binaries are in RAM and on Rust disk
    const lsDocs = docs.map((doc) => ({
      id: doc.id,
      projectId: doc.projectId,
      title: doc.title,
      titleTa: doc.titleTa,
      category: doc.category,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
      pageCount: doc.pageCount,
      uploadedAt: doc.uploadedAt,
      updatedAt: doc.updatedAt,
      isStagedToScript: doc.isStagedToScript,
      isLeftRightFormat: doc.isLeftRightFormat,
      hasTwoColumnScript: doc.hasTwoColumnScript,
      builtInType: doc.builtInType,
      author: doc.author,
      status: doc.status,
      tags: doc.tags,
      annotations: doc.annotations || [],
      thumbnailDataUrl: doc.thumbnailDataUrl && doc.thumbnailDataUrl.length < 20000 ? doc.thumbnailDataUrl : undefined,
    }));
    localStorage.setItem(key, JSON.stringify(lsDocs));
  } catch (quotaErr) {
    console.warn('[DocVault] localStorage quota exceeded:', quotaErr);
  }

  // 4. Dispatch custom window event
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('backstage_documents_updated', { detail: { docs, projectId: activeProjId, senderInstanceId } }));
    }
  } catch (evErr) {
    console.warn('[DocVault] Window dispatch event error:', evErr);
  }

  // 5. Broadcast only changed documents to active collaborators
  if (broadcast) {
    try {
      broadcastDocumentsUpdated(docs, activeProjId, senderId, senderInstanceId, changedDocIds);
    } catch (bcErr) {
      console.warn('[DocVault] Broadcast error:', bcErr);
    }
  }

  // 6. Debounced background push to Supabase Cloud — only changed documents
  if (!skipCloud && isSupabaseConfigured && activeProjId) {
    scheduleCloudSave(activeProjId, docs, changedDocIds);
  }
}

export function addProductionDocument(
  doc: Omit<ProductionDocument, 'id' | 'uploadedAt' | 'annotations'> & {
    id?: string;
    uploadedAt?: string;
    annotations?: DocumentAnnotation[];
  },
  projectId?: string
): ProductionDocument {
  const activeProjId = projectId || doc.projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  const currentDocs = getProductionDocuments(activeProjId);
  const newDoc: ProductionDocument = {
    id: doc.id || `doc-${Date.now()}`,
    projectId: activeProjId,
    title: doc.title,
    titleTa: doc.titleTa,
    category: doc.category,
    fileName: doc.fileName || `${doc.title.replace(/\s+/g, '_')}.pdf`,
    fileSize: doc.fileSize || '1.1 MB',
    fileType: doc.fileType || 'other',
    pageCount: doc.pageCount || 1,
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pdfDataUrl: doc.pdfDataUrl,
    imageDataUrl: doc.imageDataUrl,
    audioUrl: doc.audioUrl,
    durationSeconds: doc.durationSeconds,
    htmlContent: doc.htmlContent,
    textContent: doc.textContent,
    sheetData: doc.sheetData,
    builtInType: doc.builtInType,
    annotations: doc.annotations || [],
    author: doc.author || 'Production Member',
    isArchived: !!doc.isArchived,
    archivedAt: doc.archivedAt,
    tags: doc.tags || [],
    status: doc.status || 'review',
    originalFileDataUrl: doc.originalFileDataUrl,
    originalFileName: doc.originalFileName,
    convertedDocxDataUrl: doc.convertedDocxDataUrl,
    isBaminiConverted: doc.isBaminiConverted,
    isBaminiDetected: doc.isBaminiDetected,
    isLeftRightFormat: doc.isLeftRightFormat,
    hasTwoColumnScript: doc.hasTwoColumnScript,
    twoColumnData: doc.twoColumnData,
    leftRightDocId: doc.leftRightDocId,
    sourceDocId: doc.sourceDocId,
  };

  // Prevent duplicate titles if exact same ID exists
  const filtered = currentDocs.filter((d) => d.id !== newDoc.id);
  const updated = [newDoc, ...filtered];
  saveProductionDocuments(updated, activeProjId, false, true, undefined, undefined, new Set([newDoc.id]));

  return newDoc;
}

/**
 * Synchronize local documents with Supabase Cloud for a given project.
 * Merges cloud documents with local documents and saves the updated list.
 */
export async function syncDocumentsWithCloud(
  projectId: string,
  userId?: string
): Promise<ProductionDocument[]> {
  let localDocs = await loadProductionDocumentsAsync(projectId);
  if (!isSupabaseConfigured || !projectId) {
    return localDocs;
  }

  // Merge any documents that may have been created under 'empty-project', 'default', or base STORAGE_KEY before project was selected
  if (projectId !== 'empty-project' && projectId !== 'default') {
    const fallbackEmpty = getProductionDocuments('empty-project');
    const fallbackDefault = getProductionDocuments('default');
    const fallbackBase = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    })();
    const orphaned = [...fallbackEmpty, ...fallbackDefault, ...fallbackBase].filter(
      (d: ProductionDocument) => d && d.id && !localDocs.some((ld) => ld.id === d.id || (ld.fileName && ld.fileName === d.fileName))
    );
    if (orphaned.length > 0) {
      const remapped = orphaned.map((d: ProductionDocument) => ({ ...d, projectId }));
      localDocs = mergeProductionDocuments(localDocs, remapped);
      saveProductionDocuments(localDocs, projectId, true);
    }
  }

  // Resolve user id if not explicitly passed
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      resolvedUserId = session?.user?.id;
    } catch {}
  }

  // If user is not authenticated with Supabase, skip remote cloud fetch and return local docs immediately
  if (!resolvedUserId) {
    return localDocs;
  }

  try {
    // 1. Fetch from project_documents PostgreSQL table
    const tableDocsPromise = fetchProjectDocumentsFromCloud(projectId);

    // 2. Fetch from projects table JSON data
    const projectDataPromise = fetchProjectData(projectId);

    // 3. Fetch from Supabase Storage bucket 'vault-files'
    const storageFilesPromise = fetchStorageFilesFromCloud(projectId);

    const [tableDocs, projData, storageDocs] = await Promise.all([
      tableDocsPromise.catch((e) => {
        console.warn('[DocVault] tableDocs fetch notice:', e);
        return null;
      }),
      projectDataPromise.catch((e) => {
        console.warn('[DocVault] projData fetch notice:', e);
        return null;
      }),
      storageFilesPromise.catch((e) => {
        console.warn('[DocVault] storageDocs fetch notice:', e);
        return [];
      }),
    ]);

    const cloudDocsPool: ProductionDocument[] = [];

    // Collect all documents from project_documents table
    if (Array.isArray(tableDocs) && tableDocs.length > 0) {
      cloudDocsPool.push(...tableDocs);
    }

    // Collect all documents from projects.data.documents array
    if (projData && Array.isArray(projData.documents) && projData.documents.length > 0) {
      cloudDocsPool.push(...projData.documents);
    }

    // Collect any standalone uploaded files from Supabase Storage
    if (Array.isArray(storageDocs) && storageDocs.length > 0) {
      cloudDocsPool.push(...storageDocs);
    }

    if (cloudDocsPool.length === 0) {
      // If cloud has no documents yet, push local documents to cloud so other computers and collaborators get them!
      if (localDocs && localDocs.length > 0) {
        saveProjectDocumentsToProjectData(projectId, localDocs).catch(() => {});
        localDocs.forEach((doc) => {
          saveProjectDocumentToCloud(projectId, doc, resolvedUserId).catch(() => {});
        });
      }
      return localDocs;
    }

    // Merge all cloud documents together first (deduplicating across table, JSON, and storage)
    const unifiedCloudDocs = mergeProductionDocuments([], cloudDocsPool);

    // Merge cloud and local non-destructively so in-flight or offline docs are never overwritten
    const merged = mergeProductionDocuments(localDocs, unifiedCloudDocs);

    // CRITICAL FOR CROSS-LAPTOP SYNC: Push merged documents to projects.data.documents so the other laptop receives ALL files immediately!
    if (merged && merged.length > 0) {
      await saveProjectDocumentsToProjectData(projectId, merged).catch((saveErr) => {
        console.warn('[DocVault] Cloud documents push notice in sync:', saveErr);
      });
      // Broadcast to live collaborator laptops
      broadcastDocumentsUpdated(merged, projectId, resolvedUserId);
    }

    // Also push any local documents not yet in cloud to Supabase so collaborators get them!
    const cloudIds = new Set(unifiedCloudDocs.map((cd) => cd.id));
    const cloudFileNames = new Set(unifiedCloudDocs.map((cd) => (cd.fileName || '').toLowerCase()));
    localDocs.forEach((doc) => {
      const isKnownInCloud = cloudIds.has(doc.id) || (doc.fileName && cloudFileNames.has(doc.fileName.toLowerCase()));
      if (!isKnownInCloud) {
        saveProjectDocumentToCloud(projectId, doc, resolvedUserId).catch(() => {});
      }
    });

    saveProductionDocuments(merged, projectId, true, true);
    return merged;
  } catch (err) {
    console.warn("syncDocumentsWithCloud failed:", err);
    return localDocs;
  }
}

/**
 * Archive a document (NO DELETION GUARANTEE)
 * Sets isArchived: true, archivedAt, status: 'archived'
 */
export function archiveProductionDocument(id: string, projectId?: string): boolean {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  const docs = getProductionDocuments(activeProjId);
  let found = false;
  let targetDoc: ProductionDocument | null = null;
  const updated = docs.map((d) => {
    if (d.id === id) {
      found = true;
      targetDoc = {
        ...d,
        isArchived: true,
        archivedAt: new Date().toISOString(),
        status: 'archived' as const,
      };
      return targetDoc;
    }
    return d;
  });

  if (found) {
    saveProductionDocuments(updated, activeProjId);
    if (targetDoc && activeProjId && isSupabaseConfigured) {
      saveProjectDocumentToCloud(activeProjId, targetDoc).catch(() => {});
    }
  }
  return found;
}

/**
 * Restore an archived document back to the active Vault
 */
export function unarchiveProductionDocument(id: string, projectId?: string): boolean {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  const docs = getProductionDocuments(activeProjId);
  let found = false;
  let targetDoc: ProductionDocument | null = null;
  const updated = docs.map((d) => {
    if (d.id === id) {
      found = true;
      targetDoc = {
        ...d,
        isArchived: false,
        archivedAt: undefined,
        status: 'approved' as const,
      };
      return targetDoc;
    }
    return d;
  });

  if (found) {
    saveProductionDocuments(updated, activeProjId);
    if (targetDoc && activeProjId && isSupabaseConfigured) {
      saveProjectDocumentToCloud(activeProjId, targetDoc).catch(() => {});
    }
  }
  return found;
}

/**
 * Permanently delete multiple production documents from local disk, IndexedDB, and cloud.
 * Writes permanent tombstones so they will NEVER reappear on sync.
 */
export function deleteProductionDocuments(
  ids: string | string[],
  projectId?: string
): boolean {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const idList = Array.isArray(ids) ? ids.filter(Boolean) : (ids ? [ids] : []);
  if (idList.length === 0) return true;
  const idSet = new Set(idList);

  // 1. Permanently record tombstones
  recordDocumentDeletion(idList, activeProjId);

  // 2. Remove from in-memory caches across all project slots
  Object.keys(inMemoryDocsCache).forEach((k) => {
    inMemoryDocsCache[k] = (inMemoryDocsCache[k] || []).filter((d) => !idSet.has(d.id));
  });

  // 3. Filter from active project documents and persist to Rust disk & IndexedDB & localStorage
  const currentDocs = getProductionDocuments(activeProjId).filter((d) => !idSet.has(d.id));
  saveProductionDocuments(currentDocs, activeProjId, false, true);

  // 4. Purge from fallback localStorage slots
  const fallbackKeys = [
    STORAGE_KEY,
    'backstage_production_documents_default',
    'backstage_production_documents_empty-project',
    getDocumentStorageKey(activeProjId)
  ];
  fallbackKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((d: any) => !idSet.has(d.id));
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    } catch {}
  });

  // 5. Purge from native Rust disk storage for fallback slots as well
  ['default', 'empty-project', activeProjId].forEach((slot) => {
    loadDocumentsFromRustDisk(slot).then((rustDocs) => {
      if (rustDocs && Array.isArray(rustDocs)) {
        const cleaned = rustDocs.filter((d: any) => !idSet.has(d.id));
        if (cleaned.length !== rustDocs.length) {
          saveDocumentsToRustDisk(slot, cleaned).catch(() => {});
        }
      }
    }).catch(() => {});
  });

  // 6. Delete from Supabase Cloud table
  if (activeProjId && isSupabaseConfigured) {
    idList.forEach((id) => {
      deleteProjectDocumentFromCloud(activeProjId, id).catch(() => {});
    });
  }

  // 7. Dispatch window event to immediately notify all UI views
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('backstage_documents_updated', {
        detail: { docs: currentDocs, projectId: activeProjId }
      }));
    }
  } catch {}

  return true;
}

export function deleteProductionDocument(id: string, projectId?: string): boolean {
  return deleteProductionDocuments(id, projectId);
}

/**
 * Save a Voice Note / Audio Memo directly into the Vault
 */
export function saveVoiceNoteToVault(
  title: string,
  audioDataUrl: string,
  durationSeconds = 0,
  notes?: string,
  author = 'Director / Writer',
  tags?: string[]
): ProductionDocument {
  const finalTags = tags && tags.length > 0
    ? tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
    : ['Voice Note', 'Audio Memo', 'Production Audio'];

  return addProductionDocument({
    title,
    titleTa: 'குரல் குறிப்பு',
    category: 'VOICE_NOTE',
    fileType: 'audio',
    fileName: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.webm`,
    fileSize: `${Math.max(120, Math.round(durationSeconds * 18))} KB`,
    pageCount: 1,
    durationSeconds,
    audioUrl: audioDataUrl,
    builtInType: 'audio',
    author,
    textContent: notes || 'Voice idea recording captured from production studio.',
    status: 'approved',
    tags: finalTags,
  });
}

/**
 * Add or update tags for a specific document
 */
export function updateDocumentTags(id: string, tags: string[], projectId?: string): ProductionDocument | null {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  const docs = getProductionDocuments(activeProjId);
  let updatedDoc: ProductionDocument | null = null;
  const cleaned = Array.from(new Set(tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean)));

  const updatedDocs = docs.map((d) => {
    if (d.id === id) {
      updatedDoc = { ...d, tags: cleaned };
      return updatedDoc;
    }
    return d;
  });

  if (updatedDoc) {
    saveProductionDocuments(updatedDocs, activeProjId);
    if (activeProjId && isSupabaseConfigured) {
      saveProjectDocumentToCloud(activeProjId, updatedDoc).catch(() => {});
    }
  }
  return updatedDoc;
}

/**
 * Save a Canvas / Whiteboard / Scene Snapshot to Vault
 */
export function saveSnapshotToVault(
  title: string,
  imageDataUrl: string,
  category: DocumentCategory = 'SNAPSHOT',
  author = 'Writer / Director'
): ProductionDocument {
  return addProductionDocument({
    title,
    titleTa: 'காட்சி படப்பதிவு',
    category,
    fileType: 'snapshot',
    fileName: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.png`,
    fileSize: '1.4 MB',
    pageCount: 1,
    imageDataUrl,
    builtInType: 'excalidraw',
    author,
    status: 'approved',
    tags: ['Snapshot', 'Visual Blocking', 'Storyboard Frame'],
  });
}

/**
 * Save a Quick Production Note to Vault
 */
export function saveNoteToVault(
  title: string,
  content: string,
  tags: string[] = ['Production Note'],
  author = 'Production Office'
): ProductionDocument {
  return addProductionDocument({
    title,
    titleTa: 'தயாரிப்புக் குறிப்பு',
    category: 'NOTE',
    fileType: 'note',
    fileName: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`,
    fileSize: `${Math.max(10, Math.round(content.length / 100))} KB`,
    pageCount: 1,
    textContent: content,
    builtInType: 'note',
    author,
    status: 'draft',
    tags,
  });
}

/**
 * Save a 1st AD Scene Breakdown Sheet to Vault
 */
export function saveBreakdownToVault(
  _sceneTitle?: string,
  _sceneNumber?: string,
  _itemsCount?: number,
  _htmlPreview?: string,
  _sheetData?: any[][]
): ProductionDocument {
  const existingDocs = getProductionDocuments();
  const master = existingDocs.find(d => d.id === MASTER_BREAKDOWN_DOC_ID);
  if (master) return master;
  return createMasterBreakdownDocument();
}

/**
 * Save a Daily Call Sheet to Vault
 */
export function saveCallSheetToVault(callSheet: any): ProductionDocument {
  const day = callSheet.shootDay || 1;
  const title = `Daily Call Sheet — Day ${day} (${callSheet.locationName || 'Location Shoot'})`;
  const summary = `Shoot Day ${day} of ${callSheet.totalShootDays || 25} • Call Time: ${callSheet.callTime || '06:00 AM'}\nDirector: ${callSheet.director || 'Director'} • 1st AD: ${callSheet.firstAd || '1st AD'}\nLocation: ${callSheet.locationName || 'Main Set'}\nWeather: ${callSheet.weather || 'Clear'}\nScheduled Scenes: ${(callSheet.scheduledScenes || []).join(', ')}`;

  return addProductionDocument({
    title,
    titleTa: `அழைப்பு தாள் — நாள் ${day}`,
    category: 'CALLSHEET',
    fileType: 'callsheet',
    fileName: `CallSheet_Day_${day}_${new Date().toISOString().slice(0, 10)}.pdf`,
    fileSize: '1.1 MB',
    pageCount: 2,
    builtInType: 'callsheet',
    textContent: summary,
    author: callSheet.firstAd || '1st AD',
    status: 'approved',
    tags: ['Callsheet', `Day ${day}`, 'Production Call'],
  });
}

/**
 * Save an Export File / Report snapshot to Vault
 */
export function saveExportToVault(
  title: string,
  format: DocumentFormat,
  dataUrlOrContent: string,
  fileName?: string
): ProductionDocument {
  const isImage = format === 'image';
  const isAudio = format === 'audio';

  return addProductionDocument({
    title,
    titleTa: 'ஏற்றுமதி ஆவணம்',
    category: 'EXPORT',
    fileType: format,
    fileName: fileName || `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format === 'image' ? 'png' : format === 'sheet' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'txt'}`,
    fileSize: '1.5 MB',
    pageCount: 1,
    imageDataUrl: isImage ? dataUrlOrContent : undefined,
    audioUrl: isAudio ? dataUrlOrContent : undefined,
    textContent: !isImage && !isAudio ? dataUrlOrContent : undefined,
    builtInType: 'export',
    author: 'Production System',
    status: 'approved',
    tags: ['Export', format.toUpperCase(), 'Production Report'],
  });
}

/**
 * Intelligent Auto-Harvesting of all assets produced across the application:
 * Crawls project state (beats, notes, voice memos, storyboard shots, character portraits, breakdowns)
 * and safely ensures they are cataloged in the Vault without duplicates!
 */
export function harvestProjectArtifacts(project: any, explicitProjectId?: string): { addedCount: number; documents: ProductionDocument[] } {
  const projId = explicitProjectId || project?.currentProjectId || undefined;
  if (!project) return { addedCount: 0, documents: getProductionDocuments(projId) };

  const existingDocs = getProductionDocuments(projId);
  const existingIds = new Set(existingDocs.map((d) => d.id));
  const newDocs: ProductionDocument[] = [];

  // 1. Harvest Voice Memos & Notes from globalNotes
  if (Array.isArray(project.globalNotes)) {
    project.globalNotes.forEach((note: any, idx: number) => {
      const audioMatch = note.content && note.content.match(/<audio[^>]+src=["']([^"']+)["']/i);
      const isAudio = !!audioMatch;
      const noteDocId = `harvest-gnote-${note.id || idx}`;

      if (!existingIds.has(noteDocId)) {
        const plain = (note.content || '').replace(/<[^>]+>/g, ' ').trim();
        if (isAudio && audioMatch[1]) {
          newDocs.push({
            id: noteDocId,
            title: `Voice Memo #${idx + 1} (Global Scratchpad)`,
            titleTa: 'உலகளாவிய குரல் குறிப்பு',
            category: 'VOICE_NOTE',
            fileType: 'audio',
            fileName: `VoiceMemo_Global_${idx + 1}.webm`,
            fileSize: '480 KB',
            pageCount: 1,
            audioUrl: audioMatch[1],
            durationSeconds: 30,
            uploadedAt: note.timestamp ? new Date(note.timestamp).toISOString() : new Date().toISOString(),
            builtInType: 'audio',
            author: 'Writer / Director',
            textContent: plain || 'Audio recording from Global Scratchpad',
            status: 'approved',
            tags: ['Global Note', 'Voice Memo'],
            annotations: [],
          });
          existingIds.add(noteDocId);
        } else if (plain.length > 5) {
          newDocs.push({
            id: noteDocId,
            title: `Production Memo: ${plain.slice(0, 40)}...`,
            titleTa: 'தயாரிப்புக் குறிப்பு',
            category: 'NOTE',
            fileType: 'note',
            fileName: `Memo_Global_${idx + 1}.txt`,
            fileSize: '45 KB',
            pageCount: 1,
            uploadedAt: note.timestamp ? new Date(note.timestamp).toISOString() : new Date().toISOString(),
            builtInType: 'note',
            author: 'Production Team',
            textContent: plain,
            status: 'approved',
            tags: ['Global Note', 'Scratchpad Memo'],
            annotations: [],
          });
          existingIds.add(noteDocId);
        }
      }
    });
  }

  // 2. Harvest Scene Beat Notes & Voice Memos from beats
  if (Array.isArray(project.beats)) {
    project.beats.forEach((b: any) => {
      if (Array.isArray(b.notes)) {
        b.notes.forEach((n: any, nIdx: number) => {
          const audioMatch = n.content && n.content.match(/<audio[^>]+src=["']([^"']+)["']/i);
          const beatDocId = `harvest-beat-note-${b.id}-${n.id || nIdx}`;

          if (!existingIds.has(beatDocId)) {
            const plain = (n.content || '').replace(/<[^>]+>/g, ' ').trim();
            if (audioMatch && audioMatch[1]) {
              newDocs.push({
                id: beatDocId,
                title: `Sc. ${b.sceneNumber || b.id} Voice Idea (${b.title || 'Scene'})`,
                titleTa: `காட்சி ${b.sceneNumber} குரல் குறிப்பு`,
                category: 'VOICE_NOTE',
                fileType: 'audio',
                fileName: `VoiceIdea_Sc${b.sceneNumber || b.id}_${nIdx + 1}.webm`,
                fileSize: '512 KB',
                pageCount: 1,
                audioUrl: audioMatch[1],
                durationSeconds: 28,
                uploadedAt: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString(),
                builtInType: 'audio',
                author: 'Writer',
                textContent: plain || `Scene ${b.sceneNumber} voice idea memorandum.`,
                status: 'approved',
                tags: [`Scene ${b.sceneNumber}`, 'Voice Idea', 'Script'],
                annotations: [],
              });
              existingIds.add(beatDocId);
            } else if (plain.length > 5) {
              newDocs.push({
                id: beatDocId,
                title: `Sc. ${b.sceneNumber || b.id} Note: ${plain.slice(0, 36)}...`,
                titleTa: `காட்சி ${b.sceneNumber} குறிப்பு`,
                category: 'NOTE',
                fileType: 'note',
                fileName: `Note_Sc${b.sceneNumber || b.id}_${nIdx + 1}.txt`,
                fileSize: '30 KB',
                pageCount: 1,
                uploadedAt: n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString(),
                builtInType: 'note',
                author: 'Writer / AD',
                textContent: plain,
                status: 'approved',
                tags: [`Scene ${b.sceneNumber}`, 'Scene Note'],
                annotations: [],
              });
              existingIds.add(beatDocId);
            }
          }
        });
      }

    });
  }

  // 3. Ensure Exactly ONE Master Production Breakdown Sheet (Pure Markdown, no Notion table)
  if (!existingIds.has(MASTER_BREAKDOWN_DOC_ID)) {
    const masterDoc = createMasterBreakdownDocument(project, projId);
    newDocs.push(masterDoc);
    existingIds.add(MASTER_BREAKDOWN_DOC_ID);
  }

  // 3b. Ensure SANGILI Master Shooting Script is present and staged
  if (!existingIds.has(SANGILI_DOCUMENT_ID)) {
    const sangiliDoc = getSangiliDocument(projId);
    newDocs.unshift(sangiliDoc);
    existingIds.add(SANGILI_DOCUMENT_ID);
  }

  // 4. Harvest Storyboard Shots (Pictures)
  if (Array.isArray(project.generatedShots)) {
    project.generatedShots.forEach((shot: any, sIdx: number) => {
      const shotImage = shot.currentImage || shot.image || (shot.imageHistory && shot.imageHistory[0]);
      const shotDocId = `harvest-shot-${shot.id || sIdx}`;

      if (shotImage && !existingIds.has(shotDocId)) {
        newDocs.push({
          id: shotDocId,
          title: `Storyboard Shot ${sIdx + 1} (Sc. ${shot.scene || '?'}) — ${shot.shotSize || 'Wide'}`,
          titleTa: `காட்சி படம் ${sIdx + 1}`,
          category: 'STORYBOARD',
          fileType: 'image',
          fileName: `Storyboard_Shot_${sIdx + 1}.png`,
          fileSize: '890 KB',
          pageCount: 1,
          imageDataUrl: shotImage,
          uploadedAt: new Date().toISOString(),
          builtInType: 'storyboard',
          author: 'Storyboard Artist / AI Studio',
          textContent: `${shot.shotSize || 'Wide'} • ${shot.angle || 'Eye Level'}\nSubject: ${shot.subject || 'Action'}\n${shot.description || ''}`,
          status: 'approved',
          tags: ['Storyboard', `Sc. ${shot.scene || '?'}`],
          annotations: [],
        });
        existingIds.add(shotDocId);
      }
    });
  }

  // 5. Harvest Character Portrait Art (Pictures)
  if (Array.isArray(project.characterData)) {
    project.characterData.forEach((char: any, cIdx: number) => {
      const portrait = char.portraitImage || char.imageUrl || char.image;
      const charDocId = `harvest-char-${char.id || cIdx}`;

      if (portrait && !existingIds.has(charDocId)) {
        newDocs.push({
          id: charDocId,
          title: `Character Lookbook — ${char.name || `Character ${cIdx + 1}`}`,
          titleTa: `கதாபாத்திர படம் — ${char.nameTa || char.name}`,
          category: 'LOOKBOOK',
          fileType: 'image',
          fileName: `Character_${(char.name || 'Hero').replace(/\s+/g, '_')}.png`,
          fileSize: '1.2 MB',
          pageCount: 1,
          imageDataUrl: portrait,
          uploadedAt: new Date().toISOString(),
          builtInType: 'lookbook',
          author: 'Costume & Character Design',
          textContent: `Role: ${char.role || 'Principal'}\nBio: ${char.bio || ''}\nWardrobe Notes: ${char.wardrobe || 'Standard'}`,
          status: 'approved',
          tags: ['Character Design', char.name || 'Cast'],
          annotations: [],
        });
        existingIds.add(charDocId);
      }
    });
  }

  if (newDocs.length > 0) {
    const updated = [...newDocs, ...existingDocs];
    saveProductionDocuments(updated, projId, false, true);
    return { addedCount: newDocs.length, documents: updated };
  }

  return { addedCount: 0, documents: existingDocs };
}
