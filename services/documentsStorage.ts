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

export const ALL_BREAKDOWN_CATEGORIES = [
  'CAST', 'EXTRAS', 'STUNTS', 'VEHICLES', 'PROPS', 'SFX', 'VFX',
  'WARDROBE', 'MAKEUP', 'ANIMALS', 'SOUND', 'SET_DRESSING',
  'GREENERY', 'SPECIAL_EQUIPMENT', 'LIGHTING_GRIP', 'SAFETY'
] as const;

export function extractItemsFromBeat(beat: any, category: string): any[] {
  const bd = beat?.breakdown || beat?.breakdownData;
  if (!bd) return [];

  const catUpper = category.toUpperCase();
  const direct = bd[catUpper] || bd[category.toLowerCase()];
  if (Array.isArray(direct) && direct.length > 0) {
    return direct.map((item: any, idx: number) => {
      if (typeof item === 'string') return { name: item, count: 1, departmentId: catUpper };
      return {
        name: item.name || 'Unknown Item',
        count: item.count || 1,
        description: item.description || '',
        departmentId: item.departmentId || catUpper,
        source: item.source || ''
      };
    });
  }

  if (Array.isArray(bd.items)) {
    const matched = bd.items.filter((i: any) => (i.category || '').toUpperCase() === catUpper);
    if (matched.length > 0) return matched;
  }

  if (catUpper === 'PROPS' && Array.isArray(bd.props)) return bd.props.map((i: any) => typeof i === 'string' ? { name: i, count: 1 } : i);
  if (catUpper === 'SOUND' && Array.isArray(bd.sound)) return bd.sound.map((i: any) => typeof i === 'string' ? { name: i, count: 1 } : i);
  if (catUpper === 'WARDROBE' && Array.isArray(bd.costume)) return bd.costume.map((i: any) => typeof i === 'string' ? { name: i, count: 1 } : i);
  if (catUpper === 'SFX' && (Array.isArray(bd.vfx) || Array.isArray(bd.practical))) {
    return [...(bd.vfx || []), ...(bd.practical || [])].map((i: any) => typeof i === 'string' ? { name: i, count: 1 } : i);
  }
  if (catUpper === 'CAST' && Array.isArray(bd.cast)) return bd.cast.map((i: any) => typeof i === 'string' ? { name: i, count: 1 } : i);

  return [];
}

/**
 * Builds a unified master spreadsheet with all scene breakdown elements.
 * Rows have 7 columns: ['#', 'Scene', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status']
 */
