import { ProductionDocument, DocumentAnnotation, DocumentCategory, DocumentFormat } from '../types';

const STORAGE_KEY = 'backstage_production_documents';

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

export const INITIAL_DOCUMENTS: ProductionDocument[] = [
  {
    id: 'doc-1',
    title: "Director's Visual Treatment & Lookbook",
    titleTa: 'இயக்குனர் காட்சி அமைப்பு & பார்வைக் குறிப்பேடு (Lookbook)',
    category: 'LOOKBOOK',
    fileName: 'Madurai_Chithirai_Lookbook_v2.pdf',
    fileSize: '4.8 MB',
    fileType: 'lookbook',
    pageCount: 3,
    uploadedAt: '2026-09-01T10:00:00.000Z',
    builtInType: 'lookbook',
    status: 'approved',
    author: 'Director Karthik',
    tags: ['Lookbook', 'Visual Palette', 'Anamorphic', 'Madurai'],
    annotations: [
      {
        id: 'ann-1',
        documentId: 'doc-1',
        pageNumber: 1,
        type: 'highlight',
        color: '#fde047',
        opacity: 0.4,
        x: 60,
        y: 140,
        width: 630,
        height: 28,
        createdAt: '2026-09-01T11:20:00.000Z',
      },
      {
        id: 'ann-2',
        documentId: 'doc-1',
        pageNumber: 1,
        type: 'note',
        color: '#f59e0b',
        x: 680,
        y: 180,
        text: 'DOP Note: Use 50mm anamorphic lens with amber rim lighting on hero entrance.',
        author: '1st AD Karthik',
        createdAt: '2026-09-01T11:25:00.000Z',
      },
    ],
  },
  {
    id: 'doc-vn-1',
    title: "Director's Audio Memo — Temple Night Atmosphere & Drone Sweep",
    titleTa: 'இயக்குனர் குரல் குறிப்பு — இரவு கோவில் காட்சி ஒலிகள்',
    category: 'VOICE_NOTE',
    fileName: 'VoiceMemo_TempleNight_DroneSweep.webm',
    fileSize: '640 KB',
    fileType: 'audio',
    pageCount: 1,
    durationSeconds: 42,
    audioUrl: SAMPLE_AUDIO_1,
    uploadedAt: '2026-09-01T18:45:00.000Z',
    builtInType: 'audio',
    author: 'Director Karthik',
    status: 'review',
    tags: ['Voice Note', 'Sound Design', 'Temple Night', 'Drone'],
    textContent: 'Remind sound mixer to capture live ambient temple bells and nadaswaram echoes at East Gopuram before the main dialogue cue. Keep drone rotors away from mic array.',
    annotations: [
      {
        id: 'ann-vn1',
        documentId: 'doc-vn-1',
        pageNumber: 1,
        type: 'comment',
        color: '#06b6d4',
        text: 'Sound mixer confirmed: Directional shotgun mics will be mounted on the southern crane.',
        author: 'Sound Recordist',
        createdAt: '2026-09-01T19:00:00.000Z',
        replies: [
          {
            id: 'reply-vn1',
            author: '1st AD',
            text: 'Noted on call sheet day 1 notes.',
            createdAt: '2026-09-01T19:15:00.000Z'
          }
        ]
      }
    ]
  },
  {
    id: 'doc-snap-1',
    title: 'Excalidraw Whiteboard — Sc. 4 Data Vault Breach Spatial Blocking',
    titleTa: 'வெண்பலகை காட்சி வரைபடம் — காட்சி 4 பாதுகாப்பு பெட்டகம்',
    category: 'SNAPSHOT',
    fileName: 'Snapshot_Whiteboard_Sc04_Blocking.png',
    fileSize: '1.8 MB',
    fileType: 'snapshot',
    pageCount: 1,
    uploadedAt: '2026-09-02T07:15:00.000Z',
    builtInType: 'excalidraw',
    author: 'Action Choreographer & DOP',
    status: 'approved',
    tags: ['Snapshot', 'Whiteboard', 'Blocking', 'Stunts'],
    imageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="%23141414"/><rect x="40" y="40" width="720" height="420" rx="16" fill="%231e1e1e" stroke="%23f5a623" stroke-width="2" stroke-dasharray="6,6"/><circle cx="240" cy="220" r="40" fill="%233b82f6" fill-opacity="0.3" stroke="%2360a5fa" stroke-width="3"/><text x="240" y="226" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">MAYA (CAM A)</text><circle cx="540" cy="220" r="40" fill="%23ef4444" fill-opacity="0.3" stroke="%23f87171" stroke-width="3"/><text x="540" y="226" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">STERLING</text><path d="M 285 220 L 495 220" stroke="%23f5a623" stroke-width="3" marker-end="url(%23arrow)"/><rect x="360" y="195" width="80" height="50" rx="8" fill="%23262626" stroke="%23525252"/><text x="400" y="225" fill="%23e5e7eb" font-family="sans-serif" font-size="11" text-anchor="middle">INCINERATOR</text><text x="70" y="80" fill="%23f5a623" font-family="sans-serif" font-size="18" font-weight="bold">SCENE 4: STEEL VAULT CORE — CAMERA BLOCKING</text><text x="70" y="110" fill="%239ca3af" font-family="sans-serif" font-size="12">Dolly Track along south wall • Stunt line secured behind console</text></svg>',
    annotations: []
  },
  {
    id: 'doc-2',
    title: 'Daily Call Sheet - Shoot Day 1 (Temple Night)',
    titleTa: 'தினசரி படப்பிடிப்பு அழைப்பு தாள் - நாள் 1 (கோயில் இரவு)',
    category: 'CALLSHEET',
    fileName: 'CallSheet_Day01_TempleNight.pdf',
    fileSize: '1.2 MB',
    fileType: 'callsheet',
    pageCount: 2,
    uploadedAt: '2026-09-02T08:30:00.000Z',
    builtInType: 'callsheet',
    author: '1st AD Karthik',
    status: 'approved',
    tags: ['Callsheet', 'Day 1', 'Night Shoot', 'Temple'],
    annotations: [
      {
        id: 'ann-3',
        documentId: 'doc-2',
        pageNumber: 1,
        type: 'rect',
        color: '#ef4444',
        strokeWidth: 2,
        x: 50,
        y: 220,
        width: 650,
        height: 80,
        createdAt: '2026-09-02T09:00:00.000Z',
      },
      {
        id: 'ann-4',
        documentId: 'doc-2',
        pageNumber: 1,
        type: 'note',
        color: '#ef4444',
        x: 680,
        y: 240,
        text: 'IMPORTANT: Fire brigade & ambulance must be stationed near East Gopuram by 17:00.',
        author: 'Line Producer',
        createdAt: '2026-09-02T09:05:00.000Z',
      },
    ],
  },
  {
    id: 'doc-bd-1',
    title: 'Scene 4 Breakdown Sheet (Data Vault Core)',
    titleTa: 'காட்சி 4 குறிப்பு தாள் (டேட்டா வால்ட்)',
    category: 'BREAKDOWN',
    fileName: 'Breakdown_Scene_4.pdf',
    fileSize: '840 KB',
    fileType: 'breakdown',
    pageCount: 1,
    uploadedAt: '2026-09-02T11:00:00.000Z',
    builtInType: 'breakdown',
    author: '1st AD Breakdown Supervisor',
    status: 'approved',
    tags: ['Breakdown', 'Scene 4', 'VFX', 'Props', 'Stunts'],
    textContent: 'Scene 4 Breakdown Summary:\nCast: Maya, Sterling\nProps: Optical Core Console, Land Deeds, Brass Incinerator\nVFX: Golden Holographic Stream, Floating Paper Ashes\nSound: Energy Surge, Spark Crackle, Steel Door Slam\nPractical: Pyrotechnic Sparks Table Box',
    annotations: []
  },
  {
    id: 'doc-note-1',
    title: 'Production Note — Heritage Temple Electric Generators & Sound Isolation',
    titleTa: 'தயாரிப்புக் குறிப்பு — மின்கலன் மற்றும் ஒலி பாதுகாப்பு',
    category: 'NOTE',
    fileName: 'Note_Temple_Generator_Isolation.txt',
    fileSize: '120 KB',
    fileType: 'note',
    pageCount: 1,
    uploadedAt: '2026-09-02T13:30:00.000Z',
    builtInType: 'note',
    author: 'Gaffer & Production Manager',
    status: 'draft',
    tags: ['Note', 'Logistics', 'Generators', 'Sound'],
    textContent: '1. Two 125kVA silent generators will be positioned behind the municipal wedding hall 180m away from the temple gate.\n2. Heavy-duty 3-phase trunk cables will route through the drainage culvert to eliminate trip hazards for crowd extras.\n3. Sound recordist tested decibel level: less than 32dB on main sanctum corridor.',
    annotations: []
  },
  {
    id: 'doc-3',
    title: 'Stunt & Pyrotechnics Safety Guidelines',
    titleTa: 'சண்டைப் பயிற்சி & தீ விபத்து பாதுகாப்பு விதிமுறைகள்',
    category: 'SAFETY',
    fileName: 'Safety_Protocol_Stunts_MacheteFight.pdf',
    fileSize: '2.1 MB',
    fileType: 'safety',
    pageCount: 2,
    uploadedAt: '2026-09-02T14:15:00.000Z',
    builtInType: 'safety',
    author: 'Stunt Master',
    status: 'confidential',
    tags: ['Safety', 'Stunt Protocol', 'Pyrotechnics'],
    annotations: [
      {
        id: 'ann-5',
        documentId: 'doc-3',
        pageNumber: 1,
        type: 'pen',
        color: '#dc2626',
        strokeWidth: 3,
        points: [
          { x: 80, y: 310 },
          { x: 260, y: 310 },
          { x: 260, y: 340 },
          { x: 80, y: 340 },
          { x: 80, y: 310 },
        ],
        createdAt: '2026-09-02T15:00:00.000Z',
      },
      {
        id: 'ann-6',
        documentId: 'doc-3',
        pageNumber: 1,
        type: 'text',
        color: '#dc2626',
        x: 280,
        y: 330,
        text: 'CRITICAL: DULL EDGES ONLY ON ALL 20 BLADES',
        author: 'Stunt Master',
        createdAt: '2026-09-02T15:05:00.000Z',
      },
    ],
  },
  {
    id: 'doc-vn-2',
    title: "Cinematographer Voice Memo — Anamorphic Flare Test for Act III",
    titleTa: 'ஒளிப்பதிவாளர் குரல் குறிப்பு — லென்ஸ் ஒளிவட்டம் பரிசோதனை',
    category: 'VOICE_NOTE',
    fileName: 'VoiceMemo_Anamorphic_Flare_ActIII.webm',
    fileSize: '512 KB',
    fileType: 'audio',
    pageCount: 1,
    durationSeconds: 35,
    audioUrl: SAMPLE_AUDIO_2,
    uploadedAt: '2026-09-02T17:00:00.000Z',
    builtInType: 'audio',
    author: 'DOP Arun',
    status: 'approved',
    tags: ['Voice Note', 'DOP', 'Lenses', 'Lighting'],
    textContent: 'Tested the 35mm Kowa anamorphic with gold streak filter against the brass incinerator fire. Flares are horizontal and clean. Perfect for the Act III climax confrontation.',
    annotations: []
  },
  {
    id: 'doc-4',
    title: 'Madurai Municipal Location Shoot Permit',
    titleTa: 'மதுரை மாநகராட்சி படப்பிடிப்பு அனுமதி ஆவணம்',
    category: 'PERMIT',
    fileName: 'Madurai_Corp_Shoot_Permit_2026.pdf',
    fileSize: '890 KB',
    fileType: 'permit',
    pageCount: 1,
    uploadedAt: '2026-09-02T16:00:00.000Z',
    builtInType: 'permit',
    author: 'Executive Producer',
    status: 'approved',
    tags: ['Permit', 'Municipal', 'Government', 'Location'],
    annotations: [],
  },
  {
    id: 'doc-5',
    title: 'Principal Cast Talent Agreement (Aadhi)',
    titleTa: 'நாயகர் நடிகர் ஒப்பந்த ஆவணம் (ஆதி)',
    category: 'CONTRACT',
    fileName: 'Cast_Agreement_Aadhi_Hero.pdf',
    fileSize: '1.5 MB',
    fileType: 'contract',
    pageCount: 2,
    uploadedAt: '2026-09-03T09:00:00.000Z',
    builtInType: 'contract',
    author: 'Production Legal Counsel',
    status: 'confidential',
    tags: ['Contract', 'Cast', 'Legal'],
    annotations: [],
  },
];

