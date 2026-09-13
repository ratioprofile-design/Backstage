import { ProductionDocument, DocumentAnnotation } from '../types';

const STORAGE_KEY = 'backstage_production_documents';

export const INITIAL_DOCUMENTS: ProductionDocument[] = [
  {
    id: 'doc-1',
    title: "Director's Visual Treatment & Lookbook",
    titleTa: 'இயக்குனர் காட்சி அமைப்பு & பார்வைக் குறிப்பேடு (Lookbook)',
    category: 'LOOKBOOK',
    fileName: 'Madurai_Chithirai_Lookbook_v2.pdf',
    fileSize: '4.8 MB',
    pageCount: 3,
    uploadedAt: '2026-09-01T10:00:00.000Z',
    builtInType: 'lookbook',
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
    id: 'doc-2',
    title: 'Daily Call Sheet - Shoot Day 1 (Temple Night)',
    titleTa: 'தினசரி படப்பிடிப்பு அழைப்பு தாள் - நாள் 1 (கோயில் இரவு)',
    category: 'CALLSHEET',
    fileName: 'CallSheet_Day01_TempleNight.pdf',
    fileSize: '1.2 MB',
    pageCount: 2,
    uploadedAt: '2026-09-02T08:30:00.000Z',
    builtInType: 'callsheet',
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
    id: 'doc-3',
    title: 'Stunt & Pyrotechnics Safety Guidelines',
    titleTa: 'சண்டைப் பயிற்சி & தீ விபத்து பாதுகாப்பு விதிமுறைகள்',
    category: 'SAFETY',
    fileName: 'Safety_Protocol_Stunts_MacheteFight.pdf',
    fileSize: '2.1 MB',
    pageCount: 2,
    uploadedAt: '2026-09-02T14:15:00.000Z',
    builtInType: 'safety',
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
    id: 'doc-4',
    title: 'Madurai Municipal Location Shoot Permit',
    titleTa: 'மதுரை மாநகராட்சி படப்பிடிப்பு அனுமதி ஆவணம்',
    category: 'PERMIT',
    fileName: 'Madurai_Corp_Shoot_Permit_2026.pdf',
    fileSize: '890 KB',
    pageCount: 1,
    uploadedAt: '2026-09-02T16:00:00.000Z',
    builtInType: 'permit',
    annotations: [],
  },
  {
    id: 'doc-5',
    title: 'Principal Cast Talent Agreement (Aadhi)',
    titleTa: 'நாயகர் நடிகர் ஒப்பந்த ஆவணம் (ஆதி)',
    category: 'CONTRACT',
    fileName: 'Cast_Agreement_Aadhi_Hero.pdf',
    fileSize: '1.5 MB',
    pageCount: 2,
    uploadedAt: '2026-09-03T09:00:00.000Z',
    builtInType: 'contract',
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
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load production documents:', e);
    return INITIAL_DOCUMENTS;
  }
}

export function saveProductionDocuments(docs: ProductionDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to save production documents:', e);
  }
}