export function buildMasterBreakdownSheetData(beats: any[] = []): any[][] {
  const rows: any[][] = [
    ['#', 'Scene', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status']
  ];

  let counter = 1;
  const validBeats = Array.isArray(beats) && beats.length > 0 ? beats : [];

  validBeats.forEach((b: any, bIdx: number) => {
    const sceneNum = b.sceneNumber || String(bIdx + 1);
    const sceneLabel = `Scene ${sceneNum}`;
    const bd = b.breakdown || b.breakdownData;

    let sceneItemCount = 0;
    if (bd && Object.keys(bd).length > 0) {
      ALL_BREAKDOWN_CATEGORIES.forEach((cat) => {
        const items = extractItemsFromBeat(b, cat);
        items.forEach((item: any) => {
          const name = typeof item === 'string' ? item : item.name || '';
          if (!name) return;
          const dept = typeof item === 'object' && item.departmentId ? item.departmentId : cat;
          const notes = typeof item === 'object'
            ? (item.description || item.source || (item.count && item.count > 1 ? `Qty: ${item.count}` : ''))
            : '';
          const status = 'Confirmed';
          rows.push([
            String(counter++),
            sceneLabel,
            cat,
            name,
            dept,
            notes,
            status
          ]);
          sceneItemCount++;
        });
      });
    }

    if (sceneItemCount === 0) {
      const loc = `${b.slug?.prefix || 'INT.'} ${b.slug?.location || b.title || 'LOCATION'} - ${b.slug?.time || 'DAY'}`;
      rows.push([
        String(counter++),
        sceneLabel,
        'SET_DRESSING',
        loc,
        'Art Department',
        b.content ? b.content.replace(/<[^>]*>/g, ' ').slice(0, 75).trim() : 'Primary scene set',
        'Scheduled'
      ]);
      if (Array.isArray(b.characters) && b.characters.length > 0) {
        b.characters.forEach((char: any) => {
          const charName = typeof char === 'string' ? char : char.name || '';
          if (charName) {
            rows.push([
              String(counter++),
              sceneLabel,
              'CAST',
              charName,
              'Cast',
              'Key Scene Character',
              'Confirmed'
            ]);
          }
        });
      }
    }
  });

  // If no beats were provided, supply baseline rich multi-scene sample
  if (rows.length <= 1) {
    const sampleScenes = [
      { scene: 'Scene 1', rows: [
        ['CAST', 'Maya (Lead)', 'Cast', 'Wired earpiece, undercover civilian dress', 'Confirmed'],
        ['CAST', 'Informant Raju', 'Cast', 'Shabby raincoat, vintage wrist watch', 'Confirmed'],
        ['PROPS', 'Encrypted Datapad', 'Props', 'Hero Prop: Foldable transparent OLED tablet', 'Confirmed'],
        ['SOUND', 'Heavy Rain & Distant Sirens', 'Sound Design', 'Exterior city ambience, gutter splash', 'Pre-recorded'],
        ['SET_DRESSING', 'Harbor Cafe Corner Booth', 'Set Dressing', 'Flickering neon sign, steaming teapot', 'Dressed']
      ]},
      { scene: 'Scene 2', rows: [
        ['CAST', 'Maya (Lead)', 'Cast', 'Tactical stealth jumpsuit with harness', 'Confirmed'],
        ['CAST', 'Sterling', 'Cast', 'Vault Security Director in bespoke suit', 'Confirmed'],
        ['STUNTS', 'Catwalk Drop & Decelerator Rig', 'Stunts & Action', '15ft drop onto steel catwalk', 'Rigged & Tested'],
        ['PROPS', 'Optical Core Access Key', 'Props', 'Amber cryo-key with illuminated laser etching', 'Hero Prop Ready'],
        ['SFX', 'Severed Conduit Spark Discharge', 'SFX / Practical', 'Controlled pyrotechnic electrical arc box', 'Rigged by SFX'],
        ['VFX', 'Golden Holographic Data Stream', 'VFX / Post', 'Volumetric holographic stream from pedestal', 'Post Plate'],
        ['SAFETY', 'Fire Safety Marshals (x2)', 'Safety & Medic', 'Class C fire suppression adjacent to set', 'Standby Confirmed']
      ]},
      { scene: 'Scene 3', rows: [
        ['CAST', 'Sterling', 'Cast', 'Bloodied cuffs, disheveled tie', 'Confirmed'],
        ['CAST', 'Security Officers (x4)', 'Extras / Atmosphere', 'Tactical gear, Kevlar vests', 'Scheduled'],
        ['VEHICLES', 'Black Armored Tactical Van', 'Vehicles', 'Hero getaway vehicle with tinted glass', 'On Set'],
        ['PROPS', 'Satellite Phone', 'Props', 'Rugged military satphone with blinking antenna', 'Checked'],
        ['SOUND', 'Helicopter Rotor Blade Wash', 'Sound FX', 'Low frequency downdraft resonance', 'Mastered']
      ]}
    ];

    sampleScenes.forEach((sc) => {
      sc.rows.forEach((r) => {
        rows.push([String(counter++), sc.scene, r[0], r[1], r[2], r[3], r[4]]);
      });
    });
  }

  return rows;
}

/**
 * Generates an executive studio-grade multi-scene Master Breakdown HTML document.
 */
export function generateMasterBreakdownHtml(
  projectName = 'Feature Film Production',
  beats: any[] = [],
  sheetRows?: any[][]
): string {
  const masterData = sheetRows || buildMasterBreakdownSheetData(beats);
  const dataRows = masterData.length > 1 ? masterData.slice(1) : [];
  const totalElements = dataRows.length;

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
    LOCATION: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  };

  // Group items by Scene
  const scenesMap: Record<string, any[]> = {};
  dataRows.forEach((r) => {
    const sc = String(r[1] || 'Scene 1');
    if (!scenesMap[sc]) scenesMap[sc] = [];
    scenesMap[sc].push(r);
  });

  const sceneKeys = Object.keys(scenesMap);
  const totalScenes = sceneKeys.length;

  // KPI calculations
  const countCategory = (cat: string) => dataRows.filter((r) => String(r[2]).toUpperCase() === cat).length;
  const castCount = countCategory('CAST') + countCategory('EXTRAS');
  const propsCount = countCategory('PROPS') + countCategory('SET_DRESSING');
  const stuntsCount = countCategory('STUNTS');
  const sfxCount = countCategory('SFX');
  const vfxCount = countCategory('VFX');
  const vehiclesCount = countCategory('VEHICLES');
  const soundCount = countCategory('SOUND');
  const uniqueDepts = new Set(dataRows.map((r) => String(r[4] || '').trim().toLowerCase())).size;

  // Cross-Scene Character Roster
  const castRoster: Record<string, Set<string>> = {};
  dataRows.forEach((r) => {
    if (String(r[2]).toUpperCase() === 'CAST') {
      const charName = String(r[3] || '').trim();
      const sc = String(r[1] || '');
      if (charName) {
        if (!castRoster[charName]) castRoster[charName] = new Set();
        castRoster[charName].add(sc);
      }
    }
  });

  // Cross-Scene Key Props Roster
  const propsRoster: Record<string, { dept: string; scenes: Set<string>; notes: string }> = {};
  dataRows.forEach((r) => {
    if (['PROPS', 'VEHICLES', 'STUNTS', 'SFX'].includes(String(r[2]).toUpperCase())) {
      const itemName = String(r[3] || '').trim();
      const sc = String(r[1] || '');
      if (itemName) {
        if (!propsRoster[itemName]) {
          propsRoster[itemName] = { dept: String(r[4] || r[2]), scenes: new Set(), notes: String(r[5] || '') };
        }
        propsRoster[itemName].scenes.add(sc);
      }
    }
  });

  // Render Scene Quick-Jump Navbar
  const quickJumpNav = sceneKeys.map((sc) => {
    const scId = sc.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const count = scenesMap[sc].length;
    return `
      <a href="#${scId}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; background: rgba(245, 166, 35, 0.12); color: #f5a623; border: 1px solid rgba(245, 166, 35, 0.35); text-decoration: none; font-size: 11px; font-weight: 700; margin: 3px; font-family: 'JetBrains Mono', monospace; transition: all 0.15s ease;">
        <span>${sc}</span>
        <span style="opacity: 0.7; font-size: 10px;">(${count})</span>
      </a>
    `;
  }).join('');

  // Render Each Scene Breakdown Section
  const sceneSectionsHtml = sceneKeys.map((sc, scIdx) => {
    const scId = sc.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const items = scenesMap[sc];
    const matchingBeat = Array.isArray(beats) ? beats.find((b) => `Scene ${b.sceneNumber || b.id}` === sc || b.id === sc.replace(/\D/g, '')) : null;
    const sceneHeading = matchingBeat
      ? `${matchingBeat.slug?.prefix || 'INT.'} ${matchingBeat.slug?.location || matchingBeat.title || 'LOCATION'} - ${matchingBeat.slug?.time || 'DAY'}`
      : `PRODUCTION LOCATION • SCENE SETUP`;
    const synopsis = matchingBeat?.content ? matchingBeat.content.replace(/<[^>]*>/g, ' ').slice(0, 180).trim() : '';

    const tableRowsHtml = items.map((r, itemIdx) => {
      const num = r[0] || itemIdx + 1;
      const cat = String(r[2] || 'PROPS').toUpperCase();
      const name = r[3] || '';
      const dept = r[4] || cat;
      const notes = r[5] || '';
      const status = r[6] || 'Confirmed';
      const style = categoryColorMap[cat] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
      const zebraBg = itemIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

      const statusLower = String(status).toLowerCase();
      const statusColor = statusLower.includes('confirm') || statusLower.includes('ready') || statusLower.includes('approved')
        ? 'background: #dcfce7; color: #166534; border: 1px solid #86efac;'
        : statusLower.includes('rig') || statusLower.includes('rehears')
        ? 'background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc;'
        : 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;';

      return `
        <tr style="background: ${zebraBg}; border-bottom: 1px solid #e2e8f0;" class="doc-table-row">
          <td style="padding: 9px 12px; font-weight: 700; color: #64748b; font-family: 'JetBrains Mono', monospace; text-align: center; width: 44px;">${num}</td>
          <td style="padding: 9px 12px; width: 110px;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border};">
              ${cat}
            </span>
          </td>
          <td style="padding: 9px 12px; font-weight: 700; color: #0f172a; font-size: 13px;">${name}</td>
          <td style="padding: 9px 12px; color: #475569; font-size: 12px;">
            <span style="background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 600;">${dept}</span>
          </td>
          <td style="padding: 9px 12px; color: #334155; font-size: 12px; line-height: 1.4;">${notes || '—'}</td>
          <td style="padding: 9px 12px; text-align: center; width: 100px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; ${statusColor}">${status}</span>
          </td>
          <td style="padding: 8px 6px; text-align: center; width: 40px;" class="doc-action-cell">
            <button type="button" class="doc-delete-row-btn" data-delete-row="true" style="background: rgba(239,68,68,0.12); color: #dc2626; border: 1px solid rgba(239,68,68,0.35); border-radius: 5px; width: 22px; height: 22px; line-height: 20px; font-size: 11px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; justify-content: center;" title="Remove element">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div id="${scId}" class="doc-scene-card" style="margin-bottom: 28px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
        <!-- Scene Header Strip -->
        <div style="background: #0f172a; color: #ffffff; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: gap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="background: #f5a623; color: #000000; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;">${sc}</span>
              <span style="font-size: 11px; color: #94a3b8; font-family: 'JetBrains Mono', monospace;">SHOOT DAY ${Math.ceil((scIdx + 1) / 2)} &bull; ${items.length} PRODUCTION ELEMENTS</span>
            </div>
            <h2 style="margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: #f8fafc;">${sceneHeading}</h2>
          </div>
          <a href="#master-overview" style="color: #94a3b8; font-size: 11px; text-decoration: none; border: 1px solid #334155; padding: 4px 8px; border-radius: 6px;">↑ Back to Top</a>
        </div>

        ${synopsis ? `
          <div style="background: #fffbeb; border-left: 4px solid #f5a623; padding: 10px 16px; font-size: 12.5px; color: #78350f; line-height: 1.45;">
            <strong style="text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Scene Synopsis & Dramatic Scope:</strong>
            ${synopsis}
          </div>
        ` : ''}

        <!-- Scene Table -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.04em;">
                <th style="padding: 9px 12px; text-align: center; width: 44px;">#</th>
                <th style="padding: 9px 12px; width: 110px;">Category</th>
                <th style="padding: 9px 12px; width: 220px;">Element / Item Name</th>
                <th style="padding: 9px 12px; width: 120px;">Department</th>
                <th style="padding: 9px 12px;">Notes & Specifications</th>
                <th style="padding: 9px 12px; text-align: center; width: 100px;">Status</th>
                <th style="padding: 9px 6px; text-align: center; width: 40px;">Edit</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  // Cross-Scene Cast Roster Table
  const castRosterRows = Object.entries(castRoster).map(([char, scenes]) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; font-size: 12.5px;">${char}</td>
      <td style="padding: 8px 12px; color: #475569; font-size: 12px;">Principal / Lead Role</td>
      <td style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #f5a623; font-weight: 600;">${Array.from(scenes).join(', ')}</td>
      <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #0f172a;">${scenes.size} Scenes</td>
    </tr>
  `).join('');

  // Cross-Scene Props & Gear Table
  const propsRosterRows = Object.entries(propsRoster).slice(0, 15).map(([item, info]) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; font-size: 12.5px;">${item}</td>
      <td style="padding: 8px 12px; color: #475569; font-size: 11.5px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${info.dept}</span></td>
      <td style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #0284c7; font-weight: 600;">${Array.from(info.scenes).join(', ')}</td>
      <td style="padding: 8px 12px; color: #64748b; font-size: 11.5px;">${info.notes || 'Hero continuity item'}</td>
    </tr>
  `).join('');

  return `
<div id="master-overview" class="doc-document-wrapper master-breakdown-document" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; width: 100%; line-height: 1.5;">

  <!-- Executive Document Header -->
  <div style="margin-bottom: 24px; border-bottom: 2px solid #cbd5e1; padding-bottom: 18px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #f5a623; color: #000000; font-weight: 900; font-size: 10.5px; padding: 3px 9px; border-radius: 4px; letter-spacing: 0.06em; text-transform: uppercase;">1ST AD MASTER PRODUCTION BREAKDOWN</span>
        <span style="background: #e2e8f0; color: #334155; font-size: 10.5px; padding: 2px 8px; border-radius: 4px; font-weight: 700;">COMPLETE SCRIPT LEDGER</span>
      </div>
      <span style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #64748b; text-transform: uppercase;">ALL SCENES CONSOLIDATED &bull; CONFIDENTIAL</span>
    </div>
    <h1 style="margin: 0 0 4px 0; font-size: 26px; font-weight: 900; letter-spacing: -0.02em; color: #0f172a;">${projectName}: Master Script Breakdown & Elements</h1>
    <p style="margin: 0; font-size: 13px; color: #64748b;">Consolidated 1st AD Pre-Production Roster across all scenes, departments, action stunts, and hero continuity assets.</p>
  </div>

  <!-- Executive Metric KPI Cards -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Total Scenes</span>
      <span style="font-size: 22px; font-weight: 900; color: #f5a623; font-family: 'JetBrains Mono', monospace;">${totalScenes}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Total Elements</span>
      <span style="font-size: 22px; font-weight: 900; color: #0284c7; font-family: 'JetBrains Mono', monospace;">${totalElements}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Cast & Extras</span>
      <span style="font-size: 22px; font-weight: 900; color: #dc2626; font-family: 'JetBrains Mono', monospace;">${castCount}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Props & Dressing</span>
      <span style="font-size: 22px; font-weight: 900; color: #9333ea; font-family: 'JetBrains Mono', monospace;">${propsCount}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Stunts & Action</span>
      <span style="font-size: 22px; font-weight: 900; color: #ea580c; font-family: 'JetBrains Mono', monospace;">${stuntsCount}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">SFX & VFX</span>
      <span style="font-size: 22px; font-weight: 900; color: #0891b2; font-family: 'JetBrains Mono', monospace;">${sfxCount + vfxCount}</span>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
      <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; font-family: 'JetBrains Mono', monospace;">Depts Involved</span>
      <span style="font-size: 22px; font-weight: 900; color: #16a34a; font-family: 'JetBrains Mono', monospace;">${uniqueDepts || 10}</span>
    </div>
  </div>

  <!-- Interactive Quick-Jump Scene Navbar -->
  <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin-bottom: 28px;">
    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
      <span>⚡ Quick Scene Jump Directory (Click to Review Individual Scene Breakdown):</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748b;">${totalScenes} SCENES INDEXED</span>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
      ${quickJumpNav}
    </div>
  </div>

  <!-- INDIVIDUAL SCENES BREAKDOWN (ALL SCENES CONSOLIDATED) -->
  <div style="margin-bottom: 36px;">
    <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 16px 0; border-left: 4px solid #f5a623; padding-left: 10px; text-transform: uppercase; letter-spacing: 0.02em;">
      Part 1: Scene-by-Scene Breakdown Ledger
    </h2>
    ${sceneSectionsHtml}
  </div>

  <!-- PART 2: CROSS-SCENE EXECUTIVE LOGISTICS & ROSTERS ("and stuff") -->
  <div style="margin-top: 36px; padding-top: 24px; border-top: 2px solid #cbd5e1;">
    <h2 style="font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 16px 0; border-left: 4px solid #0284c7; padding-left: 10px; text-transform: uppercase; letter-spacing: 0.02em;">
      Part 2: Cross-Scene Department Directory & Logistics ("and stuff")
    </h2>

    <!-- Cross-Scene Cast Table -->
    <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;">
      <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 800; font-size: 12px; color: #334155; text-transform: uppercase;">
        🎭 Master Cast Appearance Ledger Across Scenes
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">
            <th style="padding: 8px 12px; text-align: left;">Character Name</th>
            <th style="padding: 8px 12px; text-align: left;">Role Classification</th>
            <th style="padding: 8px 12px; text-align: left;">Scenes Required</th>
            <th style="padding: 8px 12px; text-align: center;">Total Scenes</th>
          </tr>
        </thead>
        <tbody>
          ${castRosterRows || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No character roles logged yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Cross-Scene Key Props & Stunts Table -->
    <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #ffffff;">
      <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 800; font-size: 12px; color: #334155; text-transform: uppercase;">
        📦 Hero Props, Vehicles, Stunts & Action Directory
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">
            <th style="padding: 8px 12px; text-align: left;">Item / Asset Name</th>
            <th style="padding: 8px 12px; text-align: left;">Department</th>
            <th style="padding: 8px 12px; text-align: left;">Scenes Required</th>
            <th style="padding: 8px 12px; text-align: left;">Continuity & Handling Notes</th>
          </tr>
        </thead>
        <tbody>
          ${propsRosterRows || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No props or stunt assets logged yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Production Safety Protocols & Staging Directives -->
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 12.5px; color: #991b1b; line-height: 1.6;">
      <h3 style="margin: 0 0 8px 0; font-size: 13.5px; font-weight: 800; text-transform: uppercase; color: #b91c1c;">
        ⚠️ Production Safety Standby & Turnaround Directives
      </h3>
      <p style="margin: 0 0 6px 0;">1. <strong>Class C Fire Marshals:</strong> Mandatory for all scenes involving pyrotechnic conduit sparks, incinerator burns, or atmospheric haze generators.</p>
      <p style="margin: 0 0 6px 0;">2. <strong>Stunt Decelerator Inspections:</strong> All overhead rigging, catwalk wire rigs, and breakaway glass panels must be proof-tested by the Stunt Coordinator 90 minutes prior to first call.</p>
      <p style="margin: 0 0 6px 0;">3. <strong>Hero Props Security:</strong> Optical core cryo-keys and classified dossiers are stored in the Production Armory safe between takes.</p>
      <p style="margin: 0;">4. <strong>Actor Turnaround & Medical:</strong> 12-hour rest turnaround guaranteed between night shoots and day unit calls. On-set paramedic stationed at Basecamp.</p>
    </div>
  </div>

</div>
  `.trim();
}

export const MASTER_BREAKDOWN_DOC_ID = 'harvest-master-breakdown';

/**
 * Generates a single complete ProductionDocument containing all scene breakdown data and cross-scene logistics.
 */
export function generateMasterBreakdownDocument(
  projectName = 'Feature Film Production',
  beats: any[] = []
): ProductionDocument {
  const sheetData = buildMasterBreakdownSheetData(beats);
  const dataRows = sheetData.slice(1);
  const totalElements = dataRows.length;
  const uniqueScenes = Array.from(new Set(dataRows.map((r) => r[1]))).length;

  const htmlContent = generateMasterBreakdownHtml(projectName, beats, sheetData);

  // Structured searchable text representation for Myers diff and BM25 search
  let textSummary = `MASTER SCRIPT BREAKDOWN & PRODUCTION ELEMENTS (ALL SCENES)\nProject: ${projectName}\nTotal Scenes: ${uniqueScenes} • Total Elements: ${totalElements} across ${beats.length || 1} script scenes.\n\n`;

  const sceneGroups: Record<string, any[]> = {};
  dataRows.forEach((r) => {
    const sc = r[1];
    if (!sceneGroups[sc]) sceneGroups[sc] = [];
    sceneGroups[sc].push(r);
  });

  Object.entries(sceneGroups).forEach(([sceneName, rows]) => {
    textSummary += `=== ${String(sceneName).toUpperCase()} (${rows.length} Elements) ===\n`;
    rows.forEach((r) => {
      textSummary += `[${r[2]}] ${r[3]} (${r[4]}): ${r[5]} [${r[6]}]\n`;
    });
    textSummary += '\n';
  });

  return {
    id: MASTER_BREAKDOWN_DOC_ID,
    title: 'Master Script Breakdown & Production Elements (All Scenes)',
    titleTa: 'முழுமையான திரைக்கதை தயாரிப்பு குறிப்பு தாள்',
    category: 'BREAKDOWN',
    fileType: 'breakdown',
    fileName: 'Master_Script_Breakdown_All_Scenes.pdf',
    fileSize: `${Math.max(480, totalElements * 45)} KB`,
    pageCount: Math.max(1, Math.ceil(uniqueScenes * 1.5)),
    builtInType: 'breakdown',
    sheetData,
    htmlContent,
    textContent: textSummary,
    author: '1st AD & Production Unit',
    status: 'approved',
    uploadedAt: new Date().toISOString(),
    tags: ['Master Breakdown', 'All Scenes', '1st AD', 'Production', 'Stripboard', 'Department Sync'],
    annotations: [],
  };
}

/**
 * Save or update the single Master All-Scenes Breakdown Sheet directly to the Vault.
 */
export function saveMasterBreakdownToVault(
  beats: any[] = [],
  projectName = 'Feature Film Production',
  explicitProjectId?: string
): ProductionDocument {
  const masterDoc = generateMasterBreakdownDocument(projectName, beats);
  const projId = explicitProjectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');
  const existingDocs = getProductionDocuments(projId);

  // Non-destructively consolidate: filter out legacy single-scene fragmented breakdown docs
  const filtered = existingDocs.filter(
    (d) => d.id !== MASTER_BREAKDOWN_DOC_ID && !d.id.startsWith('harvest-breakdown-')
  );
  const updated = [masterDoc, ...filtered];
  saveProductionDocuments(updated, projId, true, true);
  return masterDoc;
}

export const INITIAL_DOCUMENTS: ProductionDocument[] = [];

export function getProductionDocuments(projectId?: string): ProductionDocument[] {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || 'default' : 'default');

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

    const filtered = parsed.filter(
      (doc: ProductionDocument) =>
        doc.id !== 'doc-ranga-1' &&
        doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
        !(doc.title && doc.title.includes('பைலட் ரங்கா'))
    );

    // Auto-migration & Consolidation:
    // If fragmented single-scene breakdown documents exist, consolidate them into a single Master Breakdown Document!
    let hasMigrated = filtered.length !== parsed.length;
    let consolidated = filtered;
    const hasFragmentedBreakdowns = filtered.some((d: ProductionDocument) => d.id.startsWith('harvest-breakdown-'));
    if (hasFragmentedBreakdowns) {
      hasMigrated = true;
      consolidated = filtered.filter((d: ProductionDocument) => !d.id.startsWith('harvest-breakdown-'));
      if (!consolidated.some((d: ProductionDocument) => d.id === MASTER_BREAKDOWN_DOC_ID)) {
        consolidated.unshift(generateMasterBreakdownDocument());
      }
    }

    // Auto-migration: ensure doc-bd-1 breakdown document has sheetData if present
    const migrated = consolidated.map((doc: ProductionDocument) => {
      if (doc.id === 'doc-bd-1') {
        if (!doc.sheetData || doc.sheetData.length <= 1 || !doc.htmlContent || !doc.htmlContent.includes('doc-delete-row-btn')) {
          hasMigrated = true;
          return {
            ...doc,
            sheetData: SCENE_4_BREAKDOWN_SHEET_DATA,
            htmlContent: SCENE_4_BREAKDOWN_HTML,
            textContent: `Scene 4 Breakdown Sheet: 16 Production Elements across 10 Departments.\nCast: Maya, Sterling\nExtras: Vault Security Tactical Officers\nStunts: Catwalk Drop & Decelerator Rig, Incinerator Combat\nProps: Optical Core Access Key, Land Deeds Dossier, Brass Release Wheel\nSFX & VFX: Conduit Spark Discharge, Incinerator Heat Glow, Golden Holographic Stream\nSound: Subterranean Turbine Drone, Pneumatic Door Slam\nSet Dressing: Core Server Racks\nLighting: Anamorphic Flare & Laser Grid\nSafety: Fire Safety Standby`,
          };
        }
      }
      return doc;
    });

    // If we have an in-memory cache, merge non-destructively so in-memory uploaded docs or heavy binaries are never lost
    let result = migrated;
    if (inMemoryDocsCache[activeProjId] && inMemoryDocsCache[activeProjId].length > 0) {
      inMemoryDocsCache[activeProjId] = inMemoryDocsCache[activeProjId].filter(
        (doc: ProductionDocument) =>
          doc.id !== 'doc-ranga-1' &&
          doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
          !(doc.title && doc.title.includes('பைலட் ரங்கா'))
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
          doc.id !== 'doc-ranga-1' &&
          doc.fileName !== 'Pilot_Ranga_Screenplay.docx' &&
          !(doc.title && doc.title.includes('பைலட் ரங்கா'))
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
  incomingDocs: ProductionDocument[]
): ProductionDocument[] {
  if (!incomingDocs || incomingDocs.length === 0) return existingDocs || [];
  if (!existingDocs || existingDocs.length === 0) return incomingDocs || [];

  const map = new Map<string, ProductionDocument>();

  // Add existing docs first
  existingDocs.forEach((doc) => {
    if (doc && doc.id) {
      map.set(doc.id, doc);
    }
  });

  // Merge incoming docs
  incomingDocs.forEach((incoming) => {
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

    // Also push the complete list of documents to projects.data.documents
    // to ensure 100% sync reliability across laptops even when project_documents table is absent
    loadLargeDocuments(projId)
      .then((idbDocs) => {
        const allProjDocs = getProductionDocuments(projId);
        const fullList = mergeProductionDocuments(allProjDocs, idbDocs || []);
        if (fullList && fullList.length > 0) {
          saveProjectDocumentsToProjectData(projId, fullList).catch(() => {});
        }
      })
      .catch(() => {
        const allProjDocs = getProductionDocuments(projId);
        if (allProjDocs && allProjDocs.length > 0) {
          saveProjectDocumentsToProjectData(projId, allProjDocs).catch(() => {});
        }
      });
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
    const lsDocs = docs.map((doc) => ({
      ...doc,
      thumbnailDataUrl: doc.thumbnailDataUrl || undefined,
      pdfDataUrl: doc.pdfDataUrl && doc.pdfDataUrl.length > 80000 ? undefined : doc.pdfDataUrl,
      originalFileDataUrl: doc.originalFileDataUrl && doc.originalFileDataUrl.length > 80000 ? undefined : doc.originalFileDataUrl,
      convertedDocxDataUrl: doc.convertedDocxDataUrl && doc.convertedDocxDataUrl.length > 80000 ? undefined : doc.convertedDocxDataUrl,
      imageDataUrl: doc.imageDataUrl && doc.imageDataUrl.length > 80000 ? (doc.thumbnailDataUrl || undefined) : doc.imageDataUrl,
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

export function deleteProductionDocument(id: string, projectId?: string): boolean {
  const activeProjId = projectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') || undefined : undefined);
  const docs = getProductionDocuments(activeProjId);
  const updated = docs.filter(d => d.id !== id);
  saveProductionDocuments(updated, activeProjId);
  if (activeProjId && isSupabaseConfigured) {
    deleteProjectDocumentFromCloud(activeProjId, id).catch(() => {});
  }
  return true;
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
  sceneTitle: string,
  sceneNumber: string,
  itemsCount: number,
  htmlPreview?: string,
  sheetData?: any[][]
): ProductionDocument {
  const finalSheetData = sheetData || [
    ['#', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status'],
    ['1', 'CAST', `${sceneTitle} Cast`, 'Cast', 'Key Scene Cast', 'Confirmed']
  ];

  const finalHtml = htmlPreview || generateBreakdownHtmlTable(
    sceneNumber,
    sceneTitle,
    finalSheetData,
    `Production Breakdown for Scene ${sceneNumber}: ${sceneTitle}`,
    'DAY 1',
    '1 PG'
  );

  return addProductionDocument({
    title: `Scene ${sceneNumber} Breakdown Sheet (${sceneTitle})`,
    titleTa: `காட்சி ${sceneNumber} குறிப்பு தாள்`,
    category: 'BREAKDOWN',
    fileType: 'breakdown',
    fileName: `Breakdown_Scene_${sceneNumber}.pdf`,
    fileSize: `${Math.max(250, itemsCount * 45)} KB`,
    pageCount: 1,
    builtInType: 'breakdown',
    sheetData: finalSheetData,
    htmlContent: finalHtml,
    textContent: `Breakdown Sheet for Scene ${sceneNumber}: ${sceneTitle}. Total Elements: ${itemsCount || (finalSheetData.length - 1)}`,
    author: '1st AD Breakdown Supervisor',
    status: 'approved',
    tags: ['Breakdown', `Scene ${sceneNumber}`, '1st AD'],
  });
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

    // 3. Harvest Consolidated Master Script Breakdown Document (All scenes in ONE single document!)
    if (Array.isArray(project.beats) && project.beats.length > 0) {
      if (!existingIds.has(MASTER_BREAKDOWN_DOC_ID)) {
        const masterDoc = generateMasterBreakdownDocument(project.title || project.name || 'Feature Film Production', project.beats);
        newDocs.push(masterDoc);
        existingIds.add(MASTER_BREAKDOWN_DOC_ID);
      }
    }
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

  // Prune any legacy fragmented single-scene breakdown files so the Document Vault stays clean!
  const consolidatedExisting = existingDocs.filter((d) => !d.id.startsWith('harvest-breakdown-'));
  const hasConsolidated = consolidatedExisting.length !== existingDocs.length;

  if (newDocs.length > 0 || hasConsolidated) {
    const updated = [...newDocs, ...consolidatedExisting];
    saveProductionDocuments(updated, projId, false, true);
    return { addedCount: newDocs.length, documents: updated };
  }

  return { addedCount: 0, documents: existingDocs };
}