export function getProductionDocuments(): ProductionDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveProductionDocuments(INITIAL_DOCUMENTS);
      return INITIAL_DOCUMENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveProductionDocuments(INITIAL_DOCUMENTS);
      return INITIAL_DOCUMENTS;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load production documents:', e);
    return INITIAL_DOCUMENTS;
  }
}

export function saveProductionDocuments(docs: ProductionDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('backstage_documents_updated', { detail: docs }));
    }
  } catch (e) {
    console.error('Failed to save production documents:', e);
  }
}

export function addProductionDocument(
  doc: Omit<ProductionDocument, 'id' | 'uploadedAt' | 'annotations'> & {
    id?: string;
    uploadedAt?: string;
    annotations?: DocumentAnnotation[];
  }
): ProductionDocument {
  const currentDocs = getProductionDocuments();
  const newDoc: ProductionDocument = {
    id: doc.id || `doc-${Date.now()}`,
    projectId: doc.projectId,
    title: doc.title,
    titleTa: doc.titleTa,
    category: doc.category,
    fileName: doc.fileName || `${doc.title.replace(/\s+/g, '_')}.pdf`,
    fileSize: doc.fileSize || '1.1 MB',
    fileType: doc.fileType || 'other',
    pageCount: doc.pageCount || 1,
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
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
  };

  // Prevent duplicate titles if exact same ID exists
  const filtered = currentDocs.filter((d) => d.id !== newDoc.id);
  const updated = [newDoc, ...filtered];
  saveProductionDocuments(updated);
  return newDoc;
}

/**
 * Archive a document (NO DELETION GUARANTEE)
 * Sets isArchived: true, archivedAt, status: 'archived'
 */
export function archiveProductionDocument(id: string): boolean {
  const docs = getProductionDocuments();
  let found = false;
  const updated = docs.map((d) => {
    if (d.id === id) {
      found = true;
      return {
        ...d,
        isArchived: true,
        archivedAt: new Date().toISOString(),
        status: 'archived' as const,
      };
    }
    return d;
  });

  if (found) {
    saveProductionDocuments(updated);
  }
  return found;
}

/**
 * Restore an archived document back to the active Vault
 */
export function unarchiveProductionDocument(id: string): boolean {
  const docs = getProductionDocuments();
  let found = false;
  const updated = docs.map((d) => {
    if (d.id === id) {
      found = true;
      return {
        ...d,
        isArchived: false,
        archivedAt: undefined,
        status: 'approved' as const,
      };
    }
    return d;
  });

  if (found) {
    saveProductionDocuments(updated);
  }
  return found;
}

/**
 * Save a Voice Note / Audio Memo directly into the Vault
 */
export function saveVoiceNoteToVault(
  title: string,
  audioDataUrl: string,
  durationSeconds = 0,
  notes?: string,
  author = 'Director / Writer'
): ProductionDocument {
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
    tags: ['Voice Note', 'Audio Memo', 'Production Audio'],
  });
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
  htmlPreview?: string
): ProductionDocument {
  return addProductionDocument({
    title: `Scene ${sceneNumber} Breakdown Sheet (${sceneTitle})`,
    titleTa: `காட்சி ${sceneNumber} குறிப்பு தாள்`,
    category: 'BREAKDOWN',
    fileType: 'breakdown',
    fileName: `Breakdown_Scene_${sceneNumber}.pdf`,
    fileSize: `${Math.max(250, itemsCount * 45)} KB`,
    pageCount: 1,
    builtInType: 'breakdown',
    htmlContent: htmlPreview,
    textContent: `Breakdown Sheet for Scene ${sceneNumber}: ${sceneTitle}. Total Elements: ${itemsCount}`,
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
export function harvestProjectArtifacts(project: any): { addedCount: number; documents: ProductionDocument[] } {
  if (!project) return { addedCount: 0, documents: getProductionDocuments() };

  const existingDocs = getProductionDocuments();
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

      // 3. Harvest breakdowns from beats
      if (b.breakdown && Object.keys(b.breakdown).length > 0) {
        const breakdownDocId = `harvest-breakdown-${b.id}`;
        if (!existingIds.has(breakdownDocId)) {
          const breakdownSummary = Object.entries(b.breakdown)
            .map(([cat, items]: [string, any]) => `${cat.toUpperCase()}: ${Array.isArray(items) ? items.join(', ') : items}`)
            .join('\n');

          newDocs.push({
            id: breakdownDocId,
            title: `Sc. ${b.sceneNumber || b.id} Breakdown Sheet (${b.title || 'Scene'})`,
            titleTa: `காட்சி ${b.sceneNumber} குறிப்பு தாள்`,
            category: 'BREAKDOWN',
            fileType: 'breakdown',
            fileName: `Breakdown_Sc${b.sceneNumber || b.id}.pdf`,
            fileSize: '380 KB',
            pageCount: 1,
            uploadedAt: new Date().toISOString(),
            builtInType: 'breakdown',
            author: '1st AD Breakdown Supervisor',
            textContent: `SCENE ${b.sceneNumber || b.id} BREAKDOWN:\n${breakdownSummary}`,
            status: 'approved',
            tags: [`Scene ${b.sceneNumber}`, 'Breakdown', '1st AD'],
            annotations: [],
          });
          existingIds.add(breakdownDocId);
        }
      }
    });
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
    saveProductionDocuments(updated);
    return { addedCount: newDocs.length, documents: updated };
  }

  return { addedCount: 0, documents: existingDocs };
}
