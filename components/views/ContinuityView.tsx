import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
  Shirt, Sparkles, Car, Box, AlertTriangle, Plus, Search, 
  ChevronRight, ChevronDown, Check, X, Camera, Info, SlidersHorizontal,
  RefreshCw, FileText, Layers, Grid, Image as ImageIcon, Calendar, 
  ListFilter, Edit2, Trash2, User, Tag, ArrowRight, CheckCircle2,
  Clock, MapPin, Activity, TrendingUp, Maximize2, Minimize2, Crosshair,
  ZoomIn, ZoomOut, Eye, BarChart2, Zap, Sun, Moon, ShieldCheck, AlertCircle,
  GripVertical, Play, CornerDownRight, Filter, Upload, Printer, Copy as CopyIcon, Palette
} from 'lucide-react';
import { Beat, CharacterData, BreakdownData } from '../../types';

export interface ContinuityLook {
  id: string;
  dept: 'costume' | 'makeup' | 'vehicle' | 'props';
  rowKey: string; // e.g., 'mara', 'truck'
  targetName: string; // e.g., 'Mara Voss'
  lookNumber: number; // 1, 2, 3...
  title: string; // e.g., "Costume 1: Clean Hiking Gear"
  fromScene: number;
  toScene: number;
  imageUrl?: string;
  images?: string[];
  description: string;
  special?: boolean;
  damageLevel?: string;
  bloodLevel?: string;
  notes?: string;
  customColor?: string;
  status?: 'Verified' | 'Pending Review' | 'Mismatched Warning' | 'Approved';
}

export const VIBRANT_LOOK_COLORS = [
  '#d96b27', // 1: Warm Terracotta / Copper
  '#8b5cf6', // 2: Electric Purple / Violet
  '#10b981', // 3: Emerald Green
  '#06b6d4', // 4: Vibrant Cyan
  '#e11d48', // 5: Crimson Red
  '#f59e0b', // 6: Amber Gold
  '#ec4899', // 7: Hot Pink / Magenta
  '#6366f1', // 8: Deep Indigo
  '#14b8a6', // 9: Bright Teal
  '#84cc16', // 10: Vivid Lime Green
];

export interface TrackedRow {
  key: string;
  dept: 'costume' | 'makeup' | 'vehicle' | 'props';
  label: string;
  avatar?: string;
}

export interface ScheduledScene {
  id: string;
  num: number;
  day: number;
  slug: string;
  location: string;
  cast: string;
  states: Record<string, string>; // "costume:mara" => "look-id"
}

export interface SequenceBlock {
  id: string;
  name: string; // e.g. "King's Palace — 3000 Years Ago"
  location: string;
  eraOrPeriod: string;
  scenes: number[]; // e.g. [1, 18, 48, 49, 50]
  color: string;
  shootDay?: number;
  description?: string;
}

const INITIAL_SEQUENCES: SequenceBlock[] = [];

export interface ShootDayGroup {
  day: number;
  date: string;
  loc: string;
  callTime: string;
  scenes: ScheduledScene[];
}

export interface LookTheme {
  id: string;
  name: string;
  tagline: string;
  deptColors: Record<'costume' | 'makeup' | 'vehicle' | 'props', string>;
  lookShades: Record<'costume' | 'makeup' | 'vehicle' | 'props', string[]>;
}

export const LOOK_THEMES: LookTheme[] = [
  {
    id: 'studio-classic',
    name: 'Classic Studio',
    tagline: 'Standard Hollywood production palette with high contrast',
    deptColors: {
      costume: '#d96b27', // Warm Terracotta Copper
      makeup: '#d9a036',  // Golden Amber
      vehicle: '#2b8296', // Steel Cyan Blue
      props: '#6b8e4e',   // Forest Sage Green
    },
    lookShades: {
      costume: ['#d96b27', '#ea580c', '#c2410c', '#9a3412'],
      makeup: ['#d9a036', '#eab308', '#ca8a04', '#a16207'],
      vehicle: ['#2b8296', '#0284c7', '#0369a1', '#075985'],
      props: ['#6b8e4e', '#16a34a', '#15803d', '#166534'],
    },
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    tagline: 'High-contrast vibrant sci-fi & thriller aesthetic',
    deptColors: {
      costume: '#ec4899', // Electric Pink
      makeup: '#8b5cf6',  // Neon Violet
      vehicle: '#06b6d4', // Bright Cyan
      props: '#10b981',   // Neon Emerald
    },
    lookShades: {
      costume: ['#ec4899', '#f43f5e', '#e11d48', '#be123c'],
      makeup: ['#8b5cf6', '#a855f7', '#9333ea', '#7e22ce'],
      vehicle: ['#06b6d4', '#00d8f6', '#00abc7', '#008399'],
      props: ['#10b981', '#34d399', '#059669', '#047857'],
    },
  },
  {
    id: 'cinematic-technicolor',
    name: 'Vintage Technicolor',
    tagline: 'Rich warm 35mm film stock tones',
    deptColors: {
      costume: '#e65100', // Burnt Orange
      makeup: '#f57f17',  // Rich Ochre
      vehicle: '#00695c', // Vintage Spruce Teal
      props: '#33691e',   // Olive Moss Green
    },
    lookShades: {
      costume: ['#e65100', '#ff6d00', '#dd2c00', '#bf360c'],
      makeup: ['#f57f17', '#ffab00', '#ff8f00', '#ff6f00'],
      vehicle: ['#00695c', '#00897b', '#004d40', '#00332c'],
      props: ['#33691e', '#558b2f', '#1b5e20', '#0d3c12'],
    },
  },
  {
    id: 'nordic-twilight',
    name: 'Nordic Twilight',
    tagline: 'Refined modern Scandinavian muted tones',
    deptColors: {
      costume: '#fb7185', // Rose Coral
      makeup: '#fbbf24',  // Honey Amber
      vehicle: '#60a5fa', // Sapphire Blue
      props: '#2dd4bf',   // Mint Turquoise
    },
    lookShades: {
      costume: ['#fb7185', '#f43f5e', '#e11d48', '#be123c'],
      makeup: ['#fbbf24', '#f59e0b', '#d97706', '#b45309'],
      vehicle: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
      props: ['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e'],
    },
  },
  {
    id: 'royal-dynasty',
    name: 'Royal Dynasty',
    tagline: 'Opulent jewel tones for epic drama & period pieces',
    deptColors: {
      costume: '#be123c', // Crimson Ruby
      makeup: '#ca8a04',  // Imperial Gold
      vehicle: '#7e22ce', // Royal Velvet Purple
      props: '#047857',   // Deep Jade Emerald
    },
    lookShades: {
      costume: ['#be123c', '#e11d48', '#9f1239', '#881337'],
      makeup: ['#ca8a04', '#eab308', '#a16207', '#713f12'],
      vehicle: ['#7e22ce', '#a855f7', '#6b21a8', '#581c87'],
      props: ['#047857', '#10b981', '#065f46', '#064e3b'],
    },
  },
];

const DEPT_COLORS: Record<string, string> = {
  costume: '#d96b27', // Warm terracotta / copper
  makeup: '#d9a036', // Golden amber
  vehicle: '#2b8296', // Steel cyan blue
  props: '#6b8e4e', // Forest sage green
};

const DEPT_NAMES: Record<string, string> = {
  costume: 'Costume / Wardrobe',
  makeup: 'Makeup & SFX',
  vehicle: 'Vehicles',
  props: 'Props & Art',
};

const DEPT_ICONS: Record<string, React.ElementType> = {
  costume: Shirt,
  makeup: Sparkles,
  vehicle: Car,
  props: Box,
};

export const INITIAL_LOOKS: ContinuityLook[] = [];

export const ContinuityView: React.FC = () => {
  const { beats, characterData, appTheme, setAppTheme } = useProject();

  // Core Looks Catalog State
  const [looks, setLooks] = useState<ContinuityLook[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backstage_continuity_looks');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return INITIAL_LOOKS;
  });

  const looksRef = useRef(looks);
  const isInternalContinuityUpdate = useRef(false);

  useEffect(() => {
    looksRef.current = looks;
  }, [looks]);

  // Sync looks with localStorage and emit window event
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const jsonStr = JSON.stringify(looks);
      const existingStr = localStorage.getItem('backstage_continuity_looks');
      if (existingStr !== jsonStr) {
        localStorage.setItem('backstage_continuity_looks', jsonStr);
        isInternalContinuityUpdate.current = true;
        window.dispatchEvent(new Event('backstage_continuity_updated'));
      }
    }
  }, [looks]);

  // Listen for updates from CrewView or other views
  useEffect(() => {
    const handleSync = () => {
      if (isInternalContinuityUpdate.current) {
        isInternalContinuityUpdate.current = false;
        return;
      }
      const saved = localStorage.getItem('backstage_continuity_looks');
      if (saved) {
        try {
          if (saved === JSON.stringify(looksRef.current)) return;
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLooks(parsed);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('backstage_continuity_updated', handleSync);
    return () => window.removeEventListener('backstage_continuity_updated', handleSync);
  }, []);
  const [activeDept, setActiveDept] = useState<'costume' | 'makeup' | 'vehicle' | 'props'>('costume');
  const [selectedLookId, setSelectedLookId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ruler' | 'sequence' | 'dept-detail'>('ruler');
  const [inspectorTab, setInspectorTab] = useState<'scene' | 'look' | 'audit'>('scene');

  // Sequence & Location Era Filter State
  const [sequences, setSequences] = useState<SequenceBlock[]>(INITIAL_SEQUENCES);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('all');
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState<boolean>(false);
  const [editingSequence, setEditingSequence] = useState<SequenceBlock | null>(null);

  // Sequence Form Fields
  const [seqFormName, setSeqFormName] = useState('');
  const [seqFormLoc, setSeqFormLoc] = useState('');
  const [seqFormEra, setSeqFormEra] = useState('');
  const [seqFormScenes, setSeqFormScenes] = useState('');
  const [seqFormColor, setSeqFormColor] = useState('#a855f7');
  const [seqFormDay, setSeqFormDay] = useState<number>(1);
  const [seqFormDesc, setSeqFormDesc] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [conflictsOnlyFilter, setConflictsOnlyFilter] = useState<boolean>(false);
  const [gapsOnlyFilter, setGapsOnlyFilter] = useState<boolean>(false);

  // Add / Edit Modal State
  const [isLookModalOpen, setIsLookModalOpen] = useState(false);
  const [editingLook, setEditingLook] = useState<ContinuityLook | null>(null);

  // Form Fields
  const [formDept, setFormDept] = useState<'costume' | 'makeup' | 'vehicle' | 'props'>('costume');
  const [formTargetName, setFormTargetName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formFromScene, setFormFromScene] = useState<number>(1);
  const [formToScene, setFormToScene] = useState<number>(10);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [urlInputText, setUrlInputText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSpecial, setFormSpecial] = useState(true);
  const [formDamage, setFormDamage] = useState('None');
  const [formCustomColor, setFormCustomColor] = useState<string>('');
  const [modalDeleteConfirm, setModalDeleteConfirm] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    look?: ContinuityLook;
    dept?: string;
    targetName?: string;
    scene?: number;
  } | null>(null);
  const [contextMenuDeleteConfirm, setContextMenuDeleteConfirm] = useState<boolean>(false);
  const [inspectorImgIdx, setInspectorImgIdx] = useState<number>(0);

  // Derive scene bounds from actual project beats or default 1–100
  const sceneNumbers = useMemo(() => {
    if (beats && beats.length > 0) {
      const numbers = beats
        .map((b, idx) => {
          const numStr = b.sceneNumber || String(idx + 1);
          const parsed = parseInt(numStr, 10);
          return isNaN(parsed) ? idx + 1 : parsed;
        })
        .sort((a, b) => a - b);
      return numbers;
    }
    return Array.from({ length: 20 }, (_, i) => i + 1);
  }, [beats]);

  const sceneMin = sceneNumbers[0] || 1;
  const sceneMax = sceneNumbers[sceneNumbers.length - 1] || 100;

  // Timeline Navigation State
  const [zoomRange, setZoomRange] = useState<[number, number]>([1, 10]);
  const [scrubScene, setScrubScene] = useState<number>(1);
  const [chartHoverPos, setChartHoverPos] = useState<{ x: number; y: number } | null>(null);
  
  // Theme State synchronized with global appTheme
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      if (appTheme === 'dark') return 'dark';
      if (appTheme === 'light') return 'light';
      if (appTheme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    }
    return 'dark';
  });

  useEffect(() => {
    const isDark = appTheme === 'dark' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setChartTheme(isDark ? 'dark' : 'light');
  }, [appTheme]);

  const [activeDeptFilter, setActiveDeptFilter] = useState<'all' | 'costume' | 'makeup' | 'vehicle' | 'props'>('all');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  const handleDepartmentClick = (dept: 'all' | 'costume' | 'makeup' | 'vehicle' | 'props') => {
    if (dept === 'all') {
      setActiveDeptFilter('all');
      setCollapsedDepts({ costume: false, makeup: false, vehicle: false, props: false });
      return;
    }

    if (activeDeptFilter === dept) {
      // Toggle back to showing all expanded
      setActiveDeptFilter('all');
      setCollapsedDepts({ costume: false, makeup: false, vehicle: false, props: false });
    } else {
      setActiveDeptFilter(dept);
      setActiveDept(dept);
      // Collapse all other departments and expand ONLY the selected department
      setCollapsedDepts({
        costume: dept !== 'costume',
        makeup: dept !== 'makeup',
        vehicle: dept !== 'vehicle',
        props: dept !== 'props',
      });
    }
  };

  const getDeptColor = (dept: 'costume' | 'makeup' | 'vehicle' | 'props' | string) => {
    return DEPT_COLORS[dept] || '#2962ff';
  };

  const getLookColor = (
    dept: 'costume' | 'makeup' | 'vehicle' | 'props' | string,
    lookNum: number = 1,
    customColor?: string
  ) => {
    if (customColor && customColor.trim()) return customColor;
    const idx = Math.max(0, (lookNum - 1) % VIBRANT_LOOK_COLORS.length);
    return VIBRANT_LOOK_COLORS[idx];
  };

  // Collapsible Departments state
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({
    costume: false,
    makeup: false,
    vehicle: false,
    props: false,
  });

  // Collapsible Sequences state
  const [collapsedSequences, setCollapsedSequences] = useState<Record<string, boolean>>({});

  const toggleSequenceCollapse = (seqId: string) => {
    setCollapsedSequences((prev) => ({ ...prev, [seqId]: !prev[seqId] }));
  };

  const collapseAllSequences = () => {
    const next: Record<string, boolean> = {};
    sequences.forEach((s) => { next[s.id] = true; });
    setCollapsedSequences(next);
  };

  const expandAllSequences = () => {
    setCollapsedSequences({});
  };

  // Interactive Drag-to-Create Look Box State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dept: 'costume' | 'makeup' | 'vehicle' | 'props';
    rowKey: string;
    targetName: string;
    startScene: number;
    currentScene: number;
  } | null>(null);

  // Interactive Drag-to-Resize Look Bar State
  const [resizingLook, setResizingLook] = useState<{
    lookId: string;
    edge: 'from' | 'to';
    initialScene: number;
  } | null>(null);

  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFilesChange = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const readers = validFiles.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) resolve(e.target.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((newUrls) => {
      setFormImages((prev) => [...prev, ...newUrls]);
    });
  };

  // Copy & Print feedback and export helper utilities
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handlePrintHtml = (title: string, htmlContent: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
              h1, h2, h3 { margin-top: 0; color: #0f172a; }
              .header-bar { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; }
              .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f8fafc; page-break-inside: avoid; }
              .badge { display: inline-block; padding: 3px 8px; background: #0284c7; color: #ffffff; font-size: 11px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
              .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; }
              .meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
              .meta-val { font-weight: bold; color: #0f172a; }
              .notes { font-size: 12px; color: #334155; margin-top: 8px; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; white-space: pre-wrap; }
              .img-grid { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
              .img-grid img { width: 140px; height: 140px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
              th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header-bar">
              <h2>${title}</h2>
              <span style="font-size: 10px; color: #64748b; font-family: monospace;">Backstage Story Sequencer • Continuity Report</span>
            </div>
            <div>${htmlContent}</div>
            <script>
              setTimeout(() => { window.print(); }, 250);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const getDeptSummaryText = (dept: 'costume' | 'makeup' | 'vehicle' | 'props') => {
    const deptRows = trackedRows.filter((r) => r.dept === dept);
    const deptLooks = looks.filter((l) => l.dept === dept);
    let text = `========================================\nCONTINUITY REPORT: ${DEPT_NAMES[dept].toUpperCase()}\nTotal Elements: ${deptRows.length} | Total Looks: ${deptLooks.length}\n========================================\n\n`;
    deptRows.forEach((r) => {
      const rLooks = deptLooks.filter((l) => l.rowKey === r.key);
      text += `ELEMENT: ${r.label} (${rLooks.length} looks)\n`;
      if (rLooks.length === 0) {
        text += `  (No looks recorded)\n`;
      } else {
        rLooks.forEach((l) => {
          text += `  • Look #${l.lookNumber}: ${l.title} [Scenes ${l.fromScene}-${l.toScene}]\n`;
          if (l.damageLevel && l.damageLevel !== 'None') text += `    Damage State: ${l.damageLevel}\n`;
          if (l.description) text += `    Notes: ${l.description}\n`;
        });
      }
      text += `\n`;
    });
    return text;
  };

  const getDeptSummaryHtml = (dept: 'costume' | 'makeup' | 'vehicle' | 'props') => {
    const deptRows = trackedRows.filter((r) => r.dept === dept);
    const deptLooks = looks.filter((l) => l.dept === dept);
    let html = `<p style="font-size: 12px; color: #64748b;">Department Summary: <strong>${DEPT_NAMES[dept]}</strong> (${deptRows.length} elements, ${deptLooks.length} total looks)</p>`;
    deptRows.forEach((r) => {
      const rLooks = deptLooks.filter((l) => l.rowKey === r.key);
      html += `<div class="card">
        <h3 style="margin-bottom: 8px; color: #0284c7;">${r.label} <span style="font-size:12px; font-weight:normal; color:#64748b;">(${rLooks.length} looks)</span></h3>`;
      if (rLooks.length === 0) {
        html += `<p style="font-size: 12px; color: #94a3b8; font-style: italic;">No looks assigned yet.</p>`;
      } else {
        html += `<table>
          <thead>
            <tr>
              <th>Look #</th>
              <th>Title</th>
              <th>Scene Coverage</th>
              <th>Damage State</th>
              <th>Description / Notes</th>
            </tr>
          </thead>
          <tbody>`;
        rLooks.forEach((l) => {
          html += `<tr>
            <td><strong>#${l.lookNumber}</strong></td>
            <td><strong>${l.title}</strong></td>
            <td>Scenes ${l.fromScene}–${l.toScene}</td>
            <td>${l.damageLevel && l.damageLevel !== 'None' ? `⚡ ${l.damageLevel}` : 'Clean'}</td>
            <td>${l.description || '-'}</td>
          </tr>`;
        });
        html += `</tbody></table>`;
      }
      html += `</div>`;
    });
    return html;
  };

  const getAllTrackedText = () => {
    return (['costume', 'makeup', 'vehicle', 'props'] as const)
      .map((d) => getDeptSummaryText(d))
      .join('\n');
  };

  const getAllTrackedHtml = () => {
    return (['costume', 'makeup', 'vehicle', 'props'] as const)
      .map((d) => getDeptSummaryHtml(d))
      .join('<hr style="margin: 24px 0; border: none; border-top: 1px dashed #cbd5e1;" />');
  };

  const getSequenceSummaryText = (seq: SequenceBlock) => {
    const seqScenes = seq.scenes;
    const seqLooks = looks.filter((l) =>
      seqScenes.some((s) => s >= l.fromScene && s <= l.toScene)
    );
    let text = `========================================\nSEQUENCE CONTINUITY REPORT: ${seq.name.toUpperCase()}\nScenes Included: ${seqScenes.join(', ')}\nTotal Active Looks: ${seqLooks.length}\n========================================\n\n`;
    seqLooks.forEach((l) => {
      text += `• [${DEPT_NAMES[l.dept]}] ${l.targetName} - ${l.title} (Scenes ${l.fromScene}-${l.toScene})\n`;
      if (l.damageLevel && l.damageLevel !== 'None') text += `  Damage State: ${l.damageLevel}\n`;
      if (l.description) text += `  Notes: ${l.description}\n`;
    });
    return text;
  };

  const getSequenceSummaryHtml = (seq: SequenceBlock) => {
    const seqScenes = seq.scenes;
    const { characterMap, discrepancies } = getSequenceContinuityStatus(seq);
    const seqLooks = looks.filter((l) =>
      seqScenes.some((s) => s >= l.fromScene && s <= l.toScene)
    );

    let html = `<div class="card" style="border-left: 6px solid ${seq.color}; font-family: sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2 style="margin:0; font-size:20px; color:#0f172a; text-transform:uppercase;">Sequence: ${seq.name}</h2>
          <p style="font-size:12px; color:#64748b; margin: 4px 0 0 0;">
            Location: <strong>${seq.location || 'N/A'}</strong> | Era: <strong>${seq.eraOrPeriod || 'N/A'}</strong> ${seq.shootDay ? `| Shoot Day: <strong>#${seq.shootDay}</strong>` : ''}
          </p>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px; background:#f1f5f9; padding:4px 8px; border-radius:4px; font-weight:bold; border: 1px solid #cbd5e1;">
            ${seqScenes.length} Scenes (${seqScenes.map((s) => 'SC #' + s).join(', ')})
          </span>
        </div>
      </div>
      ${seq.description ? `<p style="font-size:12px; color:#334155; margin-top:10px; font-style:italic; padding: 8px; background:#ffffff; border-radius:4px; border: 1px solid #e2e8f0;">"${seq.description}"</p>` : ''}
    </div>`;

    if (discrepancies.length > 0) {
      html += `<div style="margin: 12px 0; padding: 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px;">
        <h4 style="margin:0 0 6px 0; color:#e11d48; font-size:13px;">⚠️ Continuity Discrepancies Flagged (${discrepancies.length})</h4>
        <ul style="margin:0; padding-left:20px; font-size:11px; color:#9f1239;">
          ${discrepancies.map((d) => `<li>${d}</li>`).join('')}
        </ul>
      </div>`;
    }

    html += `<h3 style="font-size:14px; margin: 16px 0 8px 0; color:#1e293b; text-transform:uppercase;">Character & Department Look Matrix</h3>`;
    html += `<table>
      <thead>
        <tr>
          <th style="min-width: 140px;">Department / Element</th>
          ${seqScenes.map((sc) => `<th>SC #${sc}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

    trackedRows.forEach((row) => {
      const sceneLooks = characterMap[`${row.dept}:${row.key}`] || {};
      html += `<tr>
        <td>
          <span class="badge" style="background:${getDeptColor(row.dept)};">${DEPT_NAMES[row.dept]}</span>
          <br/><strong style="font-size:12px; color:#0f172a;">${row.label}</strong>
        </td>`;

      seqScenes.forEach((scNum) => {
        const look = sceneLooks[scNum];
        if (look) {
          html += `<td>
            <strong style="color:#0284c7; font-size:11px;">${look.title}</strong>
            <div style="font-size:10px; color:#64748b;">Look #${look.lookNumber} (SC ${look.fromScene}–${look.toScene})</div>
            ${look.damageLevel && look.damageLevel !== 'None' ? `<div style="font-size:10px; color:#d97706; font-weight:bold;">⚡ ${look.damageLevel}</div>` : ''}
          </td>`;
        } else {
          html += `<td style="background:#fff1f2; color:#e11d48; font-size:10px; font-style:italic;">No Look Set</td>`;
        }
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;

    if (seqLooks.length > 0) {
      html += `<h3 style="font-size:14px; margin: 20px 0 8px 0; color:#1e293b; text-transform:uppercase;">Active Look Details Summary (${seqLooks.length})</h3>`;
      html += `<table>
        <thead>
          <tr>
            <th>Dept</th>
            <th>Target</th>
            <th>Look Title</th>
            <th>Coverage</th>
            <th>Damage State</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>`;
      seqLooks.forEach((l) => {
        html += `<tr>
          <td><span class="badge" style="background:${getLookColor(l.dept, l.lookNumber, l.customColor)};">${DEPT_NAMES[l.dept]}</span></td>
          <td><strong>${l.targetName}</strong></td>
          <td>${l.title}</td>
          <td>Scenes ${l.fromScene}–${l.toScene}</td>
          <td>${l.damageLevel && l.damageLevel !== 'None' ? `⚡ ${l.damageLevel}` : 'Clean'}</td>
          <td>${l.description || '-'}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    return html;
  };

  const getSceneSummaryText = (sceneNum: number) => {
    let text = `========================================\nSCENE #${sceneNum} CONTINUITY SHEET\nActive Looks on Set: ${activeScrubLooks.length}\n`;
    if (activeScrubBeat) {
      text += `Scene Title: ${activeScrubBeat.slug?.raw || activeScrubBeat.title}\n`;
      text += `Location: ${activeScrubBeat.slug?.location || 'N/A'}\n`;
    }
    text += `========================================\n\n`;
    activeScrubLooks.forEach((l) => {
      text += `• [${DEPT_NAMES[l.dept]}] ${l.targetName} - ${l.title} (Look #${l.lookNumber})\n`;
      text += `  Coverage: Scenes ${l.fromScene} to ${l.toScene}\n`;
      if (l.damageLevel && l.damageLevel !== 'None') text += `  Damage State: ${l.damageLevel}\n`;
      if (l.description) text += `  Notes: ${l.description}\n`;
      text += `\n`;
    });
    return text;
  };

  const getSceneSummaryHtml = (sceneNum: number) => {
    let html = `<div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Scene #${sceneNum} Continuity Sheet</h3>
        <span class="badge">${activeScrubLooks.length} Active Looks</span>
      </div>`;
    if (activeScrubBeat) {
      html += `<div class="meta-grid">
        <div><div class="meta-label">Scene Header</div><div class="meta-val">${activeScrubBeat.slug?.raw || activeScrubBeat.title}</div></div>
        <div><div class="meta-label">Location</div><div class="meta-val">${activeScrubBeat.slug?.location || 'N/A'}</div></div>
      </div>`;
    }
    html += `</div>`;
    html += `<h3>Active Looks on Set:</h3>`;
    activeScrubLooks.forEach((l) => {
      const imgs = l.images && l.images.length > 0 ? l.images : l.imageUrl ? [l.imageUrl] : [];
      html += `<div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <span class="badge" style="background:${getLookColor(l.dept, l.lookNumber, l.customColor)};">${DEPT_NAMES[l.dept]} #${l.lookNumber}</span>
            <strong style="margin-left:8px; font-size:14px; color:#0f172a;">${l.title}</strong>
          </div>
          <span style="font-size:12px; font-weight:bold; color:#0284c7;">Target: ${l.targetName}</span>
        </div>
        <div class="meta-grid">
          <div><div class="meta-label">Scene Coverage</div><div class="meta-val">Scenes ${l.fromScene} – ${l.toScene}</div></div>
          <div><div class="meta-label">Damage State</div><div class="meta-val">${l.damageLevel && l.damageLevel !== 'None' ? `⚡ ${l.damageLevel}` : 'Clean'}</div></div>
        </div>
        ${l.description ? `<div class="notes"><strong>Notes:</strong> ${l.description}</div>` : ''}
        ${imgs.length > 0 ? `<div class="img-grid">${imgs.map((i) => `<img src="${i}" />`).join('')}</div>` : ''}
      </div>`;
    });
    return html;
  };

  const getLookCardText = (look: ContinuityLook) => {
    const imgs = look.images && look.images.length > 0 ? look.images : look.imageUrl ? [look.imageUrl] : [];
    return `========================================
LOOK CONTINUITY CARD
Title: ${look.title}
Department: ${DEPT_NAMES[look.dept]} (Look #${look.lookNumber})
Target Element: ${look.targetName}
Scene Coverage: Scenes ${look.fromScene} to ${look.toScene}
Damage State: ${look.damageLevel || 'None'}
Special Continuity: ${look.special ? 'Yes' : 'No'}
Notes: ${look.description || 'No notes'}
Photos attached: ${imgs.length > 0 ? imgs.length : 'None'}
========================================`;
  };

  const getLookCardHtml = (look: ContinuityLook) => {
    const imgs = look.images && look.images.length > 0 ? look.images : look.imageUrl ? [look.imageUrl] : [];
    return `<div class="card" style="max-width: 550px; margin: 0 auto; border: 2px solid #0284c7;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px;">
        <span class="badge" style="background:${getLookColor(look.dept, look.lookNumber, look.customColor)};">${DEPT_NAMES[look.dept]} #${look.lookNumber}</span>
        <span style="font-size:11px; font-family:monospace; color:#64748b;">ID: ${look.id}</span>
      </div>
      <h2 style="color:#0284c7; margin-bottom:4px;">${look.title}</h2>
      <p style="font-size:13px; font-weight:bold; color:#334155; margin-bottom:12px;">Target Element: ${look.targetName}</p>
      
      ${imgs.length > 0 ? `<div class="img-grid" style="justify-content:center; margin-bottom:12px;">
        ${imgs.map((i) => `<img src="${i}" style="width:180px; height:180px;" />`).join('')}
      </div>` : ''}

      <div class="meta-grid">
        <div><div class="meta-label">Scene Coverage</div><div class="meta-val">Scenes ${look.fromScene} – ${look.toScene}</div></div>
        <div><div class="meta-label">Damage State</div><div class="meta-val">${look.damageLevel && look.damageLevel !== 'None' ? `⚡ ${look.damageLevel}` : 'Clean'}</div></div>
        <div><div class="meta-label">Special Continuity</div><div class="meta-val">${look.special ? 'Yes' : 'No'}</div></div>
        <div><div class="meta-label">Department</div><div class="meta-val">${DEPT_NAMES[look.dept]}</div></div>
      </div>

      <div class="notes">
        <strong style="display:block; margin-bottom:4px; font-size:11px; text-transform:uppercase; color:#64748b;">Continuity Notes:</strong>
        ${look.description || 'No detailed notes provided.'}
      </div>
    </div>`;
  };

  const getAuditSummaryText = () => {
    const totalCount = auditResults.conflicts.length + auditResults.gaps.length;
    let text = `========================================\nCONTINUITY HEALTH AUDIT REPORT\nTotal Audit Warnings: ${totalCount}\n========================================\n\n`;
    if (totalCount === 0) {
      text += `All clear! No continuity gaps or anomalies detected.\n`;
    } else {
      if (auditResults.conflicts.length > 0) {
        text += `FLAGGED SHOOT DAY CONFLICTS (${auditResults.conflicts.length}):\n`;
        auditResults.conflicts.forEach((c, i) => {
          text += `${i + 1}. [CONFLICT] Shoot Day #${c.day} - Scene #${c.scene} (${c.character}): ${c.detail}\n`;
        });
        text += `\n`;
      }
      if (auditResults.gaps.length > 0) {
        text += `UNASSIGNED GAPS (${auditResults.gaps.length}):\n`;
        auditResults.gaps.forEach((g, i) => {
          text += `${i + 1}. [GAP] Scene #${g.scene} (${g.character}) - Missing ${g.dept} look assignment\n`;
        });
      }
    }
    return text;
  };

  const getAuditSummaryHtml = () => {
    const totalCount = auditResults.conflicts.length + auditResults.gaps.length;
    let html = `<div class="card">
      <h3>Continuity Health Audit Report</h3>
      <p style="font-size:12px; color:#64748b;">Total Issues Found: <strong>${totalCount}</strong> (${auditResults.conflicts.length} Conflicts, ${auditResults.gaps.length} Gaps)</p>
    </div>`;
    if (totalCount === 0) {
      html += `<p style="font-size: 14px; color: #16a34a; font-weight: bold;">✔ All clear! No continuity gaps or anomalies detected across project timeline.</p>`;
    } else {
      html += `<table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Scene / Day</th>
            <th>Character / Target</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>`;
      auditResults.conflicts.forEach((c) => {
        html += `<tr>
          <td><span class="badge" style="background:#dc2626;">Conflict</span></td>
          <td>Shoot Day #${c.day} (SC ${c.scene})</td>
          <td><strong>${c.character}</strong></td>
          <td>${c.detail}</td>
        </tr>`;
      });
      auditResults.gaps.forEach((g) => {
        html += `<tr>
          <td><span class="badge" style="background:#d97706;">Unassigned Gap</span></td>
          <td>Scene #${g.scene}</td>
          <td><strong>${g.character}</strong></td>
          <td>Missing ${g.dept} look assignment</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }
    return html;
  };

  const chartCanvasRef = useRef<HTMLDivElement>(null);
  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightTracksRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef<boolean>(false);

  const handleLeftScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (rightTracksRef.current && leftSidebarRef.current) {
      rightTracksRef.current.scrollTop = leftSidebarRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleRightScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftSidebarRef.current && rightTracksRef.current) {
      leftSidebarRef.current.scrollTop = rightTracksRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (chartCanvasRef.current) {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        chartCanvasRef.current.scrollLeft += delta;
      }
    }
  };

  // Sync zoom bounds whenever project scenes change
  useEffect(() => {
    setZoomRange([sceneMin, Math.min(sceneMin + 9, sceneMax)]);
    setScrubScene(sceneMin);
  }, [sceneMin, sceneMax]);

  const zoomMin = zoomRange[0];
  const zoomMax = zoomRange[1];

  // Number of visible scene columns in current timeline window
  const colCount = Math.max(zoomMax - zoomMin + 1, 1);
  const colWidthPct = 100 / colCount;

  // Exact left percentage position for a given scene column
  const getSceneLeftPct = (n: number) => {
    return (n - zoomMin) * colWidthPct;
  };

  // Exact style for look span bar across scenes
  const getLookSpanStyle = (fromScene: number, toScene: number) => {
    const clampedFrom = Math.max(fromScene, zoomMin);
    const clampedTo = Math.min(toScene, zoomMax);
    const left = (clampedFrom - zoomMin) * colWidthPct;
    const width = Math.max((clampedTo - clampedFrom + 1) * colWidthPct, 0.5);
    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  };

  const pct = (n: number) => {
    if (sceneMax <= sceneMin) return 0;
    return Math.min(Math.max(((n - sceneMin) / (sceneMax - sceneMin)) * 100, 0), 100);
  };

  // Convert cursor X position in canvas into exact scene column
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartCanvasRef.current) return;
    const rect = chartCanvasRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    const width = rect.width;

    if (width <= 0) return;

    const sidebarWidth = width >= 768 ? 256 : 208;
    const sceneWidth = width - sidebarWidth;

    if (sceneWidth > 0 && relativeX >= sidebarWidth) {
      const sceneX = relativeX - sidebarWidth;
      const fraction = Math.min(Math.max(sceneX / sceneWidth, 0), 0.9999);
      const colIndex = Math.floor(fraction * colCount);
      const calculatedScene = Math.min(Math.max(zoomMin + colIndex, zoomMin), zoomMax);

      setScrubScene(calculatedScene);
      setChartHoverPos({ x: relativeX, y: relativeY });

      // Handle active Look edge resizing
      if (resizingLook) {
        setLooks((prev) =>
          prev.map((lk) => {
            if (lk.id !== resizingLook.lookId) return lk;
            if (resizingLook.edge === 'from') {
              const newFrom = Math.min(calculatedScene, lk.toScene);
              return { ...lk, fromScene: newFrom };
            } else {
              const newTo = Math.max(calculatedScene, lk.fromScene);
              return { ...lk, toScene: newTo };
            }
          })
        );
      }
    } else {
      setChartHoverPos(null);
    }
  };

  const handleChartMouseLeave = () => {
    setChartHoverPos(null);
    if (resizingLook) setResizingLook(null);
  };

  // Track drag mouse handlers for drawing look ranges directly on chart
  const handleTrackMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    dept: 'costume' | 'makeup' | 'vehicle' | 'props',
    rowKey: string,
    targetName: string
  ) => {
    if ((e.target as HTMLElement).closest('.look-box-item')) return;
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const sc = Math.round(zoomMin + frac * (zoomMax - zoomMin));

    setDragState({
      isDragging: true,
      dept,
      rowKey,
      targetName,
      startScene: sc,
      currentScene: sc,
    });
  };

  const handleTrackMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    dept: 'costume' | 'makeup' | 'vehicle' | 'props',
    rowKey: string
  ) => {
    if (!dragState || !dragState.isDragging) return;
    if (dragState.dept !== dept || dragState.rowKey !== rowKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const sc = Math.round(zoomMin + frac * (zoomMax - zoomMin));

    setDragState((prev) => (prev ? { ...prev, currentScene: sc } : null));
  };

  const handleTrackMouseUp = () => {
    if (resizingLook) {
      setResizingLook(null);
      return;
    }

    if (!dragState || !dragState.isDragging) return;

    const fromSc = Math.min(dragState.startScene, dragState.currentScene);
    const toSc = Math.max(dragState.startScene, dragState.currentScene);
    const { dept, targetName } = dragState;

    setDragState(null);

    // Open creation modal for the dragged scene range
    handleOpenModal(undefined, dept, targetName, fromSc, toSc);
  };

  // Minimap Interaction Handlers
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const targetScene = Math.round(sceneMin + frac * (sceneMax - sceneMin));
    const currentSpan = zoomMax - zoomMin;
    const newMin = Math.max(sceneMin, Math.min(targetScene - Math.floor(currentSpan / 2), sceneMax - currentSpan));
    const newMax = Math.min(sceneMax, newMin + currentSpan);
    setZoomRange([newMin, newMax]);
    setScrubScene(targetScene);
  };

  // Derive Shoot Schedule Days dynamically from Project Beats
  const shootScheduleDays: ShootDayGroup[] = useMemo(() => {
    if (!beats || beats.length === 0) {
      return [
        {
          day: 1,
          date: 'Aug 4',
          loc: 'Trailhead — Unit Base',
          callTime: '06:00 AM',
          scenes: [
            {
              id: 'sc-10',
              num: 10,
              day: 1,
              slug: 'INT. VOSS HOUSE — DAY — Mara leaves for trailhead',
              location: 'VOSS HOUSE',
              cast: 'Mara',
              states: { 'costume:mara': 'costume-mara-1', 'makeup:mara': 'makeup-mara-1' },
            },
            {
              id: 'sc-12',
              num: 12,
              day: 1,
              slug: 'EXT. TRAILHEAD — DAY — Mara meets Ranger Cole',
              location: 'TRAILHEAD',
              cast: 'Mara, Cole',
              states: {
                'costume:mara': 'costume-mara-1',
                'costume:cole': 'costume-cole-1',
                'makeup:mara': 'makeup-mara-1',
              },
            },
            {
              id: 'sc-42',
              num: 42,
              day: 1,
              slug: 'EXT. RAVINE — DAY — The fall begins',
              location: 'RAVINE',
              cast: 'Mara',
              states: {
                'costume:mara': 'costume-mara-2',
                'makeup:mara': 'makeup-mara-2',
                'props:satphone': 'props-satphone-1',
              },
            },
          ],
        },
        {
          day: 2,
          date: 'Aug 5',
          loc: 'Riverbank — Location B',
          callTime: '06:30 AM',
          scenes: [
            {
              id: 'sc-45',
              num: 45,
              day: 2,
              slug: 'EXT. RIVERBANK — DAY — Mara drags herself out',
              location: 'RIVERBANK',
              cast: 'Mara',
              states: {
                'costume:mara': 'costume-mara-3',
                'makeup:mara': 'makeup-mara-2',
                'props:satphone': 'props-satphone-2',
              },
            },
          ],
        },
      ];
    }

    const scenesPerDay = Math.max(1, Math.ceil(beats.length / 4));
    const dayGroups: ShootDayGroup[] = [];

    for (let d = 0; d < 4; d++) {
      const chunk = beats.slice(d * scenesPerDay, (d + 1) * scenesPerDay);
      if (chunk.length === 0) break;

      const scheduledScenes: ScheduledScene[] = chunk.map((beat, bIdx) => {
        const num = parseInt(beat.sceneNumber || String(d * scenesPerDay + bIdx + 1), 10) || (bIdx + 1);
        const slug = beat.slug?.raw || beat.title || `Scene ${num}`;
        const location = beat.slug?.location || 'LOCATION';

        const castList: string[] = [];
        if (beat.breakdown?.cast) {
          beat.breakdown.cast.forEach((c) => {
            const name = typeof c === 'string' ? c : c.name;
            if (name) castList.push(name);
          });
        }
        if (castList.length === 0) castList.push('Mara Voss');

        const states: Record<string, string> = {};
        looks.forEach((lk) => {
          if (num >= lk.fromScene && num <= lk.toScene) {
            states[`${lk.dept}:${lk.rowKey}`] = lk.id;
          }
        });

        return {
          id: `beat-sc-${beat.id}`,
          num,
          day: d + 1,
          slug,
          location,
          cast: castList.join(', '),
          states,
        };
      });

      dayGroups.push({
        day: d + 1,
        date: `Aug ${4 + d}`,
        loc: chunk[0]?.slug?.location ? `${chunk[0].slug.location} — Set` : `Shoot Location ${d + 1}`,
        callTime: '06:30 AM',
        scenes: scheduledScenes,
      });
    }

    return dayGroups;
  }, [beats, looks]);

  // Check for Same-day Continuity Conflicts
  const hasConflict = (dayScenes: ScheduledScene[], sc: ScheduledScene) => {
    return dayScenes.some((other) => {
      if (other.id === sc.id) return false;
      return Object.keys(sc.states).some(
        (rowkey) => other.states[rowkey] && other.states[rowkey] !== sc.states[rowkey]
      );
    });
  };

  const handleRangePreset = (preset: string) => {
    if (preset === 'ALL') {
      setZoomRange([sceneMin, sceneMax]);
    } else if (preset === '1-10') {
      setZoomRange([1, Math.min(10, sceneMax)]);
    } else if (preset === '11-20') {
      setZoomRange([11, Math.min(20, sceneMax)]);
    } else if (preset === '21-30') {
      setZoomRange([21, Math.min(30, sceneMax)]);
    }
  };

  const handleZoomIn = () => {
    const currentSpan = zoomMax - zoomMin;
    if (currentSpan <= 3) return;
    const mid = Math.round((zoomMin + zoomMax) / 2);
    const newHalf = Math.max(1, Math.floor(currentSpan / 3));
    setZoomRange([Math.max(sceneMin, mid - newHalf), Math.min(sceneMax, mid + newHalf)]);
  };

  const handleZoomOut = () => {
    const currentSpan = zoomMax - zoomMin;
    const mid = Math.round((zoomMin + zoomMax) / 2);
    const newHalf = Math.min(sceneMax, Math.floor(currentSpan * 0.75));
    setZoomRange([Math.max(sceneMin, mid - newHalf), Math.min(sceneMax, mid + newHalf)]);
  };

  const activeScrubBeat = useMemo(() => {
    return beats.find((b) => {
      const numStr = b.sceneNumber || '';
      return parseInt(numStr, 10) === scrubScene;
    });
  }, [beats, scrubScene]);

  const activeScrubLooks = useMemo(() => {
    return looks.filter((l) => scrubScene >= l.fromScene && scrubScene <= l.toScene);
  }, [looks, scrubScene]);

  const activeScrubConflictDay = useMemo(() => {
    for (const dayGroup of shootScheduleDays) {
      const matchingSc = dayGroup.scenes.find((s) => s.num === scrubScene);
      if (matchingSc && hasConflict(dayGroup.scenes, matchingSc)) {
        return dayGroup.day;
      }
    }
    return null;
  }, [shootScheduleDays, scrubScene]);

  // Derive Tracked Characters & Items from Project Breakdown and CharacterData
  const trackedRows: TrackedRow[] = useMemo(() => {
    const map = new Map<string, TrackedRow>();

    (Object.values(characterData || {}) as CharacterData[]).forEach((char) => {
      if (char && char.name) {
        const key = char.name.toLowerCase().replace(/\s+/g, '-');
        map.set(`costume:${key}`, {
          key,
          dept: 'costume',
          label: char.name,
          avatar: char.images?.[0],
        });
        map.set(`makeup:${key}`, {
          key,
          dept: 'makeup',
          label: char.name,
          avatar: char.images?.[0],
        });
      }
    });

    (beats || []).forEach((b) => {
      if (b.breakdown) {
        const bd = b.breakdown;
        (bd.costume || []).forEach((item) => {
          const name = typeof item === 'string' ? item : item.name;
          if (name) {
            const key = name.toLowerCase().replace(/\s+/g, '-');
            if (!map.has(`costume:${key}`)) {
              map.set(`costume:${key}`, { key, dept: 'costume', label: name });
            }
          }
        });
        (bd.props || []).forEach((item) => {
          const name = typeof item === 'string' ? item : item.name;
          if (name) {
            const key = name.toLowerCase().replace(/\s+/g, '-');
            if (!map.has(`props:${key}`)) {
              map.set(`props:${key}`, { key, dept: 'props', label: name });
            }
          }
        });
        (bd.practical || []).concat(bd.vfx || []).forEach((item) => {
          const name = typeof item === 'string' ? item : item.name;
          if (name) {
            const key = name.toLowerCase().replace(/\s+/g, '-');
            if (!map.has(`vehicle:${key}`)) {
              map.set(`vehicle:${key}`, { key, dept: 'vehicle', label: name });
            }
          }
        });
        (bd.cast || []).forEach((item) => {
          const name = typeof item === 'string' ? item : item.name;
          if (name) {
            const key = name.toLowerCase().replace(/\s+/g, '-');
            if (!map.has(`costume:${key}`)) {
              map.set(`costume:${key}`, { key, dept: 'costume', label: name });
            }
          }
        });
      }
    });

    looks.forEach((lk) => {
      const rk = `${lk.dept}:${lk.rowKey}`;
      if (!map.has(rk)) {
        map.set(rk, { key: lk.rowKey, dept: lk.dept, label: lk.targetName });
      }
    });

    return Array.from(map.values());
  }, [beats, characterData, looks]);

  const handleSelectSequence = (seqId: string) => {
    setSelectedSequenceId(seqId);
    if (seqId === 'all') {
      setZoomRange([sceneMin, Math.min(sceneMin + 9, sceneMax)]);
      setScrubScene(sceneMin);
    } else {
      const seq = sequences.find((s) => s.id === seqId);
      if (seq && seq.scenes.length > 0) {
        const minSc = Math.min(...seq.scenes);
        const maxSc = Math.max(...seq.scenes);
        setZoomRange([minSc, maxSc]);
        setScrubScene(minSc);
      }
    }
  };
  const selectedLook = useMemo(() => {
    if (selectedLookId) {
      return looks.find((l) => l.id === selectedLookId) || null;
    }
    return null;
  }, [selectedLookId, looks]);

  // Hovered track row key state
  const [hoveredTrackKey, setHoveredTrackKey] = useState<string | null>(null);

  // Derive active working row key for focus highlighting and non-active row dimming
  const activeWorkingRowKey = useMemo(() => {
    if (dragState?.isDragging) {
      return `${dragState.dept}:${dragState.rowKey}`;
    }
    if (resizingLook) {
      const lk = looks.find((l) => l.id === resizingLook.lookId);
      if (lk) return `${lk.dept}:${lk.rowKey}`;
    }
    if (hoveredTrackKey) {
      return hoveredTrackKey;
    }
    if (selectedLook) {
      return `${selectedLook.dept}:${selectedLook.rowKey}`;
    }
    return null;
  }, [dragState, resizingLook, hoveredTrackKey, selectedLook, looks]);

  // Open modal for creating or editing a look
  const handleOpenModal = (
    lookToEdit?: ContinuityLook,
    defaultDept?: 'costume' | 'makeup' | 'vehicle' | 'props',
    defaultTargetName?: string,
    defaultFromScene?: number,
    defaultToScene?: number
  ) => {
    if (lookToEdit) {
      setEditingLook(lookToEdit);
      setFormDept(lookToEdit.dept);
      setFormTargetName(lookToEdit.targetName);
      setFormTitle(lookToEdit.title);
      setFormFromScene(lookToEdit.fromScene);
      setFormToScene(lookToEdit.toScene);
      const initialImgs = lookToEdit.images && lookToEdit.images.length > 0
        ? lookToEdit.images
        : lookToEdit.imageUrl ? [lookToEdit.imageUrl] : [];
      setFormImages(initialImgs);
      setUrlInputText('');
      setFormDescription(lookToEdit.description);
      setFormSpecial(lookToEdit.special ?? true);
      setFormDamage(lookToEdit.damageLevel || 'None');
      setFormCustomColor(lookToEdit.customColor || '');
    } else {
      setEditingLook(null);
      setFormDept(defaultDept || activeDept);
      setFormTargetName(defaultTargetName || '');
      setFormTitle(
        defaultTargetName
          ? `${defaultTargetName} Look (${(defaultFromScene && defaultToScene && defaultFromScene !== defaultToScene) ? `SC ${defaultFromScene}–${defaultToScene}` : `SC ${defaultFromScene || 1}`})`
          : ''
      );
      setFormFromScene(defaultFromScene ?? 1);
      setFormToScene(defaultToScene ?? (sceneMax || 10));
      setFormImages([]);
      setUrlInputText('');
      setFormDescription('');
      setFormSpecial(true);
      setFormDamage('None');
      setFormCustomColor('');
    }
    setModalDeleteConfirm(false);
    setIsLookModalOpen(true);
  };

  // Save Look Form
  const handleSaveLook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTargetName.trim() || !formTitle.trim()) return;

    const rowKey = formTargetName.toLowerCase().replace(/\s+/g, '-');
    const deptLooks = looks.filter((l) => l.dept === formDept && l.rowKey === rowKey);
    const finalImages = formImages.filter((url) => url.trim().length > 0);

    if (editingLook) {
      setLooks((prev) =>
        prev.map((l) =>
          l.id === editingLook.id
            ? {
                ...l,
                dept: formDept,
                rowKey,
                targetName: formTargetName,
                title: formTitle,
                fromScene: formFromScene,
                toScene: formToScene,
                images: finalImages.length > 0 ? finalImages : undefined,
                imageUrl: finalImages.length > 0 ? finalImages[0] : undefined,
                description: formDescription,
                special: formSpecial,
                damageLevel: formDamage,
                customColor: formCustomColor.trim() || undefined,
              }
            : l
        )
      );
    } else {
      const newLook: ContinuityLook = {
        id: `look-${formDept}-${rowKey}-${Date.now()}`,
        dept: formDept,
        rowKey,
        targetName: formTargetName,
        lookNumber: deptLooks.length + 1,
        title: formTitle.startsWith(`${formDept.toUpperCase()}`)
          ? formTitle
          : `${DEPT_NAMES[formDept]} ${deptLooks.length + 1}: ${formTitle}`,
        fromScene: formFromScene,
        toScene: formToScene,
        images: finalImages.length > 0 ? finalImages : undefined,
        imageUrl: finalImages.length > 0 ? finalImages[0] : undefined,
        description: formDescription,
        special: formSpecial,
        damageLevel: formDamage,
        customColor: formCustomColor.trim() || undefined,
      };

      setLooks((prev) => [...prev, newLook]);
      setSelectedLookId(newLook.id);
    }

    setIsLookModalOpen(false);
  };

  // Delete a Look
  const handleDeleteLook = (id: string) => {
    setLooks((prev) => prev.filter((l) => l.id !== id));
    if (selectedLookId === id) setSelectedLookId('');
  };

  // Duplicate a Look
  const handleDuplicateLook = (look: ContinuityLook) => {
    const duplicated: ContinuityLook = {
      ...look,
      id: `look-${look.dept}-${look.rowKey}-${Date.now()}`,
      title: `${look.title} (Copy)`,
      fromScene: Math.min(look.toScene + 1, sceneMax),
      toScene: Math.min(look.toScene + 5, sceneMax),
    };
    setLooks((prev) => [...prev, duplicated]);
    setSelectedLookId(duplicated.id);
  };

  // Selected Sequence memo
  const selectedSequence = useMemo(() => {
    return sequences.find((s) => s.id === selectedSequenceId) || null;
  }, [sequences, selectedSequenceId]);

  // Parse scene list inputs e.g. "1, 18, 48, 49, 50" or "42-45"
  const parseScenesInput = (str: string): number[] => {
    const list: number[] = [];
    const parts = str.split(/[,;\s]+/);
    for (const p of parts) {
      if (!p) continue;
      if (p.includes('-')) {
        const [startStr, endStr] = p.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let i = min; i <= max; i++) {
            if (!list.includes(i)) list.push(i);
          }
        }
      } else {
        const val = parseInt(p, 10);
        if (!isNaN(val) && !list.includes(val)) {
          list.push(val);
        }
      }
    }
    return list;
  };

  const handleMoveSequenceScene = (seqId: string, index: number, direction: 'left' | 'right') => {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== seqId) return s;
        const newScenes = [...s.scenes];
        const targetIdx = direction === 'left' ? index - 1 : index + 1;
        if (targetIdx < 0 || targetIdx >= newScenes.length) return s;
        const temp = newScenes[index];
        newScenes[index] = newScenes[targetIdx];
        newScenes[targetIdx] = temp;
        return { ...s, scenes: newScenes };
      })
    );
  };

  const handleSortSequenceChronology = (seqId: string) => {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== seqId) return s;
        const sorted = [...s.scenes].sort((a, b) => a - b);
        return { ...s, scenes: sorted };
      })
    );
  };

  const handleOpenSequenceModal = (seqToEdit?: SequenceBlock) => {
    if (seqToEdit) {
      setEditingSequence(seqToEdit);
      setSeqFormName(seqToEdit.name);
      setSeqFormLoc(seqToEdit.location);
      setSeqFormEra(seqToEdit.eraOrPeriod);
      setSeqFormScenes(seqToEdit.scenes.join(', '));
      setSeqFormColor(seqToEdit.color);
      setSeqFormDay(seqToEdit.shootDay || 1);
      setSeqFormDesc(seqToEdit.description || '');
    } else {
      setEditingSequence(null);
      setSeqFormName('');
      setSeqFormLoc("INT. KING'S PALACE — GRAND HALL");
      setSeqFormEra('3000 B.C. Ancient Dynasty');
      setSeqFormScenes('1, 18, 48, 49, 50');
      setSeqFormColor('#a855f7');
      setSeqFormDay(1);
      setSeqFormDesc('Scenes taking place 3000 years ago in King\'s Palace.');
    }
    setIsSequenceModalOpen(true);
  };

  const handleSaveSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seqFormName.trim()) return;
    const parsedSc = parseScenesInput(seqFormScenes);
    if (parsedSc.length === 0) return;

    if (editingSequence) {
      setSequences((prev) =>
        prev.map((s) =>
          s.id === editingSequence.id
            ? {
                ...s,
                name: seqFormName,
                location: seqFormLoc,
                eraOrPeriod: seqFormEra,
                scenes: parsedSc,
                color: seqFormColor,
                shootDay: seqFormDay,
                description: seqFormDesc,
              }
            : s
        )
      );
    } else {
      const newSeq: SequenceBlock = {
        id: `seq-${Date.now()}`,
        name: seqFormName,
        location: seqFormLoc,
        eraOrPeriod: seqFormEra,
        scenes: parsedSc,
        color: seqFormColor,
        shootDay: seqFormDay,
        description: seqFormDesc,
      };
      setSequences((prev) => [...prev, newSeq]);
      setSelectedSequenceId(newSeq.id);
    }
    setIsSequenceModalOpen(false);
  };

  const handleDeleteSequence = (id: string) => {
    setSequences((prev) => prev.filter((s) => s.id !== id));
    if (selectedSequenceId === id) setSelectedSequenceId('all');
  };

  // Analyze Sequence-wide continuity across non-consecutive scenes
  const getSequenceContinuityStatus = (seq: SequenceBlock) => {
    const characterMap: Record<string, Record<number, ContinuityLook | undefined>> = {};
    const discrepancies: string[] = [];

    trackedRows.forEach((row) => {
      const rowId = `${row.dept}:${row.key}`;
      characterMap[rowId] = {};
      seq.scenes.forEach((sc) => {
        const look = looks.find((l) => l.dept === row.dept && l.rowKey === row.key && sc >= l.fromScene && sc <= l.toScene);
        characterMap[rowId][sc] = look;
      });

      const looksAssigned = Object.values(characterMap[rowId]).filter(Boolean) as ContinuityLook[];
      if (looksAssigned.length > 1) {
        const firstLookId = looksAssigned[0].id;
        const hasMismatch = looksAssigned.some((l) => l.id !== firstLookId);
        if (hasMismatch) {
          discrepancies.push(`${row.label} (${row.dept}) has conflicting looks across sequence scenes (${seq.scenes.join(', ')}).`);
        }
      }
    });

    return { characterMap, discrepancies };
  };

  // Search Index for Real-time Filtering & Highlighting
  const matchingLookIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const set = new Set<string>();
    looks.forEach((l) => {
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchTarget = l.targetName.toLowerCase().includes(q);
      const matchDesc = l.description.toLowerCase().includes(q);
      const matchDamage = l.damageType ? l.damageType.toLowerCase().includes(q) : false;
      const matchLookNum = `look ${l.lookNumber}`.includes(q) || `#${l.lookNumber}`.includes(q);
      const matchTags = l.tags ? l.tags.some((t) => t.toLowerCase().includes(q)) : false;
      const matchNotes = l.sceneNotes ? Object.values(l.sceneNotes).some((n) => String(n).toLowerCase().includes(q)) : false;

      if (matchTitle || matchTarget || matchDesc || matchDamage || matchLookNum || matchTags || matchNotes) {
        set.add(l.id);
      }
    });
    return set;
  }, [looks, searchQuery]);

  const matchingRowKeys = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const set = new Set<string>();

    trackedRows.forEach((r) => {
      if (r.label.toLowerCase().includes(q)) {
        set.add(`${r.dept}:${r.key}`);
      }
    });

    looks.forEach((l) => {
      if (matchingLookIds.has(l.id)) {
        set.add(`${l.dept}:${l.rowKey}`);
      }
    });

    return set;
  }, [trackedRows, looks, matchingLookIds, searchQuery]);

  // Department specific looks for detail manager
  const currentDeptLooks = useMemo(() => {
    return looks.filter((l) => {
      if (l.dept !== activeDept) return false;
      if (searchQuery) {
        return matchingLookIds.has(l.id);
      }
      return true;
    });
  }, [looks, activeDept, searchQuery, matchingLookIds]);

  // Continuity Audit Gaps & Conflicts Engine
  const auditResults = useMemo(() => {
    const gaps: Array<{ scene: number; character: string; dept: string }> = [];
    const conflicts: Array<{ day: number; scene: number; character: string; detail: string }> = [];

    sceneNumbers.forEach((scNum) => {
      const beat = beats.find((b) => (parseInt(b.sceneNumber || '', 10) || 0) === scNum);
      if (beat && beat.breakdown?.cast) {
        beat.breakdown.cast.forEach((c) => {
          const charName = typeof c === 'string' ? c : c.name;
          if (charName) {
            const key = charName.toLowerCase().replace(/\s+/g, '-');
            const hasCostume = looks.some(
              (l) => l.dept === 'costume' && l.rowKey === key && scNum >= l.fromScene && scNum <= l.toScene
            );
            if (!hasCostume) {
              gaps.push({ scene: scNum, character: charName, dept: 'costume' });
            }
          }
        });
      }
    });

    shootScheduleDays.forEach((dayGroup) => {
      dayGroup.scenes.forEach((sc) => {
        if (hasConflict(dayGroup.scenes, sc)) {
          conflicts.push({
            day: dayGroup.day,
            scene: sc.num,
            character: sc.cast,
            detail: `Shoot Day #${dayGroup.day} features out-of-order look changes.`,
          });
        }
      });
    });

    return { gaps, conflicts };
  }, [sceneNumbers, beats, looks, shootScheduleDays]);

  return (
    <div className={`continuity-studio-wrapper w-full h-screen max-h-screen font-sans flex flex-col overflow-hidden select-none transition-colors ${
      chartTheme === 'dark' ? 'bg-[#09090b] text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* PRO TOP COMMAND & METRIC HEADER */}
      <div className={`flex-none flex items-center justify-between px-5 py-2.5 border-b shadow-xs z-30 transition-colors ${
        chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-['Oswald'] font-bold text-lg tracking-wider uppercase m-0 flex items-center gap-2">
              <span>Continuity Studio</span>
              <span className="text-[10px] font-mono font-normal text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> REALTIME SYNC
              </span>
            </h1>
          </div>
        </div>

        {/* MIDDLE QUICK STATS & SEARCH */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            chartTheme === 'dark'
              ? 'bg-[#121215] border-slate-800 text-white focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/30'
              : 'bg-white border-slate-300 text-slate-900 shadow-2xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20'
          }`}>
            <Search className={`w-3.5 h-3.5 flex-none ${chartTheme === 'dark' ? 'text-cyan-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search character, look, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent text-xs focus:outline-none w-44 font-sans ${
                chartTheme === 'dark' ? 'text-white placeholder:text-slate-400 font-medium' : 'text-slate-900 placeholder:text-slate-400 font-medium'
              }`}
            />
            {searchQuery ? (
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  chartTheme === 'dark' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-blue-100 text-blue-800'
                }`}>
                  {matchingLookIds.size}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                    chartTheme === 'dark' ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                  title="Clear search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded border font-bold ${
              chartTheme === 'dark'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'bg-cyan-50 text-cyan-800 border-cyan-200'
            }`}>
              {sceneNumbers.length} Scenes
            </span>
            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded border font-bold ${
              chartTheme === 'dark'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              {looks.length} Looks
            </span>
            {auditResults.conflicts.length > 0 && (
              <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded border font-bold animate-pulse ${
                chartTheme === 'dark'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <AlertTriangle className="w-3 h-3" /> {auditResults.conflicts.length} Conflict
              </span>
            )}
          </div>
        </div>

        {/* RIGHT CONTROLS */}
        <div className="flex items-center gap-2.5">
          {/* VIEW MODE TABS */}
          <div className={`flex p-0.5 rounded-lg border text-xs ${
            chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-200/90 border-slate-300'
          }`}>
            <button
              onClick={() => setActiveTab('ruler')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                activeTab === 'ruler'
                  ? 'bg-[#2962ff] text-white shadow-xs font-bold'
                  : chartTheme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <BarChart2 className={`w-3.5 h-3.5 ${chartTheme === 'dark' ? 'text-cyan-300' : 'text-blue-700'}`} />
              <span>Interactive Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab('sequence')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                activeTab === 'sequence'
                  ? 'bg-[#2962ff] text-white shadow-xs font-bold'
                  : chartTheme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <Filter className={`w-3.5 h-3.5 ${chartTheme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`} />
              <span>Sequence & Era Matrix</span>
              {sequences.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${
                  activeTab === 'sequence'
                    ? 'bg-white/20 text-white border-white/30'
                    : chartTheme === 'dark'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-purple-100 text-purple-800 border-purple-300'
                }`}>
                  {sequences.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('dept-detail')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                activeTab === 'dept-detail'
                  ? 'bg-[#2962ff] text-white shadow-xs font-bold'
                  : chartTheme === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${chartTheme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`} />
              <span>Department Deck</span>
            </button>
          </div>

          {/* THEME TOGGLE */}
          <button
            onClick={() => {
              const nextTheme = chartTheme === 'dark' ? 'light' : 'dark';
              setChartTheme(nextTheme);
              setAppTheme(nextTheme);
            }}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              chartTheme === 'dark' ? 'bg-[#121215] text-amber-400 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 shadow-2xs'
            }`}
            title="Toggle Color Theme (Syncs across app)"
          >
            {chartTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* TOGGLE INSPECTOR */}
          <button
            onClick={() => setIsInspectorOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer shadow-xs ${
              isInspectorOpen
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/50 scale-[1.02]'
                : chartTheme === 'dark'
                ? 'bg-[#121215] text-slate-300 hover:text-white border-slate-800 hover:bg-slate-800'
                : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300 shadow-2xs'
            }`}
            title={isInspectorOpen ? 'Inspector Drawer is ON (Click to Hide)' : 'Inspector Drawer is OFF (Click to Show)'}
          >
            <Info className={`w-3.5 h-3.5 ${isInspectorOpen ? 'text-slate-950 stroke-[2.5]' : ''}`} />
            <span className="hidden sm:inline tracking-wide font-bold uppercase text-[11px]">Inspector</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider transition-all ${
              isInspectorOpen
                ? 'bg-slate-950 text-amber-300 shadow-xs animate-pulse'
                : chartTheme === 'dark'
                ? 'bg-slate-800 text-slate-400'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {isInspectorOpen ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* DEPARTMENT & FILTER STRIP */}
      <div className={`flex-none flex items-center justify-between px-5 py-2 border-b text-xs font-mono transition-colors ${
        chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
      }`}>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <span className={`text-[10px] uppercase tracking-wider mr-1 font-extrabold ${
            chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          }`}>
            DEPARTMENTS:
          </span>

          {/* ALL DEPARTMENTS BUTTON */}
          <button
            onClick={() => handleDepartmentClick('all')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer border ${
              activeDeptFilter === 'all'
                ? chartTheme === 'dark'
                  ? 'bg-[#2962ff] text-white border-[#2962ff] shadow-sm'
                  : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : chartTheme === 'dark'
                ? 'bg-[#121215] text-slate-200 border-slate-800 hover:text-white hover:bg-slate-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
            }`}
            title="Expand all department tracks"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>ALL DEPARTMENTS</span>
          </button>

          {(['costume', 'makeup', 'vehicle', 'props'] as const).map((dept) => {
            const count = looks.filter((l) => l.dept === dept).length;
            const isActive = activeDept === dept && activeDeptFilter === dept;
            const Icon = DEPT_ICONS[dept];
            return (
              <button
                key={dept}
                onClick={() => handleDepartmentClick(dept)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] transition-all cursor-pointer border font-semibold ${
                  isActive
                    ? chartTheme === 'dark'
                      ? 'bg-[#1e293b] text-white border-[#38bdf8] shadow-sm font-bold ring-1 ring-[#38bdf8]/30'
                      : 'bg-slate-900 text-white border-slate-900 shadow-sm font-bold ring-2 ring-slate-900/10'
                    : chartTheme === 'dark'
                    ? 'bg-[#121215] text-slate-200 border-slate-800 hover:text-white hover:bg-slate-800'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                }`}
                title={`Filter to ${DEPT_NAMES[dept]} (${count} looks). Expands only ${DEPT_NAMES[dept]} and collapses other departments.`}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: getDeptColor(dept) }} />
                <span>{DEPT_NAMES[dept]}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isActive
                    ? chartTheme === 'dark' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-white'
                    : chartTheme === 'dark' ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`hidden lg:flex items-center gap-3 text-[11px] ${
          chartTheme === 'dark' ? 'text-slate-300 font-medium' : 'text-slate-600 font-medium'
        }`}>
          <span className="italic">💡 Drag mouse across empty track space to add look span • Right-click any look or track for options</span>
        </div>
      </div>

      {/* SEQUENCE & LOCATION FILTER BAR */}
      <div className={`flex-none px-5 py-1.5 border-b flex items-center justify-between text-xs font-mono transition-colors ${
        chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-100/80 border-slate-300'
      }`}>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mr-1 ${
            chartTheme === 'dark' ? 'text-purple-300' : 'text-purple-800'
          }`}>
            <Filter className="w-3 h-3" /> SEQUENCE FILTER:
          </span>
          <button
            onClick={() => handleSelectSequence('all')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all border ${
              selectedSequenceId === 'all'
                ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-xs'
                : chartTheme === 'dark' ? 'bg-[#18181b] text-slate-200 border-slate-800 hover:text-white hover:bg-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            All Scenes
          </button>
          {sequences.map((seq) => {
            const isSelected = selectedSequenceId === seq.id;
            return (
              <button
                key={seq.id}
                onClick={() => handleSelectSequence(seq.id)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-all border ${
                  isSelected
                    ? 'text-white font-bold shadow-xs'
                    : chartTheme === 'dark' ? 'bg-[#18181b] text-slate-200 border-slate-800 hover:text-white hover:bg-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
                style={isSelected ? { backgroundColor: seq.color, borderColor: seq.color } : {}}
              >
                <span>{seq.name}</span>
                <span className="text-[10px] opacity-80 font-bold bg-black/30 text-white px-1 rounded">
                  Sc {seq.scenes.join(', ')}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => handleOpenSequenceModal()}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer transition-colors ${
              chartTheme === 'dark'
                ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/30'
                : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300 shadow-2xs'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>New Sequence</span>
          </button>
        </div>

        {selectedSequence && (
          <div className={`hidden xl:flex items-center gap-2 text-[11px] px-2.5 py-0.5 rounded border animate-fade-in font-bold ${
            chartTheme === 'dark'
              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
              : 'bg-purple-100 text-purple-900 border-purple-300'
          }`}>
            <span>Active Sequence:</span>
            <span>{selectedSequence.location} ({selectedSequence.eraOrPeriod})</span>
            <span className="font-bold text-white bg-purple-600 px-1.5 py-0.2 rounded text-[10px]">
              {selectedSequence.scenes.length} Scenes
            </span>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeTab === 'ruler' ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* MINIMAP PROJECT OVERVIEW STRIP */}
            <div className={`flex-none px-4 py-1.5 border-b flex items-center justify-between gap-3 text-[11px] font-mono ${
              chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center gap-2 flex-none">
                <span className="text-[10px] uppercase font-bold opacity-70">OVERVIEW:</span>
              </div>
              {/* INTERACTIVE MINIMAP CANVAS */}
              <div
                ref={minimapRef}
                onClick={handleMinimapClick}
                className={`flex-1 h-6 rounded relative overflow-hidden border cursor-pointer select-none ${
                  chartTheme === 'dark' ? 'bg-[#09090b] border-slate-800' : 'bg-slate-200 border-slate-300'
                }`}
                title="Click anywhere to pan project view"
              >
                {/* Scene density marks */}
                {sceneNumbers.map((s) => (
                  <div
                    key={s}
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-500/30"
                    style={{ left: `${pct(s)}%` }}
                  />
                ))}
                {/* Viewport Lens Indicator */}
                <div
                  className="absolute top-0 bottom-0 bg-cyan-500/25 border-x-2 border-cyan-400 transition-all rounded-xs pointer-events-none"
                  style={{
                    left: `${pct(zoomMin)}%`,
                    width: `${Math.max(pct(zoomMax) - pct(zoomMin), 2)}%`,
                  }}
                />
              </div>

              {/* ZOOM CONTROLS */}
              <div className="flex items-center gap-1.5 flex-none">
                <button
                  onClick={handleZoomIn}
                  className={`p-1 rounded border hover:bg-cyan-500/20 text-cyan-400 transition-colors cursor-pointer ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-white border-slate-300'
                  }`}
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className={`p-1 rounded border hover:bg-cyan-500/20 text-cyan-400 transition-colors cursor-pointer ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-white border-slate-300'
                  }`}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1 ml-1">
                  {['ALL', '1-10', '11-20', '21-30'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleRangePreset(preset)}
                      className={`px-1.5 py-0.5 text-[10px] rounded border font-mono cursor-pointer transition-colors ${
                        chartTheme === 'dark'
                          ? 'bg-[#121215] hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* LIVE SCENE SCRUBBER HUD */}
            <div className={`flex-none px-4 py-2 border-b flex flex-wrap items-center justify-between gap-3 font-mono text-xs ${
              chartTheme === 'dark'
                ? 'bg-[#18181b] border-slate-800 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-[#2962ff] text-white px-2.5 py-1 rounded font-bold text-xs shadow-xs flex-none flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>SCENE #{scrubScene}</span>
                </div>
                <div className="font-semibold text-xs truncate max-w-xs md:max-w-md">
                  {activeScrubBeat?.slug?.raw || activeScrubBeat?.title || `EXT. LOCATION — SCENE ${scrubScene}`}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {activeScrubConflictDay && (
                  <span className="bg-rose-500 text-white px-2 py-1 rounded font-bold text-xs animate-pulse flex items-center gap-1 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    DAY #{activeScrubConflictDay} CONFLICT
                  </span>
                )}

                <button
                  onClick={() => setIsInspectorOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold cursor-pointer transition-colors ${
                    isInspectorOpen
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-2xs'
                      : chartTheme === 'dark'
                      ? 'bg-[#27272a] hover:bg-slate-700 text-cyan-300 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                  title={isInspectorOpen ? "Inspector Drawer is ON (Click to toggle)" : "View Active Looks in Inspector Drawer"}
                >
                  <Layers className={`w-3.5 h-3.5 ${isInspectorOpen ? 'text-slate-950' : 'text-cyan-400'}`} />
                  <span>{activeScrubLooks.length} Active Looks</span>
                </button>

                <button
                  onClick={() => handleOpenModal(undefined, activeDept, '', scrubScene, scrubScene)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                  title={`Add new look for Scene ${scrubScene}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Look</span>
                </button>
              </div>
            </div>

            {/* ACTIVE SEQUENCE SCALE FILTER HEADER (FULL WIDTH ABOVE STAGE) */}
            {selectedSequence && (
              <div
                className={`flex-none px-4 py-2 border-b flex items-center justify-between font-mono text-xs z-20 shadow-xs transition-all ${
                  chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
                style={{
                  backgroundColor: chartTheme === 'dark' ? `${selectedSequence.color}25` : `${selectedSequence.color}15`,
                  borderColor: `${selectedSequence.color}60`,
                }}
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full animate-ping flex-none" style={{ backgroundColor: selectedSequence.color }} />
                  <span className={`font-bold uppercase tracking-wider text-xs ${
                    chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    ACTIVE SEQUENCE SCALE: {selectedSequence.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${
                      chartTheme === 'dark' ? 'text-white' : 'text-slate-900 font-extrabold'
                    }`}
                    style={{
                      backgroundColor: chartTheme === 'dark' ? `${selectedSequence.color}40` : `${selectedSequence.color}20`,
                      borderColor: selectedSequence.color,
                    }}
                  >
                    Scenes: {selectedSequence.scenes.join(', ')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-none">
                  <button
                    onClick={() => handleCopyText(`seq:${selectedSequence.id}`, getSequenceSummaryText(selectedSequence))}
                    className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                      chartTheme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                    }`}
                    title="Copy sequence summary text"
                  >
                    {copiedKey === `seq:${selectedSequence.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
                    <span>{copiedKey === `seq:${selectedSequence.id}` ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handlePrintHtml(`Sequence Continuity: ${selectedSequence.name}`, getSequenceSummaryHtml(selectedSequence))}
                    className={`px-2 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                      chartTheme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                    }`}
                    title="Print sequence continuity sheet"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => handleSelectSequence('all')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors flex-none ${
                      chartTheme === 'dark'
                        ? 'bg-purple-900/80 hover:bg-purple-800 text-purple-200 border-purple-400/40'
                        : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300'
                    }`}
                    title="Reset scale to view all scenes"
                  >
                    <X className="w-3 h-3" /> Show All Scenes
                  </button>
                </div>
              </div>
            )}

            {/* TIMELINE STAGE CONTAINER */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div
                ref={chartCanvasRef}
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
                onMouseUp={handleTrackMouseUp}
                onWheel={handleTimelineWheel}
                className={`flex-1 overflow-auto relative select-none ${
                  chartTheme === 'dark' ? 'bg-[#09090b]' : 'bg-slate-50'
                }`}
              >
                {/* UNIFIED MATRIX GRID */}
                <div className="min-w-full inline-block align-top relative">
                  {/* STICKY TOP RULER HEADER */}
                  <div className={`sticky top-0 z-40 flex h-10 border-b select-none shadow-xs ${
                    chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-slate-200 border-slate-300'
                  }`}>
                    {/* Top Left Corner Header Cell: STICKY TOP & LEFT */}
                    <div className={`w-52 md:w-64 flex-none sticky left-0 z-50 border-r px-3 flex items-center justify-between font-mono text-[11px] font-bold tracking-wider uppercase ${
                      chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-slate-200' : 'bg-slate-200 border-slate-300 text-slate-700'
                    }`}>
                      <span>TRACKED ELEMENTS</span>
                      <div className="flex items-center gap-1 normal-case font-normal">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText('all-tracked', getAllTrackedText());
                          }}
                          className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                          title="Copy All Tracked Continuity Text"
                        >
                          {copiedKey === 'all-tracked' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintHtml('All Tracked Elements Continuity Report', getAllTrackedHtml());
                          }}
                          className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                          title="Print All Tracked Elements Sheet"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <Filter className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                      </div>
                    </div>

                    {/* Top Ruler Scene Columns */}
                    <div className="flex-1 relative h-full min-w-[500px]">
                      {sceneNumbers.map((s) => {
                        if (s < zoomMin || s > zoomMax) return null;
                        const isSelected = s === scrubScene;
                        const isInActiveSequence = selectedSequence?.scenes.includes(s);
                        const isDraggedInRange =
                          dragState?.isDragging &&
                          s >= Math.min(dragState.startScene, dragState.currentScene) &&
                          s <= Math.max(dragState.startScene, dragState.currentScene);

                        return (
                          <div
                            key={s}
                            onClick={() => setScrubScene(s)}
                            className={`absolute top-0 bottom-0 border-r flex flex-col items-center justify-center font-mono text-[11px] font-bold cursor-pointer transition-all ${
                              isDraggedInRange
                                ? 'bg-purple-600 text-white font-extrabold z-10 shadow-md ring-1 ring-purple-300'
                                : isSelected
                                ? 'bg-[#2962ff] text-white shadow-xs z-10'
                                : isInActiveSequence
                                ? 'text-white font-extrabold z-10 shadow-xs'
                                : selectedSequence
                                ? chartTheme === 'dark' ? 'border-slate-800/50 text-slate-400 hover:text-white opacity-50' : 'border-slate-300/40 text-slate-400 opacity-40'
                                : chartTheme === 'dark' ? 'border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800/40' : 'border-slate-300 text-slate-600 hover:bg-slate-300/50'
                            }`}
                            style={{
                              left: `${getSceneLeftPct(s)}%`,
                              width: `${colWidthPct}%`,
                              backgroundColor:
                                isInActiveSequence && !isSelected && !isDraggedInRange
                                  ? `${selectedSequence.color}40`
                                  : undefined,
                              borderColor: isInActiveSequence ? selectedSequence.color : undefined,
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <span>SC {s}</span>
                              {isInActiveSequence && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-none"
                                  style={{ backgroundColor: selectedSequence.color }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TRACKS CONTAINER WRAPPER WITH FULL-HEIGHT RED PLAYHEAD */}
                  <div className="relative w-full min-h-[calc(100%-2.5rem)]">
                    {/* PLAYHEAD RED LINE - SPANS FROM TOP TO BOTTOM OF ALL TRACK ROWS */}
                    <div className="absolute top-0 bottom-0 left-52 md:left-64 right-0 pointer-events-none z-30">
                      {scrubScene >= zoomMin && scrubScene <= zoomMax && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-lg pointer-events-none"
                          style={{
                            left: `${getSceneLeftPct(scrubScene) + colWidthPct / 2}%`,
                            height: '100%',
                            minHeight: '100%',
                          }}
                        >
                          <div className="w-3.5 h-3.5 bg-rose-500 rotate-45 -ml-[6px] -mt-1 shadow-md border border-white/50 flex items-center justify-center z-30" />
                        </div>
                      )}
                    </div>

                    {/* DEPARTMENT GROUPS & ROW TRACKS */}
                    {(['costume', 'makeup', 'vehicle', 'props'] as const).map((dept) => {
                      const deptRows = trackedRows.filter((r) => r.dept === dept);
                      const displayRows = deptRows.filter((r) => (!searchQuery ? true : matchingRowKeys.has(`${dept}:${r.key}`)));
                      const isCollapsed = searchQuery ? false : collapsedDepts[dept];

                      if (searchQuery && displayRows.length === 0) return null;

                      const Icon = DEPT_ICONS[dept];

                      return (
                        <div key={dept} className="relative">
                          {/* Department Header Row */}
                          <div
                            onClick={() => setCollapsedDepts((prev) => ({ ...prev, [dept]: !prev[dept] }))}
                            className={`flex h-8 border-b font-mono text-xs font-bold cursor-pointer transition-colors select-none ${
                              chartTheme === 'dark'
                                ? 'bg-[#18181b] hover:bg-slate-800 text-slate-200 border-slate-800'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-900 border-slate-300'
                            }`}
                          >
                            {/* Left Sticky Header Cell */}
                            <div className={`w-52 md:w-64 flex-none sticky left-0 z-20 border-r px-3 flex items-center justify-between ${
                              chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-slate-200 border-slate-300'
                            }`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 flex-none" /> : <ChevronDown className="w-3.5 h-3.5 flex-none" />}
                                <Icon className="w-3.5 h-3.5 flex-none" style={{ color: getDeptColor(dept) }} />
                                <span className="truncate">{DEPT_NAMES[dept]}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyText(`dept:${dept}`, getDeptSummaryText(dept));
                                  }}
                                  className="p-1 rounded hover:bg-black/30 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                                  title={`Copy ${DEPT_NAMES[dept]} Summary`}
                                >
                                  {copiedKey === `dept:${dept}` ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintHtml(`${DEPT_NAMES[dept]} Continuity Report`, getDeptSummaryHtml(dept));
                                  }}
                                  className="p-1 rounded hover:bg-black/30 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                                  title={`Print ${DEPT_NAMES[dept]} Report`}
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                  chartTheme === 'dark' ? 'bg-black/30 text-slate-300' : 'bg-slate-300 text-slate-800'
                                }`}>
                                  {displayRows.length}
                                </span>
                              </div>
                            </div>

                            {/* Right Department Header Track Banner */}
                            <div className="flex-1 px-4 flex items-center justify-between text-[11px] font-bold tracking-wider uppercase opacity-90 min-w-[500px]">
                              <span>{DEPT_NAMES[dept]} TIMELINE TRACKS</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                chartTheme === 'dark' ? 'bg-black/30 text-cyan-300' : 'bg-white/90 text-cyan-800 shadow-2xs'
                              }`}>
                                {displayRows.length} {displayRows.length === 1 ? 'Track' : 'Tracks'}
                              </span>
                            </div>
                          </div>

                          {/* Element Rows */}
                          {!isCollapsed &&
                            displayRows.map((row) => {
                              const rowKeyStr = `${dept}:${row.key}`;
                              const rowLooks = looks.filter((l) => l.dept === dept && l.rowKey === row.key);
                              const isThisRowDragging =
                                dragState?.isDragging && dragState?.dept === dept && dragState?.rowKey === row.key;
                              const isRowActive = activeWorkingRowKey === rowKeyStr;
                              const hasActiveRow = Boolean(activeWorkingRowKey);
                              const isSceneCovered = rowLooks.some((lk) => lk.fromScene <= scrubScene && lk.toScene >= scrubScene);

                              return (
                                <div
                                  key={rowKeyStr}
                                  onMouseEnter={() => setHoveredTrackKey(rowKeyStr)}
                                  onMouseLeave={() => setHoveredTrackKey((prev) => (prev === rowKeyStr ? null : prev))}
                                  className={`flex h-12 border-b relative group/track transition-all ${
                                    isRowActive
                                      ? 'bg-purple-500/10 border-y border-y-purple-500/20 z-10'
                                      : hasActiveRow
                                      ? 'opacity-85 hover:opacity-100 border-slate-800/30'
                                      : chartTheme === 'dark'
                                      ? 'border-slate-800/50 hover:bg-slate-800/30'
                                      : 'border-slate-200 hover:bg-slate-100/80'
                                  }`}
                                >
                                  {/* Left Element Name Cell: STICKY LEFT-0 Z-20 */}
                                  <div
                                    className={`w-52 md:w-64 flex-none sticky left-0 z-20 border-r flex items-center justify-between px-3 text-xs transition-all ${
                                      isRowActive
                                        ? chartTheme === 'dark'
                                          ? 'bg-[#18181b] text-purple-200 border-l-4 border-l-purple-400 border-r-slate-800 font-bold'
                                          : 'bg-purple-100 text-purple-950 border-l-4 border-l-purple-600 border-r-slate-300 font-bold'
                                        : chartTheme === 'dark'
                                        ? 'bg-[#18181b] text-slate-200 border-slate-800'
                                        : 'bg-white text-slate-900 border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {row.avatar ? (
                                        <img
                                          src={row.avatar}
                                          alt={row.label}
                                          className={`w-6 h-6 rounded-full object-cover border flex-none ${
                                            isRowActive
                                              ? chartTheme === 'dark'
                                                ? 'border-purple-300 ring-1 ring-purple-400/30'
                                                : 'border-purple-600 ring-1 ring-purple-600/30'
                                              : 'border-slate-500/40'
                                          }`}
                                        />
                                      ) : (
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-none ${
                                          isRowActive
                                            ? 'bg-purple-600 text-white'
                                            : chartTheme === 'dark'
                                            ? 'bg-slate-700/50 text-slate-300'
                                            : 'bg-slate-300 text-slate-800'
                                        }`}>
                                          {row.label[0]}
                                        </div>
                                      )}
                                      <span className="font-bold truncate text-xs">{row.label}</span>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-90">
                                      <span className={`text-[10px] font-mono font-bold ${
                                        chartTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                      }`}>
                                        {rowLooks.length} Lks
                                      </span>
                                      <button
                                        onClick={() => handleOpenModal(undefined, dept, row.label, scrubScene, scrubScene)}
                                        className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 opacity-0 group-hover/track:opacity-100 transition-opacity cursor-pointer"
                                        title="Add new look for this element"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Right Timeline Lane */}
                                  <div
                                    onMouseDown={(e) => handleTrackMouseDown(e, dept, row.key, row.label)}
                                    onMouseMove={(e) => handleTrackMouseMove(e, dept, row.key)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setContextMenu({ x: e.clientX, y: e.clientY, dept, targetName: row.label, scene: scrubScene });
                                      setContextMenuDeleteConfirm(false);
                                    }}
                                    className="flex-1 relative h-full cursor-crosshair min-w-[500px]"
                                  >
                                    {/* Scene Grid Lines */}
                                    {sceneNumbers.map((s) => {
                                      if (s < zoomMin || s > zoomMax) return null;
                                      const isInActiveSeq = selectedSequence?.scenes.includes(s);
                                      return (
                                        <div
                                          key={s}
                                          className={`absolute top-0 bottom-0 border-r pointer-events-none transition-colors ${
                                            chartTheme === 'dark' ? 'border-[#2a2e39]/30' : 'border-slate-200'
                                          }`}
                                          style={{
                                            left: `${getSceneLeftPct(s)}%`,
                                            width: `${colWidthPct}%`,
                                            backgroundColor: isInActiveSeq ? `${selectedSequence.color}15` : undefined,
                                          }}
                                        />
                                      );
                                    })}

                                    {/* HOVER SCENE TARGET BOX */}
                                    {chartHoverPos && !isThisRowDragging && !isSceneCovered && scrubScene >= zoomMin && scrubScene <= zoomMax && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenModal(undefined, dept, row.label, scrubScene, scrubScene);
                                        }}
                                        className={`absolute top-1 bottom-1 rounded border border-dashed flex items-center justify-center font-mono text-[9px] font-bold z-20 cursor-pointer transition-all opacity-0 group-hover/track:opacity-100 ${
                                          chartTheme === 'dark'
                                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/25'
                                            : 'bg-cyan-500/10 border-cyan-600/50 text-slate-900 hover:bg-cyan-500/20'
                                        }`}
                                        style={{
                                          left: `${getSceneLeftPct(scrubScene)}%`,
                                          width: `${colWidthPct}%`,
                                        }}
                                        title={`Click to Add / Edit Look for ${row.label} on SCENE ${scrubScene}`}
                                      >
                                        <span className="bg-black/60 text-cyan-300 px-1 py-0.5 rounded text-[9px] whitespace-nowrap shadow-xs pointer-events-none flex items-center gap-1 font-bold">
                                          <Plus className="w-2.5 h-2.5 text-emerald-400" />
                                          SC {scrubScene}
                                        </span>
                                      </div>
                                    )}

                                    {/* DRAG PREVIEW BOX */}
                                    {isThisRowDragging && (
                                      <div
                                        className="absolute top-1 bottom-1 bg-cyan-500/30 border-2 border-cyan-400 rounded z-20 flex items-center justify-center text-white font-mono text-xs font-bold shadow-md"
                                        style={{
                                          left: `${getSceneLeftPct(Math.min(dragState.startScene, dragState.currentScene))}%`,
                                          width: `${
                                            (Math.max(dragState.startScene, dragState.currentScene) -
                                              Math.min(dragState.startScene, dragState.currentScene) +
                                              1) *
                                            colWidthPct
                                          }%`,
                                        }}
                                      >
                                        + SC {Math.min(dragState.startScene, dragState.currentScene)} – {Math.max(dragState.startScene, dragState.currentScene)}
                                      </div>
                                    )}

                                    {/* LOOK CARDS SPANS */}
                                    {rowLooks.map((lk) => {
                                      if (lk.toScene < zoomMin || lk.fromScene > zoomMax) return null;
                                      const isSelected = selectedLookId === lk.id;
                                      const isCoveredByScrub = scrubScene >= lk.fromScene && scrubScene <= lk.toScene;
                                      const isSearchMatch = searchQuery ? matchingLookIds.has(lk.id) : false;
                                      const spanStyle = getLookSpanStyle(lk.fromScene, lk.toScene);

                                      return (
                                        <div
                                          key={lk.id}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, look: lk });
                                            setContextMenuDeleteConfirm(false);
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedLookId(lk.id);
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenModal(lk);
                                          }}
                                          className={`look-box-item absolute top-1.5 bottom-1.5 rounded-md px-2 flex items-center justify-between text-white font-mono text-xs cursor-pointer shadow-sm transition-all z-10 group/item border ${
                                            isSearchMatch
                                              ? 'ring-2 ring-cyan-400 border-white scale-[1.03] z-30 shadow-xl brightness-125'
                                              : searchQuery
                                              ? 'opacity-40 hover:opacity-100 border-white/20'
                                              : isSelected
                                              ? 'ring-2 ring-white border-white scale-[1.01] z-20 shadow-lg'
                                              : isCoveredByScrub
                                              ? 'ring-2 ring-purple-300 border-purple-200 brightness-125 z-20 shadow-md scale-[1.005]'
                                              : 'border-white/20 hover:brightness-110'
                                          }`}
                                          style={{
                                            ...spanStyle,
                                            backgroundColor: getLookColor(dept, lk.lookNumber, lk.customColor),
                                          }}
                                          title={`Click to inspect • Double click to edit • Drag ends to resize range`}
                                        >
                                          {/* Left Resize Drag Handle */}
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setResizingLook({ lookId: lk.id, edge: 'from', initialScene: lk.fromScene });
                                            }}
                                            className="resize-handle absolute left-0 top-0 bottom-0 w-2.5 bg-black/30 hover:bg-white/60 cursor-ew-resize rounded-l-md flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                                            title="Drag to resize start scene"
                                          >
                                            <GripVertical className="w-2 h-2 text-white" />
                                          </div>

                                          {/* In-Bar Content */}
                                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden px-1">
                                            {lk.imageUrl && (
                                              <img
                                                src={lk.imageUrl}
                                                alt={lk.title}
                                                className="w-5 h-5 rounded object-cover border border-white/40 flex-none"
                                              />
                                            )}
                                            <span className="font-bold text-[11px] truncate">
                                              #{lk.lookNumber}: {lk.title}
                                            </span>
                                          </div>

                                          {lk.damageLevel && lk.damageLevel !== 'None' && (
                                            <span className="text-[9px] bg-black/40 px-1 rounded text-amber-300 font-bold flex-none ml-1">
                                              ⚡{lk.damageLevel}
                                            </span>
                                          )}

                                          {/* Right Resize Drag Handle */}
                                          <div
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setResizingLook({ lookId: lk.id, edge: 'to', initialScene: lk.toScene });
                                            }}
                                            className="resize-handle absolute right-0 top-0 bottom-0 w-2.5 bg-black/30 hover:bg-white/60 cursor-ew-resize rounded-r-md flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                                            title="Drag to resize end scene"
                                          >
                                            <GripVertical className="w-2 h-2 text-white" />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'sequence' ? (
          /* SEQUENCE & LOCATION ERA MATRIX VIEW */
          <div className={`flex-1 h-full overflow-y-auto p-6 font-mono space-y-6 ${
            chartTheme === 'dark' ? 'bg-[#09090b] text-slate-100' : 'bg-slate-50 text-slate-800'
          }`}>
            {/* TOP HEADER & ACTION */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b ${
              chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-300'
            }`}>
              <div>
                <h2 className={`font-['Oswald'] font-bold text-xl uppercase tracking-wider flex items-center gap-2 ${
                  chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <Filter className="w-5 h-5 text-purple-500" />
                  <span>Sequence & Location Continuity Matrix</span>
                </h2>
                <p className="text-xs opacity-75 mt-1 max-w-3xl">
                  Group scenes that share a location, time period, or shoot day (e.g. Scenes 1, 18, 48, 49, 50 in King's Palace 3000 Years Ago). Compare character continuity side-by-side across non-consecutive scenes.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={expandAllSequences}
                  className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    chartTheme === 'dark'
                      ? 'bg-[#18181b] hover:bg-slate-800 text-slate-300 border-slate-800'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                  }`}
                  title="Expand all sequence cards"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Expand All</span>
                </button>
                <button
                  onClick={collapseAllSequences}
                  className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    chartTheme === 'dark'
                      ? 'bg-[#18181b] hover:bg-slate-800 text-slate-300 border-slate-800'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                  }`}
                  title="Collapse all sequence cards"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Collapse All</span>
                </button>
                <button
                  onClick={() => handleOpenSequenceModal()}
                  className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Sequence Block</span>
                </button>
              </div>
            </div>

            {/* SEQUENCES CARDS LIST */}
            <div className="grid grid-cols-1 gap-6">
              {sequences.map((seq) => {
                const { characterMap, discrepancies } = getSequenceContinuityStatus(seq);
                const isSelected = selectedSequenceId === seq.id;
                const isCollapsed = Boolean(collapsedSequences[seq.id]);

                return (
                  <div
                    key={seq.id}
                    className={`rounded-xl border p-5 transition-all ${
                      isCollapsed ? 'space-y-0' : 'space-y-4'
                    } ${
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-500/10'
                        : chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
                    }`}
                  >
                    {/* CARD HEADER */}
                    <div className={`flex flex-wrap items-center justify-between gap-3 ${
                      isCollapsed ? 'pb-0' : 'pb-3 border-b'
                    } ${
                      chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                    }`}>
                      <div
                        onClick={() => toggleSequenceCollapse(seq.id)}
                        className="flex items-center gap-3 cursor-pointer group/seqtitle select-none min-w-0 flex-1"
                        title="Click to toggle collapse / expand"
                      >
                        <button
                          type="button"
                          className="p-1 rounded bg-purple-500/10 hover:bg-purple-500/30 text-purple-400 transition-colors cursor-pointer"
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div
                          className="w-4 h-8 rounded-full flex-none"
                          style={{ backgroundColor: seq.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-['Oswald'] font-bold text-lg tracking-wide uppercase group-hover/seqtitle:text-purple-400 transition-colors ${
                              chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
                            }`}>
                              {seq.name}
                            </h3>
                            {seq.shootDay && (
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">
                                Shoot Day #{seq.shootDay}
                              </span>
                            )}
                            {isCollapsed && (
                              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-bold font-mono">
                                {seq.scenes.length} Scenes ({seq.scenes.join(', ')})
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-80 flex flex-wrap items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 font-semibold">
                              <MapPin className="w-3 h-3 text-purple-500" />
                              {seq.location}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-300">
                              <Clock className="w-3 h-3 text-amber-500" />
                              Era: {seq.eraOrPeriod}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* QUICK ACTIONS */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            handleSelectSequence(seq.id);
                            setActiveTab('ruler');
                          }}
                          className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          title="Filter timeline view by this sequence"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>Filter Timeline ({seq.scenes.length} Scenes)</span>
                        </button>

                        <button
                          onClick={() => handlePrintHtml(`Sequence: ${seq.name}`, getSequenceSummaryHtml(seq))}
                          className="px-2.5 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600 text-cyan-700 dark:text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-cyan-500/30"
                          title={`Print Sequence Continuity Report for ${seq.name}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => handleCopyText(`seq:${seq.id}`, getSequenceSummaryText(seq))}
                          className={`p-1.5 rounded cursor-pointer ${
                            chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="Copy Summary Text"
                        >
                          {copiedKey === `seq:${seq.id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleOpenSequenceModal(seq)}
                          className={`p-1.5 rounded cursor-pointer ${
                            chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title="Edit Sequence"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteSequence(seq.id)}
                          className="p-1.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-600 dark:text-rose-300 hover:text-white cursor-pointer"
                          title="Delete Sequence"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => toggleSequenceCollapse(seq.id)}
                          className={`p-1.5 rounded cursor-pointer border transition-colors ${
                            chartTheme === 'dark'
                              ? 'bg-[#27272a] hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                          title={isCollapsed ? 'Expand Sequence Details' : 'Collapse Sequence Details'}
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <>
                        {/* SEQUENCE CHRONOLOGY FLOW BAR & CONTROLS */}
                        <div className={`p-3 rounded-lg border space-y-2 ${
                          chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Sequence Scenes ({seq.scenes.length} Scenes):
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSortSequenceChronology(seq.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                                  chartTheme === 'dark'
                                    ? 'bg-[#27272a] hover:bg-cyan-600 text-cyan-200 border-cyan-500/20'
                                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
                                }`}
                                title="Sort scenes in ascending numerical order"
                              >
                                <span>Sort 1➔N</span>
                              </button>

                              <button
                                onClick={() => handleOpenSequenceModal(seq)}
                                className="px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600 text-purple-700 dark:text-purple-200 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors border border-purple-500/30"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit Scenes</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                            {seq.scenes.map((scNum, idx) => (
                              <React.Fragment key={`${scNum}-${idx}`}>
                                <div className={`flex items-center gap-1 border px-2.5 py-1 rounded text-xs font-mono font-bold shadow-2xs group/sc ${
                                  chartTheme === 'dark'
                                    ? 'bg-[#18181b] border-purple-500/30 text-white'
                                    : 'bg-white border-purple-300 text-slate-900'
                                }`}>
                                  <button
                                    onClick={() => {
                                      setScrubScene(scNum);
                                      setActiveTab('ruler');
                                    }}
                                    className="hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                                  >
                                    SC #{scNum}
                                  </button>
                                  <div className={`hidden group-hover/sc:flex items-center gap-0.5 ml-1 border-l pl-1 ${
                                    chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                                  }`}>
                                    {idx > 0 && (
                                      <button
                                        onClick={() => handleMoveSequenceScene(seq.id, idx, 'left')}
                                        className="p-0.5 hover:bg-purple-500 rounded text-purple-500 dark:text-purple-300 hover:text-white cursor-pointer"
                                        title="Move earlier"
                                      >
                                        <ChevronRight className="w-3 h-3 rotate-180" />
                                      </button>
                                    )}
                                    {idx < seq.scenes.length - 1 && (
                                      <button
                                        onClick={() => handleMoveSequenceScene(seq.id, idx, 'right')}
                                        className="p-0.5 hover:bg-purple-500 rounded text-purple-500 dark:text-purple-300 hover:text-white cursor-pointer"
                                        title="Move later"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {idx < seq.scenes.length - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-purple-500 flex-none opacity-80" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* DESCRIPTION */}
                        {seq.description && (
                          <p className={`text-xs italic p-2.5 rounded border ${
                            chartTheme === 'dark' ? 'bg-[#121215]/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            "{seq.description}"
                          </p>
                        )}

                        {/* CONTINUITY CHECK MATRIX ACROSS NON-CONSECUTIVE SCENES */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-cyan-500" />
                              <span>Sequence Continuity Match Matrix across Scenes {seq.scenes.join(', ')}</span>
                            </span>
                            {discrepancies.length === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 100% Sequence Aligned
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> Discrepancy Flagged
                              </span>
                            )}
                          </div>

                          {/* DISCREPANCY WARNING BANNER */}
                          {discrepancies.length > 0 && (
                            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs space-y-1">
                              <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                                <AlertTriangle className="w-4 h-4 text-rose-500 flex-none" />
                                <span>Continuity Conflict Warning in Sequence "{seq.name}":</span>
                              </div>
                              {discrepancies.map((disc, idx) => (
                                <div key={idx} className="text-[11px] opacity-90 pl-5 list-disc">
                                  • {disc}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* CHARACTER LOOKS COMPARISON ROWS */}
                          <div className="space-y-2 overflow-x-auto">
                            {trackedRows
                              .filter((row) => (!searchQuery ? true : matchingRowKeys.has(`${row.dept}:${row.key}`)))
                              .map((row) => {
                              const sceneLooks = characterMap[`${row.dept}:${row.key}`] || {};
                              return (
                                <div
                                  key={`${row.dept}:${row.key}`}
                                  className={`p-2.5 rounded border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-[140px]">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: getDeptColor(row.dept) }}
                                    />
                                    <span className={`font-bold ${chartTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                      {row.label}
                                    </span>
                                    <span className="text-[9px] opacity-60 uppercase">({row.dept})</span>
                                  </div>

                                  {/* SIDE-BY-SIDE SCENE COMPARISON CELLS */}
                                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
                                    {seq.scenes.map((scNum) => {
                                      const look = sceneLooks[scNum];
                                      return (
                                        <div
                                          key={scNum}
                                          onClick={() => {
                                            setScrubScene(scNum);
                                            if (look) setSelectedLookId(look.id);
                                            setActiveTab('ruler');
                                          }}
                                          className={`flex-1 min-w-[110px] p-1.5 rounded border text-[10px] cursor-pointer transition-all ${
                                            look
                                              ? chartTheme === 'dark'
                                                ? 'bg-[#18181b] border-cyan-500/30 hover:border-cyan-400 text-white'
                                                : 'bg-white border-cyan-400/50 hover:border-cyan-600 text-slate-900 shadow-2xs'
                                              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                                          }`}
                                        >
                                          <div className={`font-bold ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                                            SC #{scNum}
                                          </div>
                                          {look ? (
                                            <div className="font-semibold text-cyan-600 dark:text-cyan-300 truncate mt-0.5">
                                              {look.title}
                                            </div>
                                          ) : (
                                            <div className="text-rose-500 dark:text-rose-400 italic">No Look Set</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* DEPARTMENT DECK TAB VIEW */
          <div className={`flex-1 p-6 overflow-y-auto ${
            chartTheme === 'dark' ? 'bg-[#09090b] text-slate-200' : 'bg-slate-50 text-slate-900'
          }`}>
            <div className="max-w-6xl mx-auto space-y-6">
              <div className={`flex items-center justify-between pb-4 border-b ${
                chartTheme === 'dark' ? 'border-slate-700/40' : 'border-slate-200'
              }`}>
                <div>
                  <h2 className="font-['Oswald'] font-bold text-xl uppercase tracking-wider">
                    {DEPT_NAMES[activeDept]} Catalog Deck
                  </h2>
                  <p className="text-xs opacity-75">
                    Managing {currentDeptLooks.length} looks assigned across script scenes.
                  </p>
                </div>

                <button
                  onClick={() => handleOpenModal(undefined, activeDept)}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Look</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentDeptLooks.map((lk) => (
                  <div
                    key={lk.id}
                    onClick={() => setSelectedLookId(lk.id)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer space-y-3 ${
                      selectedLookId === lk.id
                        ? 'ring-2 ring-cyan-400 border-cyan-400 bg-cyan-500/10'
                        : chartTheme === 'dark' ? 'bg-[#18181b] hover:bg-slate-800 border-slate-800' : 'bg-white hover:bg-slate-100 border-slate-300 shadow-2xs'
                    }`}
                  >
                    {lk.imageUrl ? (
                      <img
                        src={lk.imageUrl}
                        alt={lk.title}
                        className={`w-full h-40 rounded object-cover border ${
                          chartTheme === 'dark' ? 'border-slate-700/40' : 'border-slate-200'
                        }`}
                      />
                    ) : (
                      <div className={`w-full h-40 rounded flex items-center justify-center font-mono text-xs ${
                        chartTheme === 'dark' ? 'bg-slate-800/50 text-slate-500' : 'bg-slate-200 text-slate-400'
                      }`}>
                        No Polaroid Photo
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] uppercase font-mono px-2 py-0.5 rounded text-white font-bold"
                          style={{ backgroundColor: getLookColor(lk.dept, lk.lookNumber, lk.customColor) }}
                        >
                          {lk.targetName} • Look #{lk.lookNumber}
                        </span>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          SC {lk.fromScene}–{lk.toScene}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm mt-1">{lk.title}</h3>
                      <p className="text-xs opacity-75 line-clamp-2 mt-1">{lk.description}</p>
                    </div>

                    <div className={`pt-2 border-t flex items-center justify-between text-xs ${
                      chartTheme === 'dark' ? 'border-slate-700/40' : 'border-slate-200'
                    }`}>
                      <span className="opacity-60 text-[11px]">Damage: {lk.damageLevel || 'None'}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(lk);
                          }}
                          className={`p-1 rounded transition-colors ${
                            chartTheme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                          }`}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLook(lk.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            chartTheme === 'dark' ? 'hover:bg-rose-900/50 text-rose-400' : 'hover:bg-rose-100 text-rose-500'
                          }`}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLLAPSIBLE INSPECTOR DRAWER */}
        {isInspectorOpen && (
          <div className={`w-80 md:w-96 flex-none border-l flex flex-col h-full overflow-y-auto p-4 z-20 transition-colors ${
            chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900 shadow-lg'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
              chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="font-['Oswald'] font-bold text-sm tracking-wider uppercase">
                  Continuity Inspector
                </span>
              </div>
              <button
                onClick={() => setIsInspectorOpen(false)}
                className={`p-1 rounded opacity-70 hover:opacity-100 ${
                  chartTheme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* INSPECTOR TAB NAVIGATION */}
            <div className={`grid grid-cols-3 p-1 rounded border mb-4 font-mono text-xs ${
              chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}>
              <button
                onClick={() => setInspectorTab('scene')}
                className={`py-1 rounded font-bold transition-all text-center cursor-pointer ${
                  inspectorTab === 'scene' ? 'bg-[#2962ff] text-white shadow-xs' : 'opacity-70 hover:opacity-100 text-slate-700 dark:text-slate-300'
                }`}
              >
                Scene #{scrubScene}
              </button>
              <button
                onClick={() => setInspectorTab('look')}
                className={`py-1 rounded font-bold transition-all text-center cursor-pointer ${
                  inspectorTab === 'look' ? 'bg-[#2962ff] text-white shadow-xs' : 'opacity-70 hover:opacity-100 text-slate-700 dark:text-slate-300'
                }`}
              >
                Selected
              </button>
              <button
                onClick={() => setInspectorTab('audit')}
                className={`py-1 rounded font-bold transition-all text-center relative cursor-pointer ${
                  inspectorTab === 'audit' ? 'bg-[#2962ff] text-white shadow-xs' : 'opacity-70 hover:opacity-100 text-slate-700 dark:text-slate-300'
                }`}
              >
                Audit
                {auditResults.conflicts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                )}
              </button>
            </div>

            {/* INSPECTOR TAB 1: ACTIVE SCENE LOOKS */}
            {inspectorTab === 'scene' && (
              <div className="space-y-3 font-mono text-xs">
                <div className={`p-3 rounded border ${
                  chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${
                    chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Scene #{scrubScene} Continuity</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyText(`scene:${scrubScene}`, getSceneSummaryText(scrubScene))}
                        className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                        title="Copy Scene Continuity Notes"
                      >
                        {copiedKey === `scene:${scrubScene}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handlePrintHtml(`Scene #${scrubScene} Continuity Sheet`, getSceneSummaryHtml(scrubScene))}
                        className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                        title="Print Scene Sheet"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] bg-[#2962ff] text-white px-2 py-0.5 rounded font-bold ml-1">
                        {activeScrubLooks.length} Looks
                      </span>
                    </div>
                  </div>

                  {activeScrubBeat && (
                    <div className="text-[11px] opacity-80 mt-2 font-sans space-y-1">
                      <div className="font-bold text-xs">{activeScrubBeat.slug?.raw || activeScrubBeat.title}</div>
                      <div className="flex items-center gap-2 opacity-75">
                        <MapPin className="w-3 h-3 text-cyan-500" />
                        <span>{activeScrubBeat.slug?.location || 'LOCATION'}</span>
                      </div>
                    </div>
                  )}

                  {activeScrubConflictDay && (
                    <div className="mt-2 bg-rose-500/15 border border-rose-500/50 text-rose-700 dark:text-rose-300 p-2 rounded text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-none" />
                      <span>Shoot Day #{activeScrubConflictDay} Conflict</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">ACTIVE LOOKS ON SET:</span>
                  {activeScrubLooks.length === 0 ? (
                    <div className="text-xs opacity-60 italic py-2 text-center border border-dashed rounded p-3">
                      No active looks logged for Scene {scrubScene}.
                    </div>
                  ) : (
                    activeScrubLooks.map((lk) => (
                      <div
                        key={lk.id}
                        onClick={() => setSelectedLookId(lk.id)}
                        onDoubleClick={() => handleOpenModal(lk)}
                        className={`p-2.5 rounded border cursor-pointer transition-all flex items-center justify-between gap-2 group ${
                          selectedLookId === lk.id
                            ? 'ring-2 ring-cyan-500 bg-cyan-500/10 border-cyan-500/50'
                            : chartTheme === 'dark' ? 'bg-[#121215] hover:bg-slate-800/80 border-slate-800' : 'bg-white hover:bg-slate-100 border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[9px] uppercase px-1.5 py-0.5 rounded text-white font-bold flex-none"
                              style={{ backgroundColor: getLookColor(lk.dept, lk.lookNumber, lk.customColor) }}
                            >
                              {DEPT_NAMES[lk.dept]} #{lk.lookNumber}
                            </span>
                            <span className="font-bold text-xs truncate">{lk.title}</span>
                          </div>
                          <div className="text-[10px] opacity-70 truncate mt-1">
                            Target: {lk.targetName} • SC {lk.fromScene}–{lk.toScene}
                          </div>
                        </div>
                        {lk.damageLevel && lk.damageLevel !== 'None' && (
                          <span className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 flex-none font-bold">
                            ⚡ {lk.damageLevel}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => handleOpenModal(undefined, activeDept, '', scrubScene, scrubScene)}
                  className="w-full mt-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Look for Scene #{scrubScene}</span>
                </button>
              </div>
            )}

            {/* INSPECTOR TAB 2: SELECTED LOOK DETAILS */}
            {inspectorTab === 'look' && (
              <div>
                {selectedLook ? (
                  <div className="space-y-4 font-mono text-xs">
                    {/* POLAROID STILL FRAME */}
                    <div className={`p-3 rounded border text-center space-y-2 ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
                    }`}>
                      {/* CARD PRINT & COPY HEADER BAR */}
                      <div className={`flex items-center justify-between pb-1.5 border-b text-[10px] ${
                        chartTheme === 'dark' ? 'border-slate-700/40' : 'border-slate-200'
                      }`}>
                        <span className="font-bold uppercase tracking-wider opacity-60">LOOK CARD #{selectedLook.lookNumber}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyText(`lookcard:${selectedLook.id}`, getLookCardText(selectedLook))}
                            className={`px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                              chartTheme === 'dark'
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title="Copy Look Card Summary"
                          >
                            {copiedKey === `lookcard:${selectedLook.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
                            <span>{copiedKey === `lookcard:${selectedLook.id}` ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintHtml(`Look Continuity Card: ${selectedLook.title}`, getLookCardHtml(selectedLook))}
                            className={`px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                              chartTheme === 'dark'
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title="Print Look Card"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const lookImages = selectedLook.images && selectedLook.images.length > 0
                          ? selectedLook.images
                          : selectedLook.imageUrl ? [selectedLook.imageUrl] : [];

                        if (lookImages.length === 0) {
                          return (
                            <div className={`w-full h-36 rounded flex flex-col items-center justify-center text-xs gap-1 border border-dashed ${
                              chartTheme === 'dark' ? 'bg-slate-800/40 text-slate-500 border-slate-700' : 'bg-slate-200/50 text-slate-500 border-slate-300'
                            }`}>
                              <Camera className="w-6 h-6 opacity-50" />
                              <span>No Polaroid Photo</span>
                            </div>
                          );
                        }

                        const activeIndex = Math.min(inspectorImgIdx, lookImages.length - 1);
                        const currentImg = lookImages[activeIndex];

                        return (
                          <div className="space-y-2">
                            <img
                              src={currentImg}
                              alt={selectedLook.title}
                              className="w-full h-44 rounded object-cover border border-slate-300 dark:border-slate-700 shadow-xs"
                            />
                            {lookImages.length > 1 && (
                              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar justify-center">
                                {lookImages.map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt={`Thumbnail ${idx + 1}`}
                                    onClick={() => setInspectorImgIdx(idx)}
                                    className={`w-9 h-9 rounded object-cover border cursor-pointer transition-all flex-none ${
                                      idx === activeIndex
                                        ? 'border-cyan-500 ring-2 ring-cyan-500/40 opacity-100 scale-105'
                                        : 'border-slate-600 opacity-60 hover:opacity-100'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between text-left pt-1">
                        <div>
                          <span
                            className="text-[9px] uppercase px-1.5 py-0.5 rounded text-white font-bold"
                            style={{ backgroundColor: getLookColor(selectedLook.dept, selectedLook.lookNumber, selectedLook.customColor) }}
                          >
                            {DEPT_NAMES[selectedLook.dept]}
                          </span>
                          <h3 className="font-bold text-sm text-cyan-600 dark:text-cyan-400 mt-1">{selectedLook.title}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] opacity-60">TARGET:</span>
                          <div className="font-bold">{selectedLook.targetName}</div>
                        </div>
                      </div>
                    </div>

                    {/* SCENE RANGE STEPPERS */}
                    <div className={`p-3 rounded border space-y-2 ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold opacity-70">SCENE SPAN COVERAGE:</span>
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">
                          SC {selectedLook.fromScene} – SC {selectedLook.toScene}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className={`flex items-center justify-between p-1.5 rounded border ${
                          chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          <span className="opacity-70">From:</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setLooks((prev) =>
                                  prev.map((l) =>
                                    l.id === selectedLook.id
                                      ? { ...l, fromScene: Math.max(sceneMin, l.fromScene - 1) }
                                      : l
                                  )
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                chartTheme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                              }`}
                            >
                              -
                            </button>
                            <span className="font-bold px-1">{selectedLook.fromScene}</span>
                            <button
                              onClick={() =>
                                setLooks((prev) =>
                                  prev.map((l) =>
                                    l.id === selectedLook.id
                                      ? { ...l, fromScene: Math.min(l.toScene, l.fromScene + 1) }
                                      : l
                                  )
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                chartTheme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className={`flex items-center justify-between p-1.5 rounded border ${
                          chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          <span className="opacity-70">To:</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setLooks((prev) =>
                                  prev.map((l) =>
                                    l.id === selectedLook.id
                                      ? { ...l, toScene: Math.max(l.fromScene, l.toScene - 1) }
                                      : l
                                  )
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                chartTheme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                              }`}
                            >
                              -
                            </button>
                            <span className="font-bold px-1">{selectedLook.toScene}</span>
                            <button
                              onClick={() =>
                                setLooks((prev) =>
                                  prev.map((l) =>
                                    l.id === selectedLook.id
                                      ? { ...l, toScene: Math.min(sceneMax, l.toScene + 1) }
                                      : l
                                  )
                                )
                              }
                              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                chartTheme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DETAILS & NOTES */}
                    <div className={`p-3 rounded border space-y-2 ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
                    }`}>
                      <div className="text-[10px] uppercase font-bold opacity-70">DESCRIPTION & DAMAGE NOTES:</div>
                      <p className="text-xs leading-relaxed opacity-90">{selectedLook.description || 'No detailed notes provided.'}</p>
                      {selectedLook.damageLevel && (
                        <div className={`pt-2 border-t flex items-center justify-between text-xs ${
                          chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                        }`}>
                          <span className="opacity-70">Damage State:</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            ⚡ {selectedLook.damageLevel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* QUICK ACTIONS */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => handleOpenModal(selectedLook)}
                        className="py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        title="Edit Look Details"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDuplicateLook(selectedLook)}
                        className={`py-1.5 rounded font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          chartTheme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        }`}
                        title="Duplicate / Clone Look"
                      >
                        <CopyIcon className="w-3 h-3" />
                        <span>Clone</span>
                      </button>
                      <button
                        onClick={() => handlePrintHtml(`Look Continuity Card: ${selectedLook.title}`, getLookCardHtml(selectedLook))}
                        className="py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        title="Print Look Card"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                      <button
                        onClick={() => handleDeleteLook(selectedLook.id)}
                        className="py-1.5 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        title="Delete Look"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 opacity-60 text-xs italic">
                    Click any look bar on the timeline to inspect details.
                  </div>
                )}
              </div>
            )}

            {/* INSPECTOR TAB 3: AUTOMATED CONTINUITY HEALTH AUDIT */}
            {inspectorTab === 'audit' && (
              <div className="space-y-4 font-mono text-xs">
                <div className={`p-3 rounded border ${
                  chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
                }`}>
                  <div className={`flex items-center justify-between border-b pb-2 ${
                    chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <span className="font-bold flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                      <ShieldCheck className="w-4 h-4" /> Health Audit
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyText('audit', getAuditSummaryText())}
                        className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                        title="Copy Audit Report Text"
                      >
                        {copiedKey === 'audit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handlePrintHtml('Continuity Health Audit Report', getAuditSummaryHtml())}
                        className="p-1 rounded hover:bg-black/20 text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
                        title="Print Audit Report"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold ml-1">
                        Auto
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-center text-xs">
                    <div className={`p-2 rounded border ${
                      chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <div className="text-lg font-bold text-rose-500">{auditResults.conflicts.length}</div>
                      <div className="text-[10px] opacity-70">Shoot Day Conflicts</div>
                    </div>
                    <div className={`p-2 rounded border ${
                      chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                      <div className="text-lg font-bold text-amber-500">{auditResults.gaps.length}</div>
                      <div className="text-[10px] opacity-70">Unassigned Gaps</div>
                    </div>
                  </div>
                </div>

                {/* CONFLICTS LIST */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">FLAGGED CONFLICTS:</span>
                  {auditResults.conflicts.length === 0 ? (
                    <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-none" />
                      <span>No shoot day sequence conflicts detected!</span>
                    </div>
                  ) : (
                    auditResults.conflicts.map((c, idx) => (
                      <div
                        key={idx}
                        onClick={() => setScrubScene(c.scene)}
                        className="p-2.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200 cursor-pointer hover:bg-rose-500/20 transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Day #{c.day} Conflict
                          </span>
                          <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded">
                            Jump to SC {c.scene}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80">{c.detail}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* GAPS LIST */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">UNASSIGNED CONTINUITY GAPS:</span>
                  {auditResults.gaps.length === 0 ? (
                    <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-none" />
                      <span>Full character continuity covered across all scenes.</span>
                    </div>
                  ) : (
                    auditResults.gaps.slice(0, 5).map((g, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setScrubScene(g.scene);
                          handleOpenModal(undefined, g.dept as any, g.character, g.scene, g.scene);
                        }}
                        className="p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 cursor-pointer hover:bg-amber-500/20 transition-all flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold">{g.character}</div>
                          <div className="text-[10px] opacity-70">SC #{g.scene} • Missing {g.dept}</div>
                        </div>
                        <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded font-bold">
                          + Assign
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT LOOK MODAL */}
      {isLookModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 border ${
            chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`font-['Oswald'] font-bold text-lg uppercase tracking-wider ${
                chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {editingLook ? 'Edit Continuity Look' : 'Create New Continuity Look'}
              </h3>
              <div className="flex items-center gap-2">
                {editingLook && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyText(`modal:${editingLook.id}`, getLookCardText(editingLook))}
                      className={`px-2 py-1 rounded text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                        chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                      title="Copy Look Summary"
                    >
                      {copiedKey === `modal:${editingLook.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      <span>{copiedKey === `modal:${editingLook.id}` ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintHtml(`Look Continuity Card: ${editingLook.title}`, getLookCardHtml(editingLook))}
                      className={`px-2 py-1 rounded text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                        chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                      title="Print Look Card"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsLookModalOpen(false)}
                  className={`p-1 rounded opacity-70 hover:opacity-100 ${
                    chartTheme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveLook} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value as any)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="costume">Costume / Wardrobe</option>
                    <option value="makeup">Makeup & SFX</option>
                    <option value="vehicle">Vehicles</option>
                    <option value="props">Props & Art</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Target Character / Item</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mara Voss"
                    value={formTargetName}
                    onChange={(e) => setFormTargetName(e.target.value)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>Look Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean Hiking Jacket"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>From Scene #</label>
                  <input
                    type="number"
                    min={sceneMin}
                    max={sceneMax}
                    value={formFromScene}
                    onChange={(e) => setFormFromScene(parseInt(e.target.value, 10) || sceneMin)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>To Scene #</label>
                  <input
                    type="number"
                    min={sceneMin}
                    max={sceneMax}
                    value={formToScene}
                    onChange={(e) => setFormToScene(parseInt(e.target.value, 10) || sceneMax)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* LOOK BADGE & TIMELINE SPAN COLOR OVERRIDE */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[10px] uppercase font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>
                    Look Badge & Timeline Color
                  </label>
                  {formCustomColor && (
                    <button
                      type="button"
                      onClick={() => setFormCustomColor('')}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer font-bold"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 p-1.5 rounded border flex-wrap ${
                  chartTheme === 'dark' ? 'bg-black/10 border-slate-800' : 'bg-slate-100 border-slate-300'
                }`}>
                  {VIBRANT_LOOK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCustomColor(c)}
                      className={`w-4 h-4 rounded-full cursor-pointer transition-transform border ${
                        formCustomColor === c
                          ? 'ring-2 ring-cyan-400 scale-125 border-white shadow-xs'
                          : 'border-white/30 hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                      title={`Set look color to ${c}`}
                    />
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="color"
                      value={formCustomColor || getLookColor(formDept, 1)}
                      onChange={(e) => setFormCustomColor(e.target.value)}
                      className="w-5 h-5 rounded border border-slate-500 cursor-pointer p-0 bg-transparent"
                      title="Custom color picker"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-[10px] uppercase font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>
                    Polaroid Photos {formImages.length > 0 ? `(${formImages.length})` : ''}
                  </label>
                  {formImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormImages([])}
                      className="text-[10px] text-rose-500 hover:underline cursor-pointer font-medium"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                <input
                  ref={photoFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handlePhotoFilesChange(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />

                {/* ATTACHED IMAGE THUMBNAILS GRID */}
                {formImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {formImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/40">
                        <img
                          src={imgUrl}
                          alt={`Polaroid attachment ${idx + 1}`}
                          className="w-full h-14 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 px-1 rounded text-white font-mono">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SUBTLE MULTI-FILE DRAG & DROP ZONE */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handlePhotoFilesChange(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => photoFileInputRef.current?.click()}
                  className={`border border-dashed rounded px-3 py-2 text-center cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    isDraggingPhoto
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : chartTheme === 'dark'
                      ? 'border-slate-800 bg-[#121215] hover:bg-[#18181b] text-slate-400'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 opacity-60 flex-none" />
                  <span className="text-xs opacity-80">
                    {formImages.length > 0 ? 'Drop more photos or click to browse' : 'Drop photos here or click to browse (multiple allowed)'}
                  </span>
                </div>

                {/* ADD URL INPUT */}
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    type="url"
                    placeholder="Or paste image URL (https://...)"
                    value={urlInputText}
                    onChange={(e) => setUrlInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (urlInputText.trim()) {
                          setFormImages((prev) => [...prev, urlInputText.trim()]);
                          setUrlInputText('');
                        }
                      }
                    }}
                    className={`flex-1 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInputText.trim()) {
                        setFormImages((prev) => [...prev, urlInputText.trim()]);
                        setUrlInputText('');
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer flex-none ${
                      chartTheme === 'dark'
                        ? 'bg-[#27272a] hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                    }`}
                  >
                    Add URL
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>Damage / Wear Level</label>
                <select
                  value={formDamage}
                  onChange={(e) => setFormDamage(e.target.value)}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="None">None (Pristine / Clean)</option>
                  <option value="Light">Light Scuffs / Dust</option>
                  <option value="Moderate">Moderate Tears / Dirt</option>
                  <option value="Severe">Severe Damage / Blood / Wet</option>
                </select>
              </div>

              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>Description & Continuity Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details regarding scuffs, tears, exact blood placement..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2962ff] border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-between gap-3 pt-3 border-t ${
                chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div>
                  {editingLook && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!modalDeleteConfirm) {
                          setModalDeleteConfirm(true);
                        } else {
                          handleDeleteLook(editingLook.id);
                          setIsLookModalOpen(false);
                          setModalDeleteConfirm(false);
                        }
                      }}
                      onMouseLeave={() => setModalDeleteConfirm(false)}
                      className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        modalDeleteConfirm
                          ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                          : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30'
                      }`}
                      title={modalDeleteConfirm ? 'Click again to confirm deletion' : 'Delete this look (requires 2 clicks)'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{modalDeleteConfirm ? 'Confirm Delete?' : 'Delete Look'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLookModalOpen(false)}
                    className={`px-4 py-2 rounded font-bold text-xs cursor-pointer ${
                      chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded bg-[#2962ff] hover:bg-blue-600 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    {editingLook ? 'Update Look' : 'Create Look'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SEQUENCE MODAL */}
      {isSequenceModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 font-mono border ${
            chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`font-['Oswald'] font-bold text-lg uppercase tracking-wider flex items-center gap-2 ${
                chartTheme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Filter className="w-5 h-5 text-purple-500" />
                <span>{editingSequence ? 'Edit Sequence Block' : 'Create Sequence Block'}</span>
              </h3>
              <button
                onClick={() => setIsSequenceModalOpen(false)}
                className={`p-1 rounded opacity-70 hover:opacity-100 ${
                  chartTheme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSequence} className="space-y-4 text-xs">
              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>Sequence Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. King's Palace (3,000 Years Ago)"
                  value={seqFormName}
                  onChange={(e) => setSeqFormName(e.target.value)}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Set / Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INT. PALACE HALL"
                    value={seqFormLoc}
                    onChange={(e) => setSeqFormLoc(e.target.value)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Era / Time Period</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3000 B.C. Ancient Dynasty"
                    value={seqFormEra}
                    onChange={(e) => setSeqFormEra(e.target.value)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>
                  Scene Numbers (Comma separated or range e.g. 1, 18, 48, 49, 50 or 10-15)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1, 18, 48, 49, 50"
                  value={seqFormScenes}
                  onChange={(e) => setSeqFormScenes(e.target.value)}
                  className={`w-full rounded px-3 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-purple-300' : 'bg-slate-50 border-slate-300 text-purple-700'
                  }`}
                />

                {/* QUICK SCENE TOOLS */}
                <div className={`flex flex-wrap items-center justify-between gap-2 mt-2 p-2 rounded border ${
                  chartTheme === 'dark' ? 'bg-[#121215] border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  <span className={`text-[10px] uppercase font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>
                    Parsed Scenes ({parseScenesInput(seqFormScenes).length}):
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseScenesInput(seqFormScenes);
                      setSeqFormScenes([...parsed].sort((a, b) => a - b).join(', '));
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors border ${
                      chartTheme === 'dark'
                        ? 'bg-[#27272a] hover:bg-slate-700 text-cyan-300 border-cyan-500/20'
                        : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
                    }`}
                  >
                    Sort Ascending (1➔N)
                  </button>
                </div>

                {/* INTERACTIVE SCENE PILLS PREVIEW */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1.5 mt-1.5">
                  {parseScenesInput(seqFormScenes).map((scNum, idx, arr) => (
                    <React.Fragment key={`${scNum}-${idx}`}>
                      <div className={`flex items-center gap-1 border px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        chartTheme === 'dark'
                          ? 'bg-[#27272a] border-purple-500/30 text-purple-200'
                          : 'bg-purple-50 border-purple-300 text-purple-900'
                      }`}>
                        <span>SC #{scNum}</span>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-purple-400 flex-none opacity-70" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Theme Tag Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={seqFormColor}
                      onChange={(e) => setSeqFormColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold">{seqFormColor}</span>
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase mb-1 font-bold ${
                    chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                  }`}>Shoot Day #</label>
                  <input
                    type="number"
                    min={1}
                    value={seqFormDay}
                    onChange={(e) => setSeqFormDay(parseInt(e.target.value, 10) || 1)}
                    className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 border ${
                      chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] uppercase mb-1 font-bold ${
                  chartTheme === 'dark' ? 'text-slate-200' : 'text-slate-600'
                }`}>Sequence Notes & Continuity Directives</label>
                <textarea
                  rows={2}
                  placeholder="Notes for makeup & wardrobe continuity on set..."
                  value={seqFormDesc}
                  onChange={(e) => setSeqFormDesc(e.target.value)}
                  className={`w-full rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 border ${
                    chartTheme === 'dark' ? 'bg-[#121215] border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-3 pt-3 border-t ${
                chartTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsSequenceModalOpen(false)}
                  className={`px-4 py-2 rounded font-bold cursor-pointer ${
                    chartTheme === 'dark' ? 'bg-[#27272a] hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-xs cursor-pointer"
                >
                  {editingSequence ? 'Update Sequence' : 'Create Sequence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TIMELINE RIGHT CLICK CONTEXT MENU */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/10"
            onClick={() => {
              setContextMenu(null);
              setContextMenuDeleteConfirm(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
              setContextMenuDeleteConfirm(false);
            }}
          />
          <div
            className={`fixed z-50 w-60 rounded-xl border p-1.5 shadow-2xl font-sans text-xs space-y-1 ${
              chartTheme === 'dark' ? 'bg-[#18181b] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-xl'
            }`}
            style={{
              left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 250 : contextMenu.x),
              top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 300 : contextMenu.y),
            }}
          >
            {contextMenu.look ? (
              <>
                <div className={`px-2.5 py-1.5 border-b font-mono text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center justify-between ${
                  chartTheme === 'dark' ? 'border-slate-700/20' : 'border-slate-200'
                }`}>
                  <span className="truncate">
                    {DEPT_NAMES[contextMenu.look.dept]} #{contextMenu.look.lookNumber}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/40"
                    style={{ backgroundColor: getLookColor(contextMenu.look.dept, contextMenu.look.lookNumber, contextMenu.look.customColor) }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedLookId(contextMenu.look!.id);
                    setIsInspectorOpen(true);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Inspect Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenModal(contextMenu.look!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cyan-600/20 hover:text-cyan-400 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Edit Look...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDuplicateLook(contextMenu.look!);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-600/20 hover:text-emerald-400 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Duplicate Look</span>
                </button>

                {/* QUICK COLOR PALETTE CHANGE */}
                <div className={`pt-1.5 pb-1 px-2.5 border-t ${
                  chartTheme === 'dark' ? 'border-slate-700/20' : 'border-slate-200'
                }`}>
                  <div className="text-[9px] uppercase font-mono font-bold text-slate-400 mb-1">Quick Color:</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {VIBRANT_LOOK_COLORS.slice(0, 8).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setLooks((prev) =>
                            prev.map((l) => (l.id === contextMenu.look!.id ? { ...l, customColor: c } : l))
                          );
                          setContextMenu(null);
                        }}
                        className="w-3.5 h-3.5 rounded-full border border-white/40 hover:scale-125 transition-transform cursor-pointer"
                        style={{ backgroundColor: c }}
                        title={`Set look color to ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div className={`pt-1 border-t ${
                  chartTheme === 'dark' ? 'border-slate-700/20' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!contextMenuDeleteConfirm) {
                        setContextMenuDeleteConfirm(true);
                      } else {
                        handleDeleteLook(contextMenu.look!.id);
                        setContextMenu(null);
                        setContextMenuDeleteConfirm(false);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 cursor-pointer font-bold transition-all ${
                      contextMenuDeleteConfirm
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'hover:bg-rose-500/20 text-rose-500'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{contextMenuDeleteConfirm ? 'Confirm Delete?' : 'Delete Look'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`px-2.5 py-1.5 border-b font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 ${
                  chartTheme === 'dark' ? 'border-slate-700/20' : 'border-slate-200'
                }`}>
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="truncate">Scene #{contextMenu.scene || scrubScene}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleOpenModal(undefined, contextMenu.dept as any, contextMenu.targetName, contextMenu.scene, contextMenu.scene);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-600/20 hover:text-emerald-400 flex items-center gap-2 cursor-pointer font-bold"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Look for {contextMenu.targetName || 'Character'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.scene !== undefined) {
                      setScrubScene(contextMenu.scene);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-cyan-600/20 hover:text-cyan-400 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Move Playhead to SC #{contextMenu.scene}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Internal Helper Copy Icon component
const Copy: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

export default ContinuityView;
