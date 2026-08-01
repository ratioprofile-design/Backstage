
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { PrintSettings, TextStyleConfig, Beat, Shot, CharacterData } from '../types';
import {
  X, Printer, FileText, Layout, Palette, ListFilter, CheckCircle2,
  Maximize, MapPin, User, Minus, Plus, Download, Loader2, Check,
  Bold, Italic, Underline, BookOpen, Image as ImageIcon, Users, Hash, PaintBucket,
  Sun, Moon, Box, ArrowRight, MoveHorizontal, MoveVertical, Sunset, Clock,
  Aperture, Lightbulb, Paintbrush, Footprints, Film, Heart, Crown, Shield, Zap, Star,
  Type, Sliders, PenTool, Stamp, Calendar, Lock, Eye, Maximize2, Minimize2, Sparkles,
  SlidersHorizontal, ShieldAlert, FileCheck, Layers, RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PrintPreviewModalProps {
  onClose: () => void;
}

// Palette
const SCENE_COLORS = [
    { label: 'White', value: '#ffffff' },
    { label: 'Light Gray', value: '#f3f4f6' },
    { label: 'Gray', value: '#9ca3af' },
    { label: 'Dark Gray', value: '#4b5563' },
    { label: 'Black', value: '#000000' },
    { label: 'Cream', value: '#fef9c3' },
    { label: 'Gold', value: '#d97706' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Red', value: '#dc2626' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Navy', value: '#1e3a8a' },
    { label: 'Purple', value: '#9333ea' },
    { label: 'Green', value: '#16a34a' },
    { label: 'Teal', value: '#0d9488' },
    { label: 'Brown', value: '#78350f' },
];

const WATERMARK_COLORS = [
  { label: 'Red', value: '#dc2626' },
  { label: 'Dark Slate', value: '#374151' },
  { label: 'Black', value: '#000000' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Royal Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7e22ce' },
  { label: 'Emerald', value: '#059669' },
];

interface PrintStyleConfig extends TextStyleConfig {
    marginLeft?: number;
    width?: number;
    marginTop?: number;
    marginBottom?: number;
}

export interface MeasuredElement {
  id: string;
  beatId: string;
  originalIndex: number;
  type: 'slugline' | 'content-element';
  slugData?: {
    prefix: string;
    location: string;
    time: string;
    text: string;
    bg: string;
    color: string;
    padding: string;
  };
  html?: string;
  elementClass?: string;
  dialogueNumber?: number;
}

interface WatermarkConfig {
  enabled: boolean;
  text: string;
  includeDate: boolean;
  includeTime: boolean;
  includeProjectName: boolean;
  includeUser: boolean;
  customDate: string;
  opacity: number;
  rotation: number;
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  color: string;
  position: 'diagonal' | 'center' | 'tiled' | 'top-header' | 'bottom-footer';
  applyToCover: boolean;
  applyToScript: boolean;
  showHeaderStamp: boolean;
  headerText: string;
  showFooterStamp: boolean;
  footerText: string;
}

const getPaperDimensions = (paperSize: 'letter' | 'a4', dpi = 96) => {
  if (paperSize === 'letter') {
    return {
      widthInches: 8.5,
      heightInches: 11.0,
      widthPx: 8.5 * dpi,
      heightPx: 11.0 * dpi,
    };
  } else {
    // A4 is 210mm x 297mm = 8.2677in x 11.6929in
    const widthInches = 210 / 25.4;
    const heightInches = 297 / 25.4;
    return {
      widthInches,
      heightInches,
      widthPx: widthInches * dpi,
      heightPx: heightInches * dpi,
    };
  }
};

const WatermarkLayer: React.FC<{ text: string; config: WatermarkConfig }> = ({ text, config }) => {
  if (!config.enabled || !text) return null;

  if (config.position === 'tiled') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-20 flex flex-wrap content-around justify-around p-6 select-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="p-6 font-mono font-bold uppercase tracking-widest text-center whitespace-nowrap"
            style={{
              color: config.color,
              opacity: config.opacity,
              transform: `rotate(${config.rotation}deg)`,
              fontSize: '15pt',
            }}
          >
            {text}
          </div>
        ))}
      </div>
    );
  }

  const fontSizeMap: Record<string, string> = {
    'xs': '12pt',
    'sm': '18pt',
    'md': '26pt',
    'lg': '36pt',
    'xl': '48pt',
    '2xl': '64pt',
    '3xl': '80pt',
  };

  const selectedFontSize = fontSizeMap[config.fontSize] || '36pt';

  if (config.position === 'top-header') {
    return (
      <div className="absolute top-4 inset-x-0 text-center pointer-events-none z-20 select-none px-6">
        <span
          className="font-mono font-bold uppercase tracking-widest px-4 py-1"
          style={{
            color: config.color,
            opacity: Math.min(1, config.opacity * 2.2),
            fontSize: selectedFontSize,
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  if (config.position === 'bottom-footer') {
    return (
      <div className="absolute bottom-4 inset-x-0 text-center pointer-events-none z-20 select-none px-6">
        <span
          className="font-mono font-bold uppercase tracking-widest px-4 py-1"
          style={{
            color: config.color,
            opacity: Math.min(1, config.opacity * 2.2),
            fontSize: selectedFontSize,
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  // Default: Center (diagonal or straight)
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden select-none p-6">
      <div
        className="font-mono font-black uppercase tracking-widest text-center whitespace-nowrap px-8 py-2 border-y-2"
        style={{
          color: config.color,
          borderColor: config.color,
          opacity: config.opacity,
          transform: `rotate(${config.rotation}deg)`,
          fontSize: selectedFontSize,
          lineHeight: 1.1,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ onClose }) => {
  const { beats, groups, scriptConfig, characterData, generatedShots, projectList, currentProjectId, currentUser } = useProject();
  const [sidebarWidth, setSidebarWidth] = useState<'standard' | 'wide' | 'extraWide'>('wide');
  const [activeTab, setActiveTab] = useState<'sections' | 'layout' | 'watermark' | 'style' | 'content'>('sections');
  const [scale, setScale] = useState(0.65);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedStyleElement, setSelectedStyleElement] = useState<string>('slugline');

  // Filter 1 & Filter 2 Extended State
  const [selectedSequences, setSelectedSequences] = useState<string[]>([]);
  const [filterVfxOnly, setFilterVfxOnly] = useState<boolean>(false);
  const [filterActionOnly, setFilterActionOnly] = useState<boolean>(false);

  const [selectedIntExt, setSelectedIntExt] = useState<string[]>([]);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string[]>([]);

  // Script is default, others disabled/coming soon
  const [sections, setSections] = useState({
      cover: true,
      characters: false,
      storyboard: false,
      script: true
  });

  const currentProjectName = projectList.find(p => p.id === currentProjectId)?.name || "Untitled Project";
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const [coverDetails, setCoverDetails] = useState({
      title: currentProjectName,
      author: currentUser || '',
      basedOn: '',
      contact: '',
      draftName: 'DRAFT 1.0',
      dateString: currentDate,
  });
  const [coverOffset, setCoverOffset] = useState(0);

  // Watermark & Date Stamp Options
  const [watermark, setWatermark] = useState<WatermarkConfig>({
      enabled: true,
      text: 'CONFIDENTIAL',
      includeDate: true,
      includeTime: false,
      includeProjectName: false,
      includeUser: false,
      customDate: '',
      opacity: 0.18,
      rotation: -35,
      fontSize: 'xl',
      color: '#dc2626',
      position: 'diagonal',
      applyToCover: true,
      applyToScript: true,
      showHeaderStamp: true,
      headerText: `${currentProjectName.toUpperCase()} — DRAFT 1.0 (${currentDate})`,
      showFooterStamp: true,
      footerText: `${currentProjectName.toUpperCase()} — PROPERTY OF ${(currentUser || 'PRODUCTION').toUpperCase()} — ALL RIGHTS RESERVED`,
  });

  // Auto-sync state for Header and Footer stamps with Script Title & Cover Details
  const [syncHeaderFooterWithTitle, setSyncHeaderFooterWithTitle] = useState(true);

  // Helper to sync Header and Footer text from coverDetails / project info
  const syncHeaderAndFooter = (
    title = coverDetails.title,
    author = coverDetails.author,
    draft = coverDetails.draftName,
    dateStr = coverDetails.dateString
  ) => {
    const tStr = (title || currentProjectName || 'UNTITLED SCRIPT').toUpperCase();
    const dStr = (draft || 'DRAFT 1.0').toUpperCase();
    const dtStr = dateStr || currentDate;
    const aStr = (author || currentUser || 'AUTHOR').toUpperCase();

    setWatermark(w => ({
      ...w,
      headerText: `${tStr} — ${dStr} (${dtStr})`,
      footerText: `${tStr} — PROPERTY OF ${aStr} — ALL RIGHTS RESERVED`,
    }));
  };

  // Keep Header and Footer synced whenever coverDetails change if auto-sync is active
  useEffect(() => {
    if (syncHeaderFooterWithTitle) {
      syncHeaderAndFooter(coverDetails.title, coverDetails.author, coverDetails.draftName, coverDetails.dateString);
    }
  }, [coverDetails, syncHeaderFooterWithTitle, currentProjectName, currentUser]);

  const resolvedWatermarkText = useMemo(() => {
    if (!watermark.enabled) return '';
    const parts: string[] = [];
    if (watermark.text) parts.push(watermark.text);
    if (watermark.includeProjectName && currentProjectName) parts.push(currentProjectName.toUpperCase());
    if (watermark.includeUser && currentUser) parts.push(`BY: ${currentUser.toUpperCase()}`);
    if (watermark.includeDate) parts.push(watermark.customDate || currentDate);
    if (watermark.includeTime) {
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      parts.push(timeStr);
    }
    return parts.join(' • ') || 'CONFIDENTIAL';
  }, [watermark, currentDate, currentProjectName, currentUser]);

  const [showDialogueNumbers, setShowDialogueNumbers] = useState(false);

  // Expanded Scene & Color Coding Options
  const [colorCoding, setColorCoding] = useState({
      enabled: false,
      highlightStyle: 'full-bar' as 'full-bar' | 'left-border' | 'badge' | 'text-color',
      // INT / EXT / INTEXT
      intBg: '#fef3c7',        // Warm Light Gold fill
      intTextColor: '#78350f', // Dark Brown text
      extBg: '#e0f2fe',        // Ice Blue fill
      extTextColor: '#075985', // Dark Navy text
      intextBg: '#f3e8ff',     // Soft Purple fill
      intextTextColor: '#6b21a8', // Dark Purple text
      // Time of Day
      dayText: '#b45309',      // Amber Gold
      dayBg: '#fef3c7',        // Soft Yellow fill
      nightText: '#312e81',    // Midnight Navy Indigo
      nightBg: '#e0e7ff',      // Soft Indigo Navy fill
      twilightText: '#c2410c', // Sunset Burnt Orange
      twilightBg: '#ffedd5',   // Peach fill
      transitionText: '#475569', // Muted Slate
      transitionBg: '#f1f5f9', // Light Slate fill
  });

  const [pages, setPages] = useState<MeasuredElement[][]>([]);
  const hiddenRef = useRef<HTMLDivElement>(null);

  // Standard Script Margins
  const [settings, setSettings] = useState<PrintSettings & { styles: Record<string, PrintStyleConfig> } & { sceneNumbersLeft: boolean, sceneNumbersRight: boolean }>(() => ({
    paperSize: 'a4',
    marginTop: 1.0,
    marginBottom: 1.0,
    marginLeft: 1.5,
    marginRight: 1.0,
    showPageNumbers: true,
    sceneNumbers: true,
    sceneNumbersLeft: true,
    sceneNumbersRight: true,
    selectedLocations: [],
    selectedCharacters: [],
    styles: {
      slugline: { ...scriptConfig.slugline, marginLeft: 0, width: 100, marginTop: scriptConfig.slugline.marginTop, marginBottom: scriptConfig.slugline.marginBottom },
      action: { ...scriptConfig.action, marginLeft: scriptConfig.action.marginLeft, width: scriptConfig.action.width, marginTop: scriptConfig.action.marginTop, marginBottom: scriptConfig.action.marginBottom },
      character: { ...scriptConfig.character, marginLeft: scriptConfig.character.marginLeft, width: scriptConfig.character.width, marginTop: scriptConfig.character.marginTop, marginBottom: scriptConfig.character.marginBottom },
      dialogue: { ...scriptConfig.dialogue, marginLeft: scriptConfig.dialogue.marginLeft, width: scriptConfig.dialogue.width, marginTop: scriptConfig.dialogue.marginTop, marginBottom: scriptConfig.dialogue.marginBottom },
      parenthetical: { ...scriptConfig.parenthetical, marginLeft: scriptConfig.parenthetical.marginLeft, width: scriptConfig.parenthetical.width, marginTop: scriptConfig.parenthetical.marginTop, marginBottom: scriptConfig.parenthetical.marginBottom },
      transition: { ...scriptConfig.transition, marginLeft: scriptConfig.transition.marginLeft, width: scriptConfig.transition.width, marginTop: scriptConfig.transition.marginTop, marginBottom: scriptConfig.transition.marginBottom }
    }
  }));

  // --- DATA PROCESSING & ADVANCED FILTERS ---
  const { allLocations, allCharacters, allSequences } = useMemo(() => {
    const locs = new Set<string>();
    const chars = new Set<string>();
    const seqs = new Set<string>();

    if (characterData) {
      Object.values(characterData).forEach((c: any) => {
        if (c?.name) chars.add(c.name.trim().toUpperCase());
      });
    }

    if (groups && groups.length > 0) {
      groups.forEach(g => {
        if (g.title) seqs.add(g.title.trim());
      });
    }

    beats.forEach(b => {
      if (b.slug?.location) locs.add(b.slug.location.trim());

      if (b.title && b.title.trim()) {
        seqs.add(b.title.trim());
      }

      if (b.content) {
        const div = document.createElement('div');
        div.innerHTML = b.content;
        div.querySelectorAll('.sc-character').forEach(el => {
          const text = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
          if (text) chars.add(text);
        });
      }

      if (b.breakdown?.cast) {
        b.breakdown.cast.forEach(c => {
          const name = typeof c === 'string' ? c : c.name;
          if (name && name.trim()) chars.add(name.trim().toUpperCase());
        });
      }
    });

    return {
      allLocations: Array.from(locs).sort(),
      allCharacters: Array.from(chars).sort(),
      allSequences: Array.from(seqs).sort(),
    };
  }, [beats, characterData, groups]);

  // Helper matchers
  const isVfxBeat = (b: Beat) => {
    if (b.breakdown?.vfx && b.breakdown.vfx.length > 0) return true;
    const fullText = `${b.title || ''} ${b.summary || ''} ${b.content || ''} ${b.slug?.location || ''}`.toLowerCase();
    const vfxKeywords = ['vfx', 'cg', 'cgi', 'greenscreen', 'green screen', 'chroma', '3d', 'visual effect', 'special effect', 'compositing', 'mocap', 'digital double'];
    return vfxKeywords.some(kw => fullText.includes(kw));
  };

  const isActionBeat = (b: Beat) => {
    if (b.breakdown?.practical && b.breakdown.practical.length > 0) return true;
    const fullText = `${b.title || ''} ${b.summary || ''} ${b.content || ''} ${b.slug?.location || ''}`.toLowerCase();
    const actionKeywords = [
      'fight', 'action', 'chase', 'combat', 'battle', 'shootout', 'gunfire', 'explosion',
      'brawl', 'stunt', 'punch', 'kick', 'attack', 'duel', 'ambush', 'war', 'firefight',
      'melee', 'sword', 'martial arts', 'wrestling', 'gun', 'weapon', 'blast'
    ];
    return actionKeywords.some(kw => fullText.includes(kw));
  };

  const getIntExtCategory = (prefix: string) => {
    const p = (prefix || '').toUpperCase().trim();
    if (p.includes('INT/EXT') || p.includes('I/E') || p.includes('INT./EXT.')) return 'INT/EXT';
    if (p.includes('INT')) return 'INT';
    if (p.includes('EXT')) return 'EXT';
    return 'OTHER';
  };

  const getTimeOfDayCategory = (time: string) => {
    const t = (time || '').toUpperCase().trim();
    if (t.includes('NIGHT') || t.includes('MIDNIGHT')) return 'NIGHT';
    if (t.includes('DAY') || t.includes('MORNING') || t.includes('AFTERNOON') || t.includes('NOON')) return 'DAY';
    if (t.includes('DUSK') || t.includes('TWILIGHT') || t.includes('DAWN') || t.includes('SUNSET') || t.includes('SUNRISE') || t.includes('EVENING')) return 'TWILIGHT';
    if (t.includes('CONTINUOUS') || t.includes('SAME') || t.includes('LATER')) return 'CONTINUOUS';
    return 'OTHER';
  };

  const filteredBeats = useMemo(() => {
    let result = [...beats].sort((a, b) => a.x - b.x);

    // 1. Locations
    if (settings.selectedLocations.length > 0) {
      result = result.filter(b => settings.selectedLocations.includes(b.slug.location.trim()));
    }

    // 2. Characters
    if (settings.selectedCharacters.length > 0) {
      result = result.filter(b => {
        const charsInScene = new Set<string>();
        if (b.content) {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          div.querySelectorAll('.sc-character').forEach(el => {
            const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
            if (name) charsInScene.add(name);
          });
        }
        if (b.breakdown?.cast) {
          b.breakdown.cast.forEach(c => {
            const name = typeof c === 'string' ? c : c.name;
            if (name) charsInScene.add(name.trim().toUpperCase());
          });
        }
        return settings.selectedCharacters.some(c => charsInScene.has(c.toUpperCase()));
      });
    }

    // 3. Sequences
    if (selectedSequences.length > 0) {
      result = result.filter(b => {
        const bTitle = (b.title || '').trim();
        if (selectedSequences.includes(bTitle)) return true;
        if (groups) {
          const matchedGroup = groups.find(g => selectedSequences.includes((g.title || '').trim()));
          if (matchedGroup && ((matchedGroup as any).beatIds?.includes(b.id) || b.color === (matchedGroup as any).color)) {
            return true;
          }
        }
        return false;
      });
    }

    // 4. CG / VFX Filter
    if (filterVfxOnly) {
      result = result.filter(b => isVfxBeat(b));
    }

    // 5. Action / Fight Filter
    if (filterActionOnly) {
      result = result.filter(b => isActionBeat(b));
    }

    // 6. INT / EXT Filter
    if (selectedIntExt.length > 0) {
      result = result.filter(b => {
        const cat = getIntExtCategory(b.slug.prefix);
        return selectedIntExt.includes(cat);
      });
    }

    // 7. DAY / NIGHT Filter
    if (selectedTimeOfDay.length > 0) {
      result = result.filter(b => {
        const cat = getTimeOfDayCategory(b.slug.time);
        return selectedTimeOfDay.includes(cat);
      });
    }

    return result;
  }, [
    beats,
    groups,
    settings.selectedLocations,
    settings.selectedCharacters,
    selectedSequences,
    filterVfxOnly,
    filterActionOnly,
    selectedIntExt,
    selectedTimeOfDay
  ]);

  const toggleLocationFilter = (loc: string) => {
    setSettings(s => ({
      ...s,
      selectedLocations: s.selectedLocations.includes(loc)
        ? s.selectedLocations.filter(l => l !== loc)
        : [...s.selectedLocations, loc]
    }));
  };

  const toggleCharacterFilter = (char: string) => {
    setSettings(s => ({
      ...s,
      selectedCharacters: s.selectedCharacters.includes(char)
        ? s.selectedCharacters.filter(c => c !== char)
        : [...s.selectedCharacters, char]
    }));
  };

  const toggleSequenceFilter = (seq: string) => {
    setSelectedSequences(prev =>
      prev.includes(seq) ? prev.filter(s => s !== seq) : [...prev, seq]
    );
  };

  const toggleIntExtFilter = (cat: string) => {
    setSelectedIntExt(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleTimeOfDayFilter = (time: string) => {
    setSelectedTimeOfDay(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const resetAllFilters = () => {
    setSettings(s => ({ ...s, selectedLocations: [], selectedCharacters: [] }));
    setSelectedSequences([]);
    setFilterVfxOnly(false);
    setFilterActionOnly(false);
    setSelectedIntExt([]);
    setSelectedTimeOfDay([]);
  };

  const activeFilterCount =
    settings.selectedLocations.length +
    settings.selectedCharacters.length +
    selectedSequences.length +
    (filterVfxOnly ? 1 : 0) +
    (filterActionOnly ? 1 : 0) +
    selectedIntExt.length +
    selectedTimeOfDay.length;

  const getSlugStyles = (prefix: string, time: string) => {
      const conf = settings.styles.slugline as any;

      let bg = conf.highlightColor || 'transparent';
      let color = conf.color || '#000000';
      let borderLeft = 'none';
      let padding = scriptConfig.slugline.paddingEnabled
          ? `${scriptConfig.slugline.paddingVertical}px ${scriptConfig.slugline.paddingHorizontal}px`
          : '0px';

      let badgeIntExt: { bg: string; color: string; text: string } | null = null;
      let badgeTimeOfDay: { bg: string; color: string; text: string } | null = null;

      if (colorCoding.enabled) {
          const p = prefix.toUpperCase().trim();
          const t = time.toUpperCase().trim();

          // 1. Identify INT / EXT / INTEXT
          let currentIntExtBg = '';
          let currentIntExtColor = '#000000';
          let intExtType = '';

          if (p.includes('INT/EXT') || p.includes('I/E') || p.includes('INT./EXT.')) {
              currentIntExtBg = colorCoding.intextBg;
              currentIntExtColor = colorCoding.intextTextColor;
              intExtType = 'INT/EXT';
          } else if (p.includes('INT')) {
              currentIntExtBg = colorCoding.intBg;
              currentIntExtColor = colorCoding.intTextColor;
              intExtType = 'INT';
          } else if (p.includes('EXT')) {
              currentIntExtBg = colorCoding.extBg;
              currentIntExtColor = colorCoding.extTextColor;
              intExtType = 'EXT';
          }

          // 2. Identify Time of Day
          let currentTimeBg = 'transparent';
          let currentTimeColor = '#000000';
          let timeType = '';

          if (t.includes('NIGHT')) {
              currentTimeColor = colorCoding.nightText;
              currentTimeBg = colorCoding.nightBg;
              timeType = 'NIGHT';
          } else if (t.includes('DAY') || t.includes('MORNING')) {
              currentTimeColor = colorCoding.dayText;
              currentTimeBg = colorCoding.dayBg;
              timeType = 'DAY';
          } else if (t.includes('DUSK') || t.includes('TWILIGHT') || t.includes('DAWN') || t.includes('SUNSET')) {
              currentTimeColor = colorCoding.twilightText;
              currentTimeBg = colorCoding.twilightBg;
              timeType = 'TWILIGHT';
          } else if (t.includes('CONTINUOUS') || t.includes('LATER') || t.includes('SAME')) {
              currentTimeColor = colorCoding.transitionText;
              currentTimeBg = colorCoding.transitionBg;
              timeType = 'TRANSITION';
          }

          // 3. Apply according to selected highlightStyle
          if (colorCoding.highlightStyle === 'full-bar') {
              bg = currentIntExtBg || currentTimeBg || '#f3f4f6';
              color = currentTimeColor || currentIntExtColor || '#000000';
              padding = '5px 12px 6px 12px';
          } else if (colorCoding.highlightStyle === 'left-border') {
              bg = currentIntExtBg ? `${currentIntExtBg}33` : '#f8fafc';
              color = currentTimeColor || '#000000';
              borderLeft = `5px solid ${currentIntExtColor || currentIntExtBg || '#f5a623'}`;
              padding = '5px 12px 6px 12px';
          } else if (colorCoding.highlightStyle === 'badge') {
              bg = 'transparent';
              color = '#000000';
              padding = '4px 0px';
              if (intExtType && currentIntExtBg) {
                  badgeIntExt = { bg: currentIntExtBg, color: currentIntExtColor, text: prefix };
              }
              if (timeType && (currentTimeBg || currentTimeColor)) {
                  badgeTimeOfDay = { bg: currentTimeBg || '#f1f5f9', color: currentTimeColor, text: time };
              }
          } else if (colorCoding.highlightStyle === 'text-color') {
              bg = 'transparent';
              color = currentTimeColor || currentIntExtColor || '#000000';
              padding = '2px 0px';
          }
      }

      return { bg: bg || 'transparent', color, borderLeft, padding, badgeIntExt, badgeTimeOfDay };
  };

  // --- CONTINUOUS ELEMENT FLATTENING ---
  const flatElements = useMemo<MeasuredElement[]>(() => {
    const items: MeasuredElement[] = [];
    let dialogueCounter = 0;

    filteredBeats.forEach((beat, originalIndex) => {
      const slugText = `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`;
      const { bg, color, borderLeft, padding, badgeIntExt, badgeTimeOfDay } = getSlugStyles(beat.slug.prefix, beat.slug.time);

      items.push({
        id: `${beat.id}-slug`,
        beatId: beat.id,
        originalIndex,
        type: 'slugline',
        slugData: {
          prefix: beat.slug.prefix,
          location: beat.slug.location,
          time: beat.slug.time,
          text: slugText,
          bg,
          color,
          padding,
        },
      });

      if (beat.content) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = beat.content;

        const children = Array.from(tempDiv.children);
        if (children.length > 0) {
          children.forEach((child, childIdx) => {
            let html = child.outerHTML;
            const elClass = child.className || '';

            if (showDialogueNumbers && child.classList.contains('sc-dialogue')) {
              dialogueCounter++;
              child.setAttribute('data-dn', dialogueCounter.toString());
              html = child.outerHTML;
            }

            items.push({
              id: `${beat.id}-el-${childIdx}`,
              beatId: beat.id,
              originalIndex,
              type: 'content-element',
              html,
              elementClass: elClass,
              dialogueNumber: child.classList.contains('sc-dialogue') ? dialogueCounter : undefined,
            });
          });
        } else if (beat.content.trim()) {
          items.push({
            id: `${beat.id}-el-0`,
            beatId: beat.id,
            originalIndex,
            type: 'content-element',
            html: `<div class="sc-action">${beat.content}</div>`,
            elementClass: 'sc-action',
          });
        }
      }
    });

    return items;
  }, [filteredBeats, settings, showDialogueNumbers, colorCoding, scriptConfig]);

  // --- SCRIPT PAGINATION EFFECT (ELEMENT-LEVEL MEASUREMENT) ---
  useEffect(() => {
    if (!hiddenRef.current) return;

    const timer = setTimeout(() => {
        if (!hiddenRef.current) return;

        const DPI = 96;
        const { heightPx } = getPaperDimensions(settings.paperSize, DPI);

        const headerOffsetPx = (watermark.showHeaderStamp && watermark.headerText) ? 28 : 0;
        const footerOffsetPx = (watermark.showFooterStamp && watermark.footerText) ? 28 : 0;

        const topPx = settings.marginTop * DPI + headerOffsetPx;
        const bottomPx = settings.marginBottom * DPI + footerOffsetPx;
        const writableHeight = heightPx - (topPx + bottomPx);

        const newPages: MeasuredElement[][] = [];
        let currentPage: MeasuredElement[] = [];
        let currentH = 0;

        const domChildren = Array.from(hiddenRef.current.children) as HTMLElement[];

        domChildren.forEach((child, index) => {
            const item = flatElements[index];
            if (!item) return;

            const style = window.getComputedStyle(child);
            const margin = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
            const h = child.offsetHeight + margin;

            let shouldBreakPage = false;

            if (currentH + h > writableHeight) {
                shouldBreakPage = true;
            } else if (item.type === 'slugline') {
                if (currentH + h + 40 > writableHeight) {
                    shouldBreakPage = true;
                }
            } else if (item.elementClass?.includes('sc-character')) {
                const nextChild = domChildren[index + 1];
                if (nextChild) {
                    const nextStyle = window.getComputedStyle(nextChild);
                    const nextMargin = (parseFloat(nextStyle.marginTop) || 0) + (parseFloat(nextStyle.marginBottom) || 0);
                    const nextH = nextChild.offsetHeight + nextMargin;
                    if (currentH + h + nextH > writableHeight) {
                        shouldBreakPage = true;
                    }
                }
            }

            if (shouldBreakPage && currentPage.length > 0) {
                newPages.push(currentPage);
                currentPage = [];
                currentH = 0;
            }

            currentPage.push(item);
            currentH += h;
        });

        if (currentPage.length > 0) newPages.push(currentPage);
        if (newPages.length === 0 && flatElements.length === 0) setPages([[]]);
        else setPages(newPages);
    }, 100);

    return () => clearTimeout(timer);
  }, [flatElements, settings, showDialogueNumbers, watermark.showHeaderStamp, watermark.headerText, watermark.showFooterStamp, watermark.footerText]);

  // --- STYLES ---
  const dynamicCss = useMemo(() => {
    // Scoped styles to prevent leaking into the main editor if rules overlap
    const genRule = (className: string, config: PrintStyleConfig) => `
      .bible-page ${className}, .print-measure-layer ${className} {
        font-weight: ${config.bold ? 'bold' : 'normal'} !important;
        font-style: ${config.italic ? 'italic' : 'normal'} !important;
        text-decoration: ${config.underline ? 'underline' : 'none'} !important;
        ${config.highlightColor ? `background-color: ${config.highlightColor} !important;` : ''}
        margin-left: ${config.marginLeft || 0}% !important;
        width: ${config.width || 100}% !important;
        margin-top: ${config.marginTop || 0}rem !important;
        margin-bottom: ${config.marginBottom || 0}rem !important;
      }
    `;
    return `
      .bible-page {
         background: white;
         color: black;
         box-shadow: 0 0 50px -10px rgba(0,0,0,0.5);
         margin-bottom: 40px;
         position: relative;
         overflow: hidden;
         box-sizing: border-box;
      }
      /* Ensure measure layer mimics page font context */
      .print-measure-layer {
         font-family: 'Courier Prime', monospace;
         font-size: 12pt;
      }

      ${genRule('.print-slugline', settings.styles.slugline)}
      ${genRule('.sc-action', settings.styles.action)}
      ${genRule('.sc-character', settings.styles.character)}
      ${genRule('.sc-dialogue', settings.styles.dialogue)}
      ${genRule('.sc-parenthetical', settings.styles.parenthetical)}
      ${genRule('.sc-transition', settings.styles.transition)}

      .sc-dialogue[data-dn] { position: relative; }
      .sc-dialogue[data-dn]::before {
          content: '(' attr(data-dn) ')';
          position: absolute;
          left: -45px;
          top: 0;
          font-family: monospace;
          font-size: 8pt;
          color: #999;
          font-weight: normal;
          text-align: right;
          width: 40px;
      }
    `;
  }, [settings]);

  useEffect(() => {
    const styleId = 'preview-dynamic-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.innerHTML = dynamicCss;
  }, [dynamicCss]);

  // --- EXPORT PDF ---
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      // 1. Wait for fonts to fully load to prevent "random" text rendering
      await document.fonts.ready;

      const { widthInches, heightInches, widthPx, heightPx } = getPaperDimensions(settings.paperSize, 96);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: settings.paperSize === 'letter' ? 'letter' : 'a4'
      });

      const pageW_in = widthInches;
      const pageH_in = heightInches;

      // Exact pixel dimensions for 96 DPI
      const pixelWidth = Math.round(widthPx);
      const pixelHeight = Math.round(heightPx);

      // 2. Create an isolated container attached to body offscreen
      const captureContainer = document.createElement('div');
      captureContainer.style.position = 'fixed';
      captureContainer.style.top = '0';
      captureContainer.style.left = '-9999px';
      captureContainer.style.width = `${pixelWidth}px`;
      captureContainer.style.height = `${pixelHeight}px`;
      captureContainer.style.pointerEvents = 'none';
      captureContainer.style.zIndex = '9999';
      captureContainer.style.backgroundColor = '#ffffff';
      // Reset any inherited text styles that might interfere
      captureContainer.style.textAlign = 'left';
      captureContainer.style.color = '#000';
      document.body.appendChild(captureContainer);

      const sourceElements = Array.from(document.querySelectorAll('.bible-page')) as HTMLElement[];

      for (let i = 0; i < sourceElements.length; i++) {
          const original = sourceElements[i];
          const clone = original.cloneNode(true) as HTMLElement;

          const compStyle = window.getComputedStyle(original);

          // 3. Reset clone container styles while strictly preserving inner page margins/padding
          clone.style.transform = 'none';
          clone.style.margin = '0';
          clone.style.boxShadow = 'none';
          clone.style.border = 'none';
          clone.style.boxSizing = 'border-box';
          clone.style.width = `${pixelWidth}px`;
          clone.style.height = `${pixelHeight}px`;
          clone.style.paddingTop = original.style.paddingTop || compStyle.paddingTop;
          clone.style.paddingBottom = original.style.paddingBottom || compStyle.paddingBottom;
          clone.style.paddingLeft = original.style.paddingLeft || compStyle.paddingLeft;
          clone.style.paddingRight = original.style.paddingRight || compStyle.paddingRight;
          clone.style.position = 'relative';
          clone.style.overflow = 'hidden';
          clone.style.backgroundColor = '#ffffff';

          // Place in container
          captureContainer.innerHTML = '';
          captureContainer.appendChild(clone);

          // 4. Short wait for layout repaint
          await new Promise(resolve => setTimeout(resolve, 60));

          // 5. Capture with html2canvas
          const canvas = await html2canvas(clone, {
              scale: 2, // 2x Scale for crisp text
              useCORS: true,
              logging: false,
              width: pixelWidth,
              height: pixelHeight,
              windowWidth: pixelWidth,
              windowHeight: pixelHeight,
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0,
              x: 0,
              y: 0,
              onclone: (clonedDoc) => {
                const sluglines = clonedDoc.querySelectorAll('.print-slugline');
                sluglines.forEach((el) => {
                  const htmlEl = el as HTMLElement;
                  htmlEl.style.display = 'flex';
                  htmlEl.style.alignItems = 'center';
                  htmlEl.style.justifyContent = 'space-between';
                  htmlEl.style.boxSizing = 'border-box';
                  htmlEl.style.lineHeight = '1';

                  const children = htmlEl.querySelectorAll('span, div');
                  children.forEach((child) => {
                    const c = child as HTMLElement;
                    c.style.display = 'inline-flex';
                    c.style.alignItems = 'center';
                    c.style.lineHeight = '1';
                  });
                });
              }
          });

          const imgData = canvas.toDataURL('image/png');

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, 0, pageW_in, pageH_in);
      }

      document.body.removeChild(captureContainer);
      pdf.save(`${currentProjectName.replace(/\s+/g, '_')}_Script.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to export PDF. Please check console.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStyle = (element: string, property: keyof TextStyleConfig) => {
    setSettings(prev => ({
      ...prev,
      styles: {
        ...prev.styles,
        [element]: { ...prev.styles[element], [property]: property === 'highlightColor' ? null : !(prev.styles[element] as any)[property] }
      }
    }));
  };

  const updateGeometry = (element: string, property: 'marginLeft' | 'width' | 'marginTop' | 'marginBottom', value: number) => {
      setSettings(prev => ({
          ...prev,
          styles: {
              ...prev.styles,
              [element]: { ...prev.styles[element], [property]: value }
          }
      }));
  };

  const toggleFilter = (type: 'loc' | 'char', value: string) => {
    setSettings(prev => {
      const list = type === 'loc' ? prev.selectedLocations : prev.selectedCharacters;
      const newList = list.includes(value) ? list.filter(i => i !== value) : [...list, value];
      return { ...prev, [type === 'loc' ? 'selectedLocations' : 'selectedCharacters']: newList };
    });
  };

  const { widthInches, heightInches, widthPx } = getPaperDimensions(settings.paperSize, 96);

  const pageStyle = {
      width: `${widthInches}in`,
      height: `${heightInches}in`,
  };

  const headerOffsetPx = (watermark.showHeaderStamp && watermark.headerText) ? 28 : 0;
  const footerOffsetPx = (watermark.showFooterStamp && watermark.footerText) ? 28 : 0;

  const scriptContentStyle = {
      paddingTop: `${settings.marginTop * 96 + headerOffsetPx}px`,
      paddingBottom: `${settings.marginBottom * 96 + footerOffsetPx}px`,
      paddingLeft: `${settings.marginLeft}in`,
      paddingRight: `${settings.marginRight}in`,
  };

  const writableWidthPx = widthPx - (settings.marginLeft + settings.marginRight) * 96;

  let globalDialogueCounter = 0;

  const processBeatContent = (html: string) => {
      if (!showDialogueNumbers) return html;

      const div = document.createElement('div');
      div.innerHTML = html;

      const dialogues = div.querySelectorAll('.sc-dialogue');
      if (dialogues.length === 0) return html;

      dialogues.forEach((el) => {
          globalDialogueCounter++;
          el.setAttribute('data-dn', globalDialogueCounter.toString());
      });

      return div.innerHTML;
  };

  const getContrastTextColor = (hex: string) => {
    if (!hex || hex === 'transparent') return '#000000';
    const clean = hex.replace('#', '');
    if (clean.length < 6) return '#000000';
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const ColorField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (c: string) => void;
  }) => (
    <div className="flex flex-col gap-1.5 bg-[#141417] p-2.5 rounded-lg border border-[#27272a] transition-all hover:border-[#3f3f46]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-sm border border-white/20 shadow-sm shrink-0"
            style={{ backgroundColor: value || 'transparent' }}
          />
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="relative flex items-center gap-1 bg-[#09090b] border border-[#333] hover:border-[#555] rounded px-1.5 py-0.5 cursor-pointer">
            <input
              type="color"
              value={value && value.startsWith('#') ? value : '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 opacity-0 absolute inset-0 cursor-pointer"
            />
            <span className="text-[9px] font-mono text-gray-400 uppercase">
              {value}
            </span>
            <Paintbrush size={10} className="text-[#f5a623]" />
          </label>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap pt-0.5">
        {SCENE_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`w-3.5 h-3.5 rounded-sm border transition-all ${
              value === c.value
                ? 'ring-2 ring-[#f5a623] scale-110 z-10 border-white'
                : 'border-gray-700 opacity-70 hover:opacity-100 hover:scale-105'
            }`}
            style={{ backgroundColor: c.value }}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );

  const TagColorCard = ({
    title,
    subtitle,
    icon: Icon,
    sampleText,
    bgColor,
    textColor,
    onBgChange,
    onTextChange,
  }: {
    title: string;
    subtitle: string;
    icon: any;
    sampleText: string;
    bgColor: string;
    textColor: string;
    onBgChange: (c: string) => void;
    onTextChange: (c: string) => void;
  }) => (
    <div className="bg-[#0e0e11] rounded-lg border border-[#222] hover:border-[#333] transition-all p-3.5 space-y-3 shadow-md">
      {/* Header with Title + Live Badge Preview */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1f1f23] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#18181c] rounded border border-[#2a2a30] text-[#f5a623]">
            <Icon size={14} />
          </div>
          <div>
            <span className="text-xs font-bold text-white uppercase block leading-none">{title}</span>
            <span className="text-[9px] text-gray-400 block mt-0.5">{subtitle}</span>
          </div>
        </div>

        {/* Live Badge Preview */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono shadow-sm flex items-center gap-1 border border-black/10"
            style={{ backgroundColor: bgColor || '#f3f4f6', color: textColor || '#000000' }}
          >
            <span>{sampleText}</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Color Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ColorField
          label="Background Fill"
          value={bgColor}
          onChange={onBgChange}
        />
        <ColorField
          label="Text / Ink Color"
          value={textColor}
          onChange={onTextChange}
        />
      </div>

      {/* Smart Quick Actions */}
      <div className="flex items-center justify-between pt-1 text-[9px] text-gray-500 font-mono">
        <button
          type="button"
          onClick={() => onTextChange(getContrastTextColor(bgColor))}
          className="px-2 py-1 bg-[#18181c] hover:bg-[#222] border border-[#2a2a30] rounded text-gray-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          title="Auto-pick black or white text for best legibility against background"
        >
          <Sparkles size={10} className="text-[#f5a623]" />
          <span>Auto-Contrast Text</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const tempBg = bgColor;
            onBgChange(textColor);
            onTextChange(tempBg);
          }}
          className="px-2 py-1 bg-[#18181c] hover:bg-[#222] border border-[#2a2a30] rounded text-gray-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          title="Swap background fill and text ink colors"
        >
          <RotateCcw size={10} />
          <span>Swap Fill & Text</span>
        </button>
      </div>
    </div>
  );

  const renderSluglineElement = (item: MeasuredElement) => {
    if (!item.slugData) return null;
    const { prefix, location, time, text } = item.slugData;
    const styles = getSlugStyles(prefix, time);
    const hasHighlight = (styles.bg && styles.bg !== 'transparent') || (styles.borderLeft && styles.borderLeft !== 'none');
    const pad = styles.padding && styles.padding !== '0px' 
      ? styles.padding 
      : (hasHighlight ? '5px 12px 6px 12px' : '4px 0px');

    return (
      <div key={item.id} className="mb-3">
        <div 
          className="print-slugline font-bold uppercase flex items-center justify-between w-full rounded"
          style={{ 
              backgroundColor: styles.bg, 
              color: styles.color, 
              borderLeft: styles.borderLeft,
              padding: pad,
              boxSizing: "border-box",
              lineHeight: "1"
          }}
        >
          <div className="flex items-center gap-2 flex-wrap text-[11pt] font-bold tracking-wide my-auto leading-none">
              {settings.sceneNumbersLeft && (
                <span className="font-mono text-[11pt] opacity-60 font-normal pr-1 inline-flex items-center leading-none">
                  {item.originalIndex + 1}.
                </span>
              )}
              {styles.badgeIntExt || styles.badgeTimeOfDay ? (
                <div className="flex items-center gap-2 flex-wrap my-auto leading-none">
                  {styles.badgeIntExt && (
                    <span 
                      className="px-2.5 py-1 rounded text-[8.5pt] font-black uppercase tracking-wider shadow-sm inline-flex items-center justify-center border border-black/10 leading-none shrink-0"
                      style={{ backgroundColor: styles.badgeIntExt.bg, color: styles.badgeIntExt.color }}
                    >
                      {styles.badgeIntExt.text}
                    </span>
                  )}
                  <span className="font-bold tracking-wide text-[11pt] inline-flex items-center leading-none">{location}</span>
                  {styles.badgeTimeOfDay && (
                    <span 
                      className="px-2.5 py-1 rounded text-[8.5pt] font-black uppercase tracking-wider shadow-sm inline-flex items-center justify-center border border-black/10 leading-none shrink-0"
                      style={{ backgroundColor: styles.badgeTimeOfDay.bg, color: styles.badgeTimeOfDay.color }}
                    >
                      {styles.badgeTimeOfDay.text}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[11pt] font-bold inline-flex items-center leading-none">{text}</span>
              )}
          </div>
          {settings.sceneNumbersRight && (
            <span className="font-mono text-[11pt] opacity-60 font-normal pl-2 my-auto inline-flex items-center leading-none">
              {item.originalIndex + 1}.
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#09090b] text-gray-100 flex font-sans animate-in fade-in duration-200">

      {/* SIDEBAR */}
      <div className={`${sidebarWidth === 'standard' ? 'w-[420px]' : sidebarWidth === 'wide' ? 'w-[520px]' : 'w-[640px]'} transition-all duration-200 flex flex-col border-r border-[#222] bg-[#0c0c0c] shadow-2xl z-20 shrink-0`}>
         <div className="h-16 flex items-center justify-between px-6 border-b border-[#222] shrink-0 bg-[#0a0a0a]">
            <h2 className="font-black text-sm uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
              <BookOpen className="text-[#f5a623]" size={18}/> Print & PDF Controls
            </h2>
            <div className="flex items-center gap-2">
              {/* Panel Size Toggle */}
              <div className="flex bg-[#1a1a1a] p-0.5 rounded border border-[#333] text-[9px] font-bold uppercase">
                <button
                  onClick={() => setSidebarWidth('standard')}
                  className={`px-2 py-1 rounded transition-colors ${sidebarWidth === 'standard' ? 'bg-[#333] text-[#f5a623]' : 'text-gray-400 hover:text-white'}`}
                  title="Standard Panel Width (420px)"
                >
                  420px
                </button>
                <button
                  onClick={() => setSidebarWidth('wide')}
                  className={`px-2 py-1 rounded transition-colors ${sidebarWidth === 'wide' ? 'bg-[#333] text-[#f5a623]' : 'text-gray-400 hover:text-white'}`}
                  title="Wide Panel Width (520px)"
                >
                  520px
                </button>
                <button
                  onClick={() => setSidebarWidth('extraWide')}
                  className={`px-2 py-1 rounded transition-colors ${sidebarWidth === 'extraWide' ? 'bg-[#333] text-[#f5a623]' : 'text-gray-400 hover:text-white'}`}
                  title="Extra Wide Full Control (640px)"
                >
                  640px
                </button>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-md transition-colors text-gray-500 hover:text-white">
                <X size={18}/>
              </button>
            </div>
         </div>

         <div className="px-6 pt-5 pb-2 bg-[#0c0c0c]">
            <div className="flex bg-[#161616] p-1 rounded-lg border border-[#222] overflow-x-auto gap-1">
               {[
                 { id: 'sections', label: 'Sections', icon: BookOpen },
                 { id: 'layout', label: 'Layout', icon: Layout },
                 { id: 'watermark', label: 'Watermark', icon: Stamp },
                 { id: 'style', label: 'Style', icon: Palette },
                 { id: 'content', label: 'Filter', icon: ListFilter }
               ].map((tab) => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 px-2.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
                 >
                    {(() => { const TabIcon = tab.icon; return <TabIcon size={13} />; })()} {tab.label}
                 </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8 bg-[#0c0c0c]">
            {activeTab === 'sections' && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                    <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-2">Document Components</div>

                    {/* Active Sections */}
                    {['cover', 'script'].map(sec => (
                        <div
                            key={sec}
                            onClick={() => setSections(s => ({...s, [sec]: !s[sec as keyof typeof s]}))}
                            className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections[sec as keyof typeof sections] ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                        >
                            <div className="flex items-center gap-3">
                                {sec === 'cover' && <BookOpen size={18} className={sections.cover ? "text-[#f5a623]" : "text-gray-500"} />}
                                {sec === 'script' && <FileText size={18} className={sections.script ? "text-[#f5a623]" : "text-gray-500"} />}
                                <div>
                                    <div className={`text-xs font-bold ${sections[sec as keyof typeof sections] ? 'text-white' : 'text-gray-400'} capitalize`}>{sec} Page</div>
                                    <div className="text-[10px] text-gray-500">Include in exported document</div>
                                </div>
                            </div>
                            {sections[sec as keyof typeof sections] && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                        </div>
                    ))}

                    {/* Cover Details Config */}
                    {sections.cover && (
                        <div className="mt-6 space-y-4 p-4 bg-[#111] rounded-lg border border-[#222]">
                            <div className="text-[11px] font-bold text-[#f5a623] uppercase tracking-wider flex items-center gap-2">
                               <FileCheck size={14} /> Cover Page Details & Metadata
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Document Title</label>
                                    <input
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none"
                                        value={coverDetails.title}
                                        onChange={e => setCoverDetails({...coverDetails, title: e.target.value})}
                                        placeholder="Project Title"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Writer(s)</label>
                                    <input
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none"
                                        value={coverDetails.author}
                                        onChange={e => setCoverDetails({...coverDetails, author: e.target.value})}
                                        placeholder="Written by..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Draft Version</label>
                                    <input
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none font-mono"
                                        value={coverDetails.draftName}
                                        onChange={e => setCoverDetails({...coverDetails, draftName: e.target.value})}
                                        placeholder="DRAFT 1.0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Cover Date</label>
                                    <input
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none"
                                        value={coverDetails.dateString}
                                        onChange={e => setCoverDetails({...coverDetails, dateString: e.target.value})}
                                        placeholder={currentDate}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Source Material</label>
                                    <input
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none"
                                        value={coverDetails.basedOn}
                                        onChange={e => setCoverDetails({...coverDetails, basedOn: e.target.value})}
                                        placeholder="Based on..."
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Contact Info / Rights</label>
                                    <textarea
                                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none h-16 resize-none"
                                        value={coverDetails.contact}
                                        onChange={e => setCoverDetails({...coverDetails, contact: e.target.value})}
                                        placeholder="Address, Phone, Email, Copyright notice..."
                                    />
                                </div>
                                <div className="col-span-2 pt-2 border-t border-[#222]">
                                    <div className="flex justify-between text-[9px] text-gray-400 uppercase font-bold mb-1">
                                        <span>Vertical Title Shift</span>
                                        <span>{coverOffset > 0 ? '+' : ''}{coverOffset}rem</span>
                                    </div>
                                    <input
                                        type="range" min="-20" max="20" step="0.5"
                                        value={coverOffset}
                                        onChange={e => setCoverOffset(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                                    />
                                </div>

                                {/* Header & Footer Stamp Auto-Sync Banner */}
                                <div className="col-span-2 mt-2 p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200 hover:text-white">
                                            <input
                                                type="checkbox"
                                                checked={syncHeaderFooterWithTitle}
                                                onChange={e => setSyncHeaderFooterWithTitle(e.target.checked)}
                                                className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                                            />
                                            <span>Auto-Sync Header & Footer Stamps</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => syncHeaderAndFooter()}
                                            className="px-2.5 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#f5a623] rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Sync header & footer stamps with current title"
                                        >
                                            <Sparkles size={11} /> Sync Stamps
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono space-y-0.5 bg-[#09090b] p-2 rounded border border-[#27272a]">
                                        <div className="truncate"><span className="text-gray-500 font-sans font-semibold">Header:</span> {watermark.headerText}</div>
                                        <div className="truncate"><span className="text-gray-500 font-sans font-semibold">Footer:</span> {watermark.footerText}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Disabled Sections */}
                    {['characters', 'storyboard'].map(sec => (
                        <div
                            key={sec}
                            className="p-4 rounded border bg-[#0a0a0a] border-[#222] flex items-center justify-between opacity-50 cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                {sec === 'characters' && <Users size={18} className="text-gray-600" />}
                                {sec === 'storyboard' && <ImageIcon size={18} className="text-gray-600" />}
                                <div>
                                    <div className="text-xs font-bold text-gray-500 capitalize">{sec}</div>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold bg-[#222] text-gray-500 px-2 py-1 rounded uppercase">Coming Soon</span>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                 {/* Paper Size */}
                 <section className="space-y-3">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                        <Layers size={14}/> Paper Size & Format
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                       <button
                         onClick={() => setSettings(s => ({...s, paperSize: 'a4'}))}
                         className={`p-3 rounded-lg border text-left transition-all ${settings.paperSize === 'a4' ? 'bg-[#f5a623]/10 border-[#f5a623] text-white' : 'bg-[#111] border-[#222] text-gray-400 hover:border-[#333]'}`}
                       >
                          <div className="text-xs font-bold uppercase mb-0.5">A4 Paper</div>
                          <div className="text-[10px] text-gray-500 font-mono">210mm × 297mm</div>
                       </button>
                       <button
                         onClick={() => setSettings(s => ({...s, paperSize: 'letter'}))}
                         className={`p-3 rounded-lg border text-left transition-all ${settings.paperSize === 'letter' ? 'bg-[#f5a623]/10 border-[#f5a623] text-white' : 'bg-[#111] border-[#222] text-gray-400 hover:border-[#333]'}`}
                       >
                          <div className="text-xs font-bold uppercase mb-0.5">US Letter</div>
                          <div className="text-[10px] text-gray-500 font-mono">8.5" × 11.0"</div>
                       </button>
                    </div>
                 </section>

                 <section className="space-y-4">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                        <Maximize size={12}/> Page Margins (Inches)
                    </label>
                    <div className="bg-[#111] p-5 rounded-lg border border-[#222]">
                       <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                           {['Top', 'Bottom', 'Left', 'Right'].map(m => (
                              <div key={m} className="flex items-center justify-between">
                                 <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{m}</span>
                                 <input
                                    type="number" step="0.1"
                                    value={(settings as any)[`margin${m}`]}
                                    onChange={e => setSettings(s => ({...s, [`margin${m}`]: parseFloat(e.target.value)}))}
                                    className="w-16 bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-xs font-mono text-white focus:border-[#f5a623] outline-none text-right"
                                 />
                              </div>
                           ))}
                       </div>
                    </div>
                 </section>

                 <section className="space-y-3">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest">Document Elements</label>
                    <div className="space-y-3">
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Show Page Numbers</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${settings.showPageNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={settings.showPageNumbers} onChange={e => setSettings(s => ({...s, showPageNumbers: e.target.checked}))} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: settings.showPageNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>

                       {/* Scene Numbers Configuration */}
                       <div className="bg-[#111] rounded border border-[#222] p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400">Scene Numbers</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSettings(s => ({...s, sceneNumbersLeft: !s.sceneNumbersLeft}))}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${settings.sceneNumbersLeft ? 'bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]' : 'bg-[#0a0a0a] border-[#333] text-gray-500'}`}
                                >
                                    Left Margin
                                </button>
                                <button
                                    onClick={() => setSettings(s => ({...s, sceneNumbersRight: !s.sceneNumbersRight}))}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${settings.sceneNumbersRight ? 'bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]' : 'bg-[#0a0a0a] border-[#333] text-gray-500'}`}
                                >
                                    Right Margin
                                </button>
                            </div>
                       </div>

                       {/* Dialogue Numbers */}
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Continuous Dialogue #</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${showDialogueNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={showDialogueNumbers} onChange={e => setShowDialogueNumbers(e.target.checked)} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: showDialogueNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>
                    </div>
                 </section>
              </div>
            )}

            {activeTab === 'watermark' && (
              <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                {/* Master Switch */}
                <div className={`p-4 rounded-lg border transition-all ${watermark.enabled ? 'bg-[#dc2626]/10 border-[#dc2626]' : 'bg-[#111] border-[#222]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${watermark.enabled ? 'bg-[#dc2626] text-white' : 'bg-[#222] text-gray-500'}`}>
                        <Stamp size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white uppercase">Security Watermark & Stamps</div>
                        <div className="text-[10px] text-gray-400">Overlay custom text, dates, and ownership</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setWatermark(w => ({ ...w, enabled: !w.enabled }))}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${watermark.enabled ? 'bg-[#dc2626] text-white' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                    >
                      {watermark.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Quick Presets</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'CONFIDENTIAL', text: 'CONFIDENTIAL' },
                      { label: 'DRAFT + DATE', text: 'DRAFT', date: true },
                      { label: 'DO NOT DISTRIBUTE', text: 'DO NOT DISTRIBUTE' },
                      { label: 'PROPERTY OF AUTHOR', text: `PROPERTY OF ${currentUser || 'WRITER'}` },
                      { label: 'FOR REVIEW ONLY', text: 'FOR REVIEW ONLY' },
                      { label: 'SAMPLE COPY', text: 'SAMPLE COPY' },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setWatermark(w => ({ ...w, enabled: true, text: p.text, includeDate: p.date ?? w.includeDate }))}
                        className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] rounded text-[10px] font-medium text-gray-300 hover:text-white transition-colors"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Text & Dynamic Variables */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Watermark Text</label>
                    <input
                      className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-xs font-mono text-white focus:border-[#f5a623] outline-none"
                      value={watermark.text}
                      onChange={e => setWatermark(w => ({ ...w, text: e.target.value }))}
                      placeholder="e.g. CONFIDENTIAL"
                    />
                  </div>

                  {/* Dynamic Flags */}
                  <div className="space-y-2 pt-2 border-t border-[#222]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">Include Dynamic Information</div>
                    
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={watermark.includeDate}
                        onChange={e => setWatermark(w => ({ ...w, includeDate: e.target.checked }))}
                        className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                      />
                      <span>Include Date ({watermark.customDate || currentDate})</span>
                    </label>

                    {watermark.includeDate && (
                      <div className="pl-6">
                        <label className="text-[9px] text-gray-500 uppercase block mb-1">Override Date String</label>
                        <input
                          className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2.5 py-1 text-xs text-white focus:border-[#f5a623] outline-none font-mono"
                          value={watermark.customDate}
                          onChange={e => setWatermark(w => ({ ...w, customDate: e.target.value }))}
                          placeholder={currentDate}
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={watermark.includeTime}
                        onChange={e => setWatermark(w => ({ ...w, includeTime: e.target.checked }))}
                        className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                      />
                      <span>Include Current Timestamp</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={watermark.includeProjectName}
                        onChange={e => setWatermark(w => ({ ...w, includeProjectName: e.target.checked }))}
                        className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                      />
                      <span>Include Project Title ({currentProjectName})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={watermark.includeUser}
                        onChange={e => setWatermark(w => ({ ...w, includeUser: e.target.checked }))}
                        className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                      />
                      <span>Include Writer / User Name ({currentUser || 'User'})</span>
                    </label>
                  </div>

                  {/* Preview Banner */}
                  <div className="p-3 bg-[#0a0a0a] rounded border border-[#222] font-mono text-[10px] text-[#f5a623] truncate">
                    <span className="text-gray-500 uppercase font-bold block mb-0.5">Compiled Watermark Output:</span>
                    {resolvedWatermarkText || '(Empty Watermark)'}
                  </div>
                </div>

                {/* Placement & Appearance */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Position & Layout</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'diagonal', label: 'Diagonal Center' },
                      { id: 'center', label: 'Flat Center' },
                      { id: 'tiled', label: 'Tiled Grid' },
                      { id: 'top-header', label: 'Top Banner' },
                      { id: 'bottom-footer', label: 'Bottom Banner' },
                    ].map(pos => (
                      <button
                        key={pos.id}
                        onClick={() => setWatermark(w => ({ ...w, position: pos.id as any, rotation: pos.id === 'center' ? 0 : pos.id === 'diagonal' ? -35 : w.rotation }))}
                        className={`p-2 rounded text-[10px] font-bold uppercase transition-all ${watermark.position === pos.id ? 'bg-[#f5a623] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  {/* Sliders */}
                  <div className="space-y-3 pt-2 border-t border-[#222]">
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Opacity</span>
                        <span>{Math.round(watermark.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0.05" max="0.60" step="0.01"
                        value={watermark.opacity}
                        onChange={e => setWatermark(w => ({ ...w, opacity: parseFloat(e.target.value) }))}
                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Rotation ({watermark.rotation}°)</span>
                        <div className="flex gap-1">
                          {[-45, -35, 0, 35, 45].map(deg => (
                            <button key={deg} onClick={() => setWatermark(w => ({ ...w, rotation: deg }))} className="px-1.5 py-0.5 bg-[#222] text-[8px] rounded hover:text-white">{deg}°</button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="range" min="-60" max="60" step="5"
                        value={watermark.rotation}
                        onChange={e => setWatermark(w => ({ ...w, rotation: parseInt(e.target.value) }))}
                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Font Size</span>
                        <span className="uppercase font-mono">{watermark.fontSize}</span>
                      </div>
                      <div className="flex gap-1">
                        {['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].map(sz => (
                          <button
                            key={sz}
                            onClick={() => setWatermark(w => ({ ...w, fontSize: sz as any }))}
                            className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-colors ${watermark.fontSize === sz ? 'bg-[#f5a623] text-black' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-gray-400 mb-2">Watermark Color</div>
                      <div className="flex gap-2">
                        {WATERMARK_COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => setWatermark(w => ({ ...w, color: c.value }))}
                            className={`w-6 h-6 rounded-full border border-gray-600 transition-transform ${watermark.color === c.value ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Target Scope */}
                  <div className="space-y-2 pt-2 border-t border-[#222]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase">Apply Watermark To</div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={watermark.applyToCover}
                          onChange={e => setWatermark(w => ({ ...w, applyToCover: e.target.checked }))}
                          className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                        />
                        <span>Cover Page</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={watermark.applyToScript}
                          onChange={e => setWatermark(w => ({ ...w, applyToScript: e.target.checked }))}
                          className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                        />
                        <span>Script Pages</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Document Header & Footer Stamps */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Header & Footer Running Stamps</div>
                    {syncHeaderFooterWithTitle && (
                      <span className="px-2 py-0.5 bg-[#f5a623]/20 border border-[#f5a623]/40 text-[#f5a623] text-[9px] font-bold uppercase rounded flex items-center gap-1">
                        <Sparkles size={10} /> Synced with Title
                      </span>
                    )}
                  </div>
                  
                  {/* Top Header Stamp */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-bold text-gray-300">Top Header Stamp</span>
                        <input
                          type="checkbox"
                          checked={watermark.showHeaderStamp}
                          onChange={e => setWatermark(w => ({ ...w, showHeaderStamp: e.target.checked }))}
                          className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => syncHeaderAndFooter()}
                        className="text-[9px] text-[#f5a623] hover:underline font-bold uppercase"
                      >
                        Re-Sync
                      </button>
                    </div>
                    {watermark.showHeaderStamp && (
                      <input
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none font-mono"
                        value={watermark.headerText}
                        onChange={e => {
                          setSyncHeaderFooterWithTitle(false);
                          setWatermark(w => ({ ...w, headerText: e.target.value }));
                        }}
                        placeholder="Header text..."
                      />
                    )}
                  </div>

                  {/* Bottom Footer Stamp */}
                  <div className="space-y-2 pt-2 border-t border-[#222]">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-bold text-gray-300">Bottom Footer Stamp</span>
                        <input
                          type="checkbox"
                          checked={watermark.showFooterStamp}
                          onChange={e => setWatermark(w => ({ ...w, showFooterStamp: e.target.checked }))}
                          className="rounded border-[#333] bg-[#0a0a0a] accent-[#f5a623]"
                        />
                      </label>
                    </div>
                    {watermark.showFooterStamp && (
                      <input
                        className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none font-mono"
                        value={watermark.footerText}
                        onChange={e => {
                          setSyncHeaderFooterWithTitle(false);
                          setWatermark(w => ({ ...w, footerText: e.target.value }));
                        }}
                        placeholder="Footer text..."
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">

                 {/* 1. TYPOGRAPHY */}
                 <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                     <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><Type size={12}/> Typography Styles</div>
                     {Object.keys(settings.styles).map((elm) => (
                         <div key={elm} className="flex items-center justify-between">
                             <span className="text-xs text-gray-300 capitalize">{elm}</span>
                             <div className="flex bg-[#222] rounded p-0.5">
                                 <button onClick={() => toggleStyle(elm, 'bold')} className={`p-1 rounded ${settings.styles[elm as any].bold ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Bold"><Bold size={12}/></button>
                                 <button onClick={() => toggleStyle(elm, 'italic')} className={`p-1 rounded ${settings.styles[elm as any].italic ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Italic"><Italic size={12}/></button>
                                 <button onClick={() => toggleStyle(elm, 'underline')} className={`p-1 rounded ${settings.styles[elm as any].underline ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Underline"><Underline size={12}/></button>
                             </div>
                         </div>
                     ))}
                 </div>

                 {/* 2. SCENE COLOR CODING & HIGHLIGHTS */}
                 <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-5">
                     <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                         <div className="flex items-center gap-2">
                             <PaintBucket size={16} className="text-[#f5a623]" />
                             <div>
                                 <span className="text-xs font-bold text-white uppercase block">Scene Colors & Highlights</span>
                                 <span className="text-[10px] text-gray-400 block">Color-code INT/EXT, Day/Night & sluglines</span>
                             </div>
                         </div>
                         <div 
                             className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${colorCoding.enabled ? 'bg-[#f5a623]' : 'bg-[#333]'}`} 
                             onClick={() => setColorCoding(c => ({...c, enabled: !c.enabled}))}
                         >
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: colorCoding.enabled ? '20px' : '4px'}} />
                         </div>
                     </div>

                     <div className={`space-y-5 transition-opacity ${colorCoding.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                         {/* Style Mode Selector */}
                         <div>
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Highlight Render Style</label>
                             <div className="grid grid-cols-2 gap-2">
                                 {[
                                     { id: 'full-bar', label: 'Full Bar Fill', desc: 'Solid filled box' },
                                     { id: 'left-border', label: 'Left Accent Line', desc: 'Bold side border' },
                                     { id: 'badge', label: 'Tag Badges', desc: 'Pill tags for tags' },
                                     { id: 'text-color', label: 'Text Color Only', desc: 'Typography tint' },
                                 ].map((mode) => (
                                     <button
                                         key={mode.id}
                                         type="button"
                                         onClick={() => setColorCoding(c => ({ ...c, highlightStyle: mode.id as any }))}
                                         className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${colorCoding.highlightStyle === mode.id ? 'bg-[#f5a623]/15 border-[#f5a623] text-white' : 'bg-[#18181b] border-[#27272a] text-gray-400 hover:border-[#3f3f46]'}`}
                                     >
                                         <div className="text-xs font-bold uppercase">{mode.label}</div>
                                         <div className="text-[9px] text-gray-500 font-mono">{mode.desc}</div>
                                     </button>
                                 ))}
                             </div>
                         </div>

                         {/* Quick Color Presets */}
                         <div>
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Quick Presets</label>
                             <div className="grid grid-cols-2 gap-2">
                                 <button
                                     type="button"
                                     onClick={() => setColorCoding(c => ({
                                         ...c,
                                         enabled: true,
                                         highlightStyle: 'full-bar',
                                         intBg: '#fef3c7', intTextColor: '#78350f',
                                         extBg: '#e0f2fe', extTextColor: '#075985',
                                         intextBg: '#f3e8ff', intextTextColor: '#6b21a8',
                                         dayText: '#b45309', dayBg: '#fef3c7',
                                         nightText: '#312e81', nightBg: '#e0e7ff',
                                         twilightText: '#c2410c', twilightBg: '#ffedd5',
                                         transitionText: '#475569', transitionBg: '#f1f5f9'
                                     }))}
                                     className="p-2 bg-[#18181b] hover:bg-[#27272a] border border-[#333] rounded text-[10px] text-gray-300 font-bold uppercase transition-colors"
                                 >
                                     Standard Production
                                 </button>
                                 <button
                                     type="button"
                                     onClick={() => setColorCoding(c => ({
                                         ...c,
                                         enabled: true,
                                         highlightStyle: 'badge',
                                         intBg: '#fef3c7', intTextColor: '#92400e',
                                         extBg: '#dbeafe', extTextColor: '#1e40af',
                                         intextBg: '#f3e8ff', intextTextColor: '#7e22ce',
                                         dayText: '#b45309', dayBg: '#fef3c7',
                                         nightText: '#1e1b4b', nightBg: '#c7d2fe',
                                         twilightText: '#ea580c', twilightBg: '#ffedd5',
                                         transitionText: '#334155', transitionBg: '#e2e8f0'
                                     }))}
                                     className="p-2 bg-[#18181b] hover:bg-[#27272a] border border-[#333] rounded text-[10px] text-gray-300 font-bold uppercase transition-colors"
                                 >
                                     Tag Pill Badges
                                 </button>
                                 <button
                                     type="button"
                                     onClick={() => setColorCoding(c => ({
                                         ...c,
                                         enabled: true,
                                         highlightStyle: 'left-border',
                                         intBg: '#fef3c7', intTextColor: '#78350f',
                                         extBg: '#e0f2fe', extTextColor: '#075985',
                                         intextBg: '#f3e8ff', intextTextColor: '#6b21a8',
                                         dayText: '#d97706', dayBg: '#fef3c7',
                                         nightText: '#4338ca', nightBg: '#e0e7ff',
                                         twilightText: '#c2410c', twilightBg: '#ffedd5',
                                         transitionText: '#475569', transitionBg: '#f1f5f9'
                                     }))}
                                     className="p-2 bg-[#18181b] hover:bg-[#27272a] border border-[#333] rounded text-[10px] text-gray-300 font-bold uppercase transition-colors"
                                 >
                                     Left Accent Line
                                 </button>
                                 <button
                                     type="button"
                                     onClick={() => setColorCoding(c => ({
                                         ...c,
                                         enabled: true,
                                         highlightStyle: 'full-bar',
                                         intBg: '#312e81', intTextColor: '#ffffff',
                                         extBg: '#1e293b', extTextColor: '#38bdf8',
                                         intextBg: '#581c87', intextTextColor: '#e9d5ff',
                                         dayText: '#f59e0b', dayBg: '#fef3c7',
                                         nightText: '#818cf8', nightBg: '#1e1b4b',
                                         twilightText: '#fb923c', twilightBg: '#7c2d12',
                                         transitionText: '#94a3b8', transitionBg: '#334155'
                                     }))}
                                     className="p-2 bg-[#18181b] hover:bg-[#27272a] border border-[#333] rounded text-[10px] text-gray-300 font-bold uppercase transition-colors"
                                 >
                                     High-Contrast Night
                                 </button>
                             </div>
                         </div>

                         {/* INT / EXT / INTEXT Colors */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-[10px] font-bold text-[#f5a623] uppercase tracking-wider">
                                 <Box size={12} /> Interior & Exterior Location Cards
                             </div>
                             <div className="space-y-3">
                                 <TagColorCard
                                     title="INT. Interior Locations"
                                     subtitle="Indoor scenes, rooms, vehicles"
                                     icon={Box}
                                     sampleText="INT. CAFETERIA"
                                     bgColor={colorCoding.intBg}
                                     textColor={colorCoding.intTextColor}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, intBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, intTextColor: c }))}
                                 />
                                 <TagColorCard
                                     title="EXT. Exterior Locations"
                                     subtitle="Outdoor, street, rooftop scenes"
                                     icon={MapPin}
                                     sampleText="EXT. ROOFTOP"
                                     bgColor={colorCoding.extBg}
                                     textColor={colorCoding.extTextColor}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, extBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, extTextColor: c }))}
                                 />
                                 <TagColorCard
                                     title="INT./EXT. Combined Locations"
                                     subtitle="Doorways, courtyards, moving cars"
                                     icon={Layers}
                                     sampleText="INT./EXT. CAR"
                                     bgColor={colorCoding.intextBg}
                                     textColor={colorCoding.intextTextColor}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, intextBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, intextTextColor: c }))}
                                 />
                             </div>
                         </div>

                         {/* Time of Day Colors */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-[10px] font-bold text-[#f5a623] uppercase tracking-wider">
                                 <Sun size={12} /> Time of Day Lighting Cards
                             </div>
                             <div className="space-y-3">
                                 <TagColorCard
                                     title="DAY Lighting"
                                     subtitle="Daytime, morning, afternoon"
                                     icon={Sun}
                                     sampleText="DAY"
                                     bgColor={colorCoding.dayBg}
                                     textColor={colorCoding.dayText}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, dayBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, dayText: c }))}
                                 />
                                 <TagColorCard
                                     title="NIGHT Lighting"
                                     subtitle="Nighttime, dark, midnight"
                                     icon={Moon}
                                     sampleText="NIGHT"
                                     bgColor={colorCoding.nightBg}
                                     textColor={colorCoding.nightText}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, nightBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, nightText: c }))}
                                 />
                                 <TagColorCard
                                     title="TWILIGHT / DAWN"
                                     subtitle="Sunset, dusk, golden hour"
                                     icon={Sunset}
                                     sampleText="TWILIGHT"
                                     bgColor={colorCoding.twilightBg}
                                     textColor={colorCoding.twilightText}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, twilightBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, twilightText: c }))}
                                 />
                                 <TagColorCard
                                     title="CONTINUOUS / TRANSITIONS"
                                     subtitle="Later, same time, moments later"
                                     icon={Clock}
                                     sampleText="CONTINUOUS"
                                     bgColor={colorCoding.transitionBg}
                                     textColor={colorCoding.transitionText}
                                     onBgChange={(c) => setColorCoding(p => ({ ...p, transitionBg: c }))}
                                     onTextChange={(c) => setColorCoding(p => ({ ...p, transitionText: c }))}
                                 />
                             </div>
                         </div>

                         {/* Live Interactive Sample Preview */}
                         <div className="space-y-2 pt-2 border-t border-[#222]">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Live Style Sample</label>
                             <div className="bg-[#18181b] p-3 rounded-lg border border-[#27272a] space-y-2 font-mono text-[10px]">
                                 {/* INT DAY Sample */}
                                 {(() => {
                                     const st = getSlugStyles("INT.", "DAY");
                                     return (
                                         <div className="p-2 rounded font-bold uppercase flex justify-between items-center" style={{ backgroundColor: st.bg, color: st.color, borderLeft: st.borderLeft, padding: st.padding }}>
                                             {st.badgeIntExt || st.badgeTimeOfDay ? (
                                                 <div className="flex items-center gap-1.5">
                                                     {st.badgeIntExt && <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: st.badgeIntExt.bg, color: st.badgeIntExt.color }}>{st.badgeIntExt.text}</span>}
                                                     <span>CAFETERIA</span>
                                                     {st.badgeTimeOfDay && <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: st.badgeTimeOfDay.bg, color: st.badgeTimeOfDay.color }}>{st.badgeTimeOfDay.text}</span>}
                                                 </div>
                                             ) : (
                                                 <span>INT. CAFETERIA - DAY</span>
                                             )}
                                             <span className="opacity-50">1.</span>
                                         </div>
                                     );
                                 })()}

                                 {/* EXT NIGHT Sample */}
                                 {(() => {
                                     const st = getSlugStyles("EXT.", "NIGHT");
                                     return (
                                         <div className="p-2 rounded font-bold uppercase flex justify-between items-center" style={{ backgroundColor: st.bg, color: st.color, borderLeft: st.borderLeft, padding: st.padding }}>
                                             {st.badgeIntExt || st.badgeTimeOfDay ? (
                                                 <div className="flex items-center gap-1.5">
                                                     {st.badgeIntExt && <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: st.badgeIntExt.bg, color: st.badgeIntExt.color }}>{st.badgeIntExt.text}</span>}
                                                     <span>ROOFTOP</span>
                                                     {st.badgeTimeOfDay && <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: st.badgeTimeOfDay.bg, color: st.badgeTimeOfDay.color }}>{st.badgeTimeOfDay.text}</span>}
                                                 </div>
                                             ) : (
                                                 <span>EXT. ROOFTOP - NIGHT</span>
                                             )}
                                             <span className="opacity-50">2.</span>
                                         </div>
                                     );
                                 })()}
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* 3. ELEMENT GEOMETRY (Margins/Layout) */}
                 <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                         <Sliders size={14} className="text-[#f5a623]" />
                         <span className="text-xs font-bold text-white uppercase">Fine-Tune Layout</span>
                    </div>

                    {/* Element Selector */}
                    <div className="flex overflow-x-auto gap-1 pb-2 border-b border-[#333] mb-4 custom-scrollbar">
                        {['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition'].map(elm => (
                            <button
                                key={elm}
                                onClick={() => setSelectedStyleElement(elm)}
                                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase whitespace-nowrap transition-colors ${selectedStyleElement === elm ? 'bg-[#f5a623] text-black' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                            >
                                {elm.substring(0, 4)}
                            </button>
                        ))}
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Left Margin (%)</span>
                                <span>{settings.styles[selectedStyleElement as any].marginLeft}%</span>
                            </div>
                            <input
                                type="range" min="0" max="80"
                                value={settings.styles[selectedStyleElement as any].marginLeft}
                                onChange={(e) => updateGeometry(selectedStyleElement, 'marginLeft', parseInt(e.target.value))}
                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Width (%)</span>
                                <span>{settings.styles[selectedStyleElement as any].width}%</span>
                            </div>
                            <input
                                type="range" min="10" max="100"
                                value={settings.styles[selectedStyleElement as any].width}
                                onChange={(e) => updateGeometry(selectedStyleElement, 'width', parseInt(e.target.value))}
                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Top (rem)</span>
                                    <span>{settings.styles[selectedStyleElement as any].marginTop}</span>
                                </div>
                                <input
                                    type="range" min="0" max="4" step="0.1"
                                    value={settings.styles[selectedStyleElement as any].marginTop}
                                    onChange={(e) => updateGeometry(selectedStyleElement, 'marginTop', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Bottom (rem)</span>
                                    <span>{settings.styles[selectedStyleElement as any].marginBottom}</span>
                                </div>
                                <input
                                    type="range" min="0" max="4" step="0.1"
                                    value={settings.styles[selectedStyleElement as any].marginBottom}
                                    onChange={(e) => updateGeometry(selectedStyleElement, 'marginBottom', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                                />
                            </div>
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                {/* Active Filters Summary Header */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListFilter size={16} className="text-[#f5a623]" />
                      <span className="text-xs font-bold text-white uppercase">Script Filter Engine</span>
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw size={11} /> Clear ({activeFilterCount})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono bg-[#09090b] px-3 py-2 rounded border border-[#222]">
                    <span className="text-gray-400">Scenes Matching Filters:</span>
                    <span className="font-bold text-[#f5a623]">{filteredBeats.length} of {beats.length} Scenes</span>
                  </div>
                </div>

                {/* FILTER GROUP 1: NARRATIVE & PRODUCTION FILTERS */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
                    <Film size={15} className="text-[#f5a623]" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase block">Filter 1 — Narrative & Production</span>
                      <span className="text-[10px] text-gray-400 block">Locations, Actors, Sequences, CG/VFX, Action</span>
                    </div>
                  </div>

                  {/* 1A. LOCATIONS */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={12} className="text-[#f5a623]" /> Locations ({allLocations.length})
                      </label>
                      {settings.selectedLocations.length > 0 && (
                        <button type="button" onClick={() => setSettings(s => ({...s, selectedLocations: []}))} className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer">Clear</button>
                      )}
                    </div>
                    <div className="max-h-36 overflow-y-auto bg-[#09090b] rounded-lg border border-[#222] p-1.5 space-y-1 custom-scrollbar">
                      {allLocations.length === 0 ? (
                        <div className="text-[10px] text-gray-500 p-2 italic text-center">No locations detected</div>
                      ) : (
                        allLocations.map(loc => (
                          <div
                            key={loc}
                            onClick={() => toggleLocationFilter(loc)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer flex items-center justify-between transition-all ${settings.selectedLocations.includes(loc) ? 'bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/40 font-bold' : 'text-gray-400 hover:bg-[#18181b] border border-transparent'}`}
                          >
                            <span className="truncate">{loc}</span>
                            {settings.selectedLocations.includes(loc) && <Check size={12} />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 1B. ACTORS / CHARACTERS */}
                  <div className="space-y-2 pt-2 border-t border-[#222]">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={12} className="text-[#f5a623]" /> Actors / Characters ({allCharacters.length})
                      </label>
                      {settings.selectedCharacters.length > 0 && (
                        <button type="button" onClick={() => setSettings(s => ({...s, selectedCharacters: []}))} className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer">Clear</button>
                      )}
                    </div>
                    <div className="max-h-36 overflow-y-auto bg-[#09090b] rounded-lg border border-[#222] p-1.5 space-y-1 custom-scrollbar">
                      {allCharacters.length === 0 ? (
                        <div className="text-[10px] text-gray-500 p-2 italic text-center">No characters detected</div>
                      ) : (
                        allCharacters.map(char => (
                          <div
                            key={char}
                            onClick={() => toggleCharacterFilter(char)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer flex items-center justify-between transition-all ${settings.selectedCharacters.includes(char) ? 'bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/40 font-bold' : 'text-gray-400 hover:bg-[#18181b] border border-transparent'}`}
                          >
                            <span className="truncate font-mono">{char}</span>
                            {settings.selectedCharacters.includes(char) && <Check size={12} />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 1C. SEQUENCES */}
                  {allSequences.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#222]">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers size={12} className="text-[#f5a623]" /> Sequences & Acts ({allSequences.length})
                        </label>
                        {selectedSequences.length > 0 && (
                          <button type="button" onClick={() => setSelectedSequences([])} className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer">Clear</button>
                        )}
                      </div>
                      <div className="max-h-32 overflow-y-auto bg-[#09090b] rounded-lg border border-[#222] p-1.5 space-y-1 custom-scrollbar">
                        {allSequences.map(seq => (
                          <div
                            key={seq}
                            onClick={() => toggleSequenceFilter(seq)}
                            className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer flex items-center justify-between transition-all ${selectedSequences.includes(seq) ? 'bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/40 font-bold' : 'text-gray-400 hover:bg-[#18181b] border border-transparent'}`}
                          >
                            <span className="truncate">{seq}</span>
                            {selectedSequences.includes(seq) && <Check size={12} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1D. CG / VFX & ACTION / FIGHT TOGGLES */}
                  <div className="space-y-2 pt-3 border-t border-[#222]">
                    <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">Production Filters</label>
                    <div className="grid grid-cols-2 gap-2">
                      {/* CG / VFX Filter */}
                      <button
                        type="button"
                        onClick={() => setFilterVfxOnly(v => !v)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${filterVfxOnly ? 'bg-purple-950/40 border-purple-500 text-purple-200' : 'bg-[#09090b] border-[#222] text-gray-400 hover:border-[#333]'}`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Sparkles size={14} className={filterVfxOnly ? "text-purple-400" : "text-gray-500"} />
                            <span>CG / VFX</span>
                          </div>
                          {filterVfxOnly && <Check size={14} className="text-purple-400" />}
                        </div>
                        <span className="text-[9px] text-gray-500">Visual FX & CGI scenes</span>
                      </button>

                      {/* Action / Fight Filter */}
                      <button
                        type="button"
                        onClick={() => setFilterActionOnly(a => !a)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${filterActionOnly ? 'bg-amber-950/40 border-amber-500 text-amber-200' : 'bg-[#09090b] border-[#222] text-gray-400 hover:border-[#333]'}`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Zap size={14} className={filterActionOnly ? "text-amber-400" : "text-gray-500"} />
                            <span>Action / Fight</span>
                          </div>
                          {filterActionOnly && <Check size={14} className="text-amber-400" />}
                        </div>
                        <span className="text-[9px] text-gray-500">Stunts, fights, chases</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* FILTER GROUP 2: ENVIRONMENT & TIME FILTERS */}
                <div className="bg-[#111] p-4 rounded-lg border border-[#222] space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#222]">
                    <Sun size={15} className="text-[#f5a623]" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase block">Filter 2 — Environment & Time</span>
                      <span className="text-[10px] text-gray-400 block">EXT/INT Setup & Time of Day</span>
                    </div>
                  </div>

                  {/* 2A. INT / EXT FILTER */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Box size={12} className="text-[#f5a623]" /> Interior / Exterior
                      </label>
                      {selectedIntExt.length > 0 && (
                        <button type="button" onClick={() => setSelectedIntExt([])} className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer">Show All</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'INT', label: 'INT.', desc: 'Interior' },
                        { id: 'EXT', label: 'EXT.', desc: 'Exterior' },
                        { id: 'INT/EXT', label: 'INT/EXT', desc: 'Both' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleIntExtFilter(opt.id)}
                          className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${selectedIntExt.includes(opt.id) ? 'bg-[#f5a623]/20 border-[#f5a623] text-white font-bold' : 'bg-[#09090b] border-[#222] text-gray-400 hover:border-[#333]'}`}
                        >
                          <div className="text-xs font-black uppercase">{opt.label}</div>
                          <div className="text-[9px] text-gray-500">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2B. DAY / NIGHT FILTER */}
                  <div className="space-y-2 pt-2 border-t border-[#222]">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Moon size={12} className="text-[#f5a623]" /> Time of Day
                      </label>
                      {selectedTimeOfDay.length > 0 && (
                        <button type="button" onClick={() => setSelectedTimeOfDay([])} className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer">Show All</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'DAY', label: 'DAY', desc: 'Daylight / Morning', icon: Sun },
                        { id: 'NIGHT', label: 'NIGHT', desc: 'Nighttime', icon: Moon },
                        { id: 'TWILIGHT', label: 'TWILIGHT / DAWN', desc: 'Dusk, Dawn, Sunset', icon: Sunset },
                        { id: 'CONTINUOUS', label: 'CONTINUOUS', desc: 'Continuous, Later', icon: Clock },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleTimeOfDayFilter(opt.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${selectedTimeOfDay.includes(opt.id) ? 'bg-[#f5a623]/20 border-[#f5a623] text-white font-bold' : 'bg-[#09090b] border-[#222] text-gray-400 hover:border-[#333]'}`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-xs font-black uppercase">{opt.label}</span>
                            {(() => { const OptIcon = opt.icon; return <OptIcon size={13} className={selectedTimeOfDay.includes(opt.id) ? "text-[#f5a623]" : "text-gray-500"} />; })()}
                          </div>
                          <span className="text-[9px] text-gray-500">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
         </div>

         <div className="p-6 border-t border-[#222] bg-[#0a0a0a] space-y-2.5">
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="w-full py-3.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:grayscale cursor-pointer"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? 'Compiling PDF...' : 'Download PDF Document'}
            </button>
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-[#18181c] hover:bg-[#222] text-gray-300 hover:text-white border border-[#2a2a30] rounded font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={14} className="text-[#f5a623]" />
              <span>Print / Save via Browser Dialog</span>
            </button>
         </div>
      </div>

      {/* PREVIEW CANVAS */}
      <div className="flex-1 bg-[#09090b] relative flex flex-col overflow-hidden">
         <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#333] rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl">
               <div className="flex items-center gap-2">
                  <button onClick={() => setScale(s => Math.max(0.25, s - 0.1))} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"><Minus size={16}/></button>
                  <span className="text-xs font-mono font-bold text-gray-300 w-10 text-center">{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"><Plus size={16}/></button>
               </div>
            </div>
         </div>

         <div id="preview-scroll-container" className="flex-1 overflow-auto flex flex-col items-center p-20 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: '100px', transition: 'transform 0.15s ease' }}>

               {/* 1. COVER PAGE */}
               {sections.cover && (
                   <div className="bible-page relative border border-gray-200" style={pageStyle}>

                       {/* Watermark Overlay */}
                       {watermark.enabled && watermark.applyToCover && (
                           <WatermarkLayer text={resolvedWatermarkText} config={watermark} />
                       )}

                       {/* Center Content - Absolute Centering for perfect alignment ignoring padding/margins of container */}
                       <div
                           className="absolute inset-0 flex flex-col justify-center items-center p-16 pointer-events-none"
                           style={{ transform: `translateY(${coverOffset}rem)` }}
                       >
                           <div className="flex flex-col items-center gap-8 pointer-events-auto text-center">
                               <div className="text-4xl font-serif font-black uppercase tracking-widest border-b-2 border-black/80 pb-3 mb-6 inline-block leading-tight max-w-full">
                                    {coverDetails.title || 'UNTITLED SCREENPLAY'}
                               </div>

                               <div className="space-y-4 text-center">
                                   <div className="text-sm font-medium text-black">Written by</div>
                                   <div className="text-lg font-bold text-black uppercase">{coverDetails.author || 'Unknown Writer'}</div>
                               </div>

                               {coverDetails.basedOn && (
                                   <div className="space-y-4 text-center">
                                       <div className="text-sm font-medium text-black">Based on</div>
                                       <div className="text-lg font-bold text-black">{coverDetails.basedOn}</div>
                                   </div>
                               )}
                           </div>
                       </div>

                       {/* Bottom Left Contact */}
                       <div className="absolute bottom-16 left-16 text-left space-y-1 text-xs font-mono text-black whitespace-pre-wrap z-10">
                           {coverDetails.contact || 'Contact Info'}
                       </div>

                       {/* Bottom Right Date/Draft */}
                       <div className="absolute bottom-16 right-16 text-right space-y-1 z-10">
                           <div className="text-xs font-bold uppercase tracking-wider">{coverDetails.dateString || currentDate}</div>
                           <div className="text-[10px] text-gray-400 font-mono">{coverDetails.draftName || 'DRAFT 1.0'}</div>
                           <div className="text-[10px] font-bold text-gray-800 uppercase bg-gray-100 px-2 py-1 rounded inline-block mt-1">SCREENPLAY</div>
                       </div>
                   </div>
               )}

               {/* 2. SCRIPT PAGES */}
                {sections.script && (
                    pages.map((pageItems, pageIndex) => (
                        <div 
                           key={`script-${pageIndex}`}
                           className="bible-page border border-gray-200 relative"
                           style={{...pageStyle, ...scriptContentStyle}}
                        >
                           {/* Watermark Overlay */}
                           {watermark.enabled && watermark.applyToScript && (
                               <WatermarkLayer text={resolvedWatermarkText} config={watermark} />
                           )}

                           {/* Top Header Stamp */}
                           {watermark.showHeaderStamp && watermark.headerText && (
                               <div className="absolute top-3.5 left-0 right-0 px-8 flex justify-between items-center text-[8.5pt] font-mono text-gray-500 uppercase pointer-events-none z-10 border-b border-gray-200/80 pb-1.5 mx-8 leading-none">
                                   <span className="truncate pr-4 leading-none">{watermark.headerText}</span>
                                   <span className="shrink-0 font-bold leading-none">{(coverDetails.title || currentProjectName).toUpperCase()}</span>
                               </div>
                           )}

                           {/* Page Numbers */}
                           {settings.showPageNumbers && (
                               <div className="absolute top-0 right-0 p-4 text-black/40 font-screenplay text-[12pt] pointer-events-none"
                                 style={{ paddingTop: `${Math.max(0.5, settings.marginTop - 0.5)}in`, paddingRight: `${settings.marginRight}in` }}
                               >
                                 {pageIndex + 1}.
                               </div>
                           )}

                           {/* Bottom Footer Stamp */}
                           {watermark.showFooterStamp && watermark.footerText && (
                               <div className="absolute bottom-3 left-0 right-0 px-8 text-center text-[7.5pt] font-mono text-gray-400 uppercase pointer-events-none z-10 border-t border-gray-100 pt-1 mx-8">
                                   {watermark.footerText}
                               </div>
                           )}

                           <div className="w-full h-full overflow-hidden text-black font-screenplay text-[12pt] leading-tight">
                             {pageItems.map((item) => {
                                if (item.type === "slugline" && item.slugData) {
                                   return renderSluglineElement(item);
                                } else {
                                   return (
                                      <div 
                                        key={item.id} 
                                        className="mb-2"
                                        dangerouslySetInnerHTML={{ __html: item.html || "" }} 
                                      />
                                   );
                                }
                             })}
                           </div>
                        </div>
                    ))
                )}
            </div>
         </div>
      </div>

      {/* HIDDEN MEASUREMENT LAYER */}
       <div 
          ref={hiddenRef}
          className="print-measure-layer absolute top-0 left-0 -z-50 invisible bg-white text-black font-screenplay text-[12pt] leading-tight print:hidden pointer-events-none"
          style={{
             width: `${writableWidthPx}px`,
             boxSizing: "border-box",
          }}
       >
           {flatElements.map((item) => {
              if (item.type === "slugline" && item.slugData) {
                 return renderSluglineElement(item);
              } else {
                 return (
                    <div 
                        key={item.id}
                        className="mb-2"
                        dangerouslySetInnerHTML={{ __html: item.html || "" }}
                    />
                 );
              }
           })}
       </div>
    </div>
  );
};

export default PrintPreviewModal;
