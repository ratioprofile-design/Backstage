
import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ScriptConfig } from '../../types';
import { 
  Save, Upload, Printer, 
  Bold, Italic, Underline, Type, 
  MoveVertical, MoveHorizontal, Settings as SettingsIcon, Eye, Check,
  Highlighter, Sliders, Keyboard, Image as ImageIcon,
  LogOut, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Layers, ArrowUp, ArrowDown, Monitor, Box, 
  Minus, Plus, FileText, ScrollText,
  MousePointer2, ALargeSmall, Globe, Video, Music,
  BoxSelect, Scan, Grid, Zap, Cloud, AlertTriangle, RefreshCw, Wand2,
  Moon, Sun, Coffee, Download, XCircle, Sparkles, Wifi, ShieldCheck, ShieldAlert,
  Key, Cpu, ListChecks, StickyNote, List, Hash, RotateCw, CheckSquare, Quote
} from 'lucide-react';
import PrintPreviewModal from '../PrintPreviewModal';
import { 
    AVAILABLE_IMAGE_MODELS, AVAILABLE_TEXT_MODELS,
    VISUAL_STYLES, NOTE_FONTS, AVAILABLE_ENGLISH_FONTS
} from '../../constants';
import { BlockEditor } from '../BlockEditor';

const TEXT_COLORS = [
  { name: 'Black', value: '#000000', class: 'bg-black' },
  { name: 'Charcoal', value: '#333333', class: 'bg-[#333]' },
  { name: 'Midnight Blue', value: '#1e3a8a', class: 'bg-blue-900' },
  { name: 'Dark Green', value: '#14532d', class: 'bg-green-900' },
  { name: 'Maroon', value: '#7f1d1d', class: 'bg-red-900' },
];

const MARKDOWN_COLORS = [
    { name: 'White', value: '#ffffff', class: 'bg-white' },
    { name: 'Gray', value: '#9ca3af', class: 'bg-gray-400' },
    { name: 'Orange', value: '#f5a623', class: 'bg-[#f5a623]' },
    { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
    { name: 'Green', value: '#22c55e', class: 'bg-green-500' },
    { name: 'Red', value: '#ef4444', class: 'bg-red-500' },
    { name: 'Purple', value: '#a855f7', class: 'bg-purple-500' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: null, class: 'bg-transparent border-dashed border-gray-500' },
  { name: 'Yellow', value: '#fef08a', class: 'bg-yellow-200' },
  { name: 'Green', value: '#bbf7d0', class: 'bg-green-200' },
  { name: 'Blue', value: '#bfdbfe', class: 'bg-blue-200' },
  { name: 'Pink', value: '#fbcfe8', class: 'bg-pink-200' },
];

const BOUND_COLORS = [
    { name: 'Slate', value: '#000000' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Orange', value: '#f5a623' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#a855f7' },
];

const PREVIEW_CONTENT = `
<div class="nl-block nl-h1">Project Notes</div>
<div class="nl-block">This is a standard <b>paragraph block</b> in the scratchpad.</div>
<div class="nl-block nl-h2">Character Ideas</div>
<div class="nl-block nl-num">Protagonist flaw: <i>arrogance</i></div>
<div class="nl-block nl-num">Antagonist motive: <i>survival</i></div>
<div class="nl-block nl-quote">This is a callout block used for quotes or emphasis.</div>
<div class="nl-block nl-check">Unchecked task</div>
<div class="nl-block nl-check nl-checked">Completed task</div>
`;

// --- HELPER COMPONENTS ---

const SidebarItem = ({ active, onClick, icon: Icon, label, desc }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
      active
        ? 'bg-[#222] border-[#f5a623] text-white shadow'
        : 'bg-[#141414] border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
    }`}
  >
    <Icon size={18} className={active ? 'text-[#f5a623]' : 'text-gray-500'} />
    <div>
      <div className="text-xs font-bold">{label}</div>
      {desc && <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{desc}</div>}
    </div>
  </button>
);