import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { Beat, SectionBreak, CausalityLane, CausalityGroup } from '../../types';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Plus, Trash2, Copy,
  Edit3, Lightbulb, ScrollText, Sparkles, ArrowLeftRight, Maximize2, Minimize2,
  Palette, Play, FolderPlus, Layers, Eye, EyeOff, Check, X
} from 'lucide-react';
import { AISceneGeneratorModal } from '../AISceneGeneratorModal';
import { ScriptRollingPreviewModal } from '../ScriptRollingPreviewModal';

interface BoardViewProps {
  onEditBeat: (id: number) => void;
}

interface ContextMenuState {
  type: 'beat' | 'canvas' | 'group';
  beatId?: number;
  groupId?: string;
  laneIdx?: number;
  canvasUnit?: number;
  x: number;
  y: number;
}

const CAUSALITY_PALETTE = [
  '#eab308', // amber gold
  '#38bdf8', // light cyan
  '#ef4444', // crimson red
  '#2563eb', // deep blue
  '#22c55e', // emerald green
  '#ec4899', // magenta pink
  '#3b5284', // slate blue
  '#172554', // deep navy
  '#8b5cf6', // purple
  '#059669', // jade
];

const DEFAULT_LANES: CausalityLane[] = [
  { id: 'ruby', label: 'RUBY ARC', color: '#1e295d', isUnused: false, collapsed: false },
  { id: 'unused', label: 'Unused', color: '#1c1d21', isUnused: true, collapsed: false },
  { id: 'main', label: 'Main Screenplay in Tamil', color: '#1c1d21', isUnused: false, collapsed: false },
];

const DEFAULT_GROUPS: CausalityGroup[] = [
  { id: 'g-unused-block', laneId: 'unused', title: 'Un used Beats', startUnit: 2.0, durationUnits: 20.0, type: 'block' },
  { id: 'g-u1', laneId: 'unused', title: 'Group', startUnit: 2.6, durationUnits: 5.0, type: 'group' },
  { id: 'g-u2', laneId: 'unused', title: 'After Effects of Reflection', startUnit: 8.2, durationUnits: 5.2, type: 'group' },
  { id: 'g-u3', laneId: 'unused', title: 'Venba The Broken Glass', startUnit: 14.0, durationUnits: 5.2, type: 'group' },
  { id: 'g-ease', laneId: 'main', title: 'Ease In', startUnit: 2.5, durationUnits: 6.5, type: 'group' },
  { id: 'g-music', laneId: 'main', title: 'A Musical Flow', startUnit: 14.0, durationUnits: 7.5, type: 'group' },
];

const CARD_HEIGHT_SOLID = 24; // Compact active beat strip
const CARD_HEIGHT_OUTLINE = 46; // Multi-line disabled beat card
const LANE_MIN_HEIGHT = 175;

export const BoardView: React.FC<BoardViewProps> = ({ onEditBeat }) => {
  const {
    beats, setBeats, updateBeat, captureSnapshot,
    connections,
    currentProjectId, projectList, appTheme, appAccentColor,
    autoGenerate5Scenes
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();
  const isLight = appTheme === 'light';

  const lanesStorageKey = `causality_lanes_${currentProjectId || 'default'}`;
  const groupsStorageKey = `causality_groups_${currentProjectId || 'default'}`;
  const breaksStorageKey = `causality_breaks_${currentProjectId || 'default'}`;

  // ─── Current Project Name ──────────────────────────────────────────
  const currentProjectName = useMemo(() => {
    const found = projectList?.find(p => p.id === currentProjectId);
    return found?.name || 'Causality Story';
  }, [projectList, currentProjectId]);

  // ─── Lanes ─────────────────────────────────────────────────────────
  const [lanes, setLanes] = useState<CausalityLane[]>(() => {
    try {
      const saved = localStorage.getItem(lanesStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_LANES;
  });

  const saveLanes = useCallback((newLanes: CausalityLane[]) => {
    setLanes(newLanes);
    try { localStorage.setItem(lanesStorageKey, JSON.stringify(newLanes)); } catch (e) {}
  }, [lanesStorageKey]);

  // ─── Groups / Blocks ────────────────────────────────────────────────
  const [groups, setGroups] = useState<CausalityGroup[]>(() => {
    try {
      const saved = localStorage.getItem(groupsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return DEFAULT_GROUPS;
  });

  const saveGroups = useCallback((newGroups: CausalityGroup[]) => {
    setGroups(newGroups);
    try { localStorage.setItem(groupsStorageKey, JSON.stringify(newGroups)); } catch (e) {}
  }, [groupsStorageKey]);

  // ─── Section Breaks (Milestones) ───────────────────────────────────
  const [sectionBreaks, setSectionBreaks] = useState<SectionBreak[]>(() => {
    try {
      const saved = localStorage.getItem(breaksStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // ─── Reload when project switches or updates ───────────────────────
  useEffect(() => {
    const reloadProjectData = () => {
      try {
        const savedLanes = localStorage.getItem(`causality_lanes_${currentProjectId || 'default'}`);
        if (savedLanes) {
          const parsed = JSON.parse(savedLanes);
          if (Array.isArray(parsed) && parsed.length > 0) setLanes(parsed);
        }
      } catch (e) {}
      try {
        const savedGroups = localStorage.getItem(`causality_groups_${currentProjectId || 'default'}`);
        if (savedGroups) {
          const parsed = JSON.parse(savedGroups);
          if (Array.isArray(parsed)) setGroups(parsed);
        }
      } catch (e) {}
      try {
        const savedBreaks = localStorage.getItem(`causality_breaks_${currentProjectId || 'default'}`);
        if (savedBreaks) {
          const parsed = JSON.parse(savedBreaks);
          if (Array.isArray(parsed)) setSectionBreaks(parsed);
        }
      } catch (e) {}
    };

    reloadProjectData();
    window.addEventListener('causality_project_updated', reloadProjectData);
    window.addEventListener('project_imported', reloadProjectData);
    return () => {
      window.removeEventListener('causality_project_updated', reloadProjectData);
      window.removeEventListener('project_imported', reloadProjectData);
    };
  }, [currentProjectId, lanesStorageKey, groupsStorageKey, breaksStorageKey]);

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [playheadPos, setPlayheadPos] = useState(1.5);
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null);
  const [selectedLaneIdx, setSelectedLaneIdx] = useState(2); // default to Main Screenplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScriptRollingOpen, setIsScriptRollingOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Inline editing
  const [editingBeatId, setEditingBeatId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'summary'>('title');
  const [editingBeatTitle, setEditingBeatTitle] = useState('');
  const [editingBeatSummary, setEditingBeatSummary] = useState('');

  // Group title editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState('');

  // Lane title editing
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editingLaneLabel, setEditingLaneLabel] = useState('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const boardScrollRef = useRef<HTMLDivElement>(null);
  const lanesContainerRef = useRef<HTMLDivElement>(null);

  // Stable memoized map to lock beat rows permanently so dragging one beat NEVER shifts another beat
  const beatRowCacheRef = useRef<Map<number, number>>(new Map());

  // Smooth dragging refs (avoiding React re-renders during mousemove)
  const isDraggingBeatRef = useRef(false);
  const beatDragDataRef = useRef<{
    beatId: number;
    startX: number;
    startY: number;
    initialStart: number;
    initialLaneIdx: number;
    initialRow: number;
    currentUnit: number;
    currentLaneIdx: number;
    currentRow: number;
    domEl: HTMLElement | null;
  } | null>(null);

  const isDraggingGroupRef = useRef(false);
  const groupDragDataRef = useRef<{
    groupId: string;
    startX: number;
    startY: number;
    initialStart: number;
    initialLaneIdx: number;
    currentUnit: number;
    currentLaneIdx: number;
    groupDomEl: HTMLElement | null;
    containedBeats: { id: number; initialStart: number; domEl: HTMLElement | null }[];
    containedGroups?: { id: string; initialStart: number; domEl: HTMLElement | null }[];
  } | null>(null);

  const isResizingGroupRef = useRef(false);
  const groupResizeDataRef = useRef<{
    groupId: string;
    startX: number;
    initialDuration: number;
    currentDuration: number;
    groupDomEl: HTMLElement | null;
  } | null>(null);

  const baseUnitPixels = 100;
  const effectivePxPerUnit = baseUnitPixels * zoomLevel;

  // Unused lane index
  const unusedLaneIndex = useMemo(() => {
    const idx = lanes.findIndex(l => l.isUnused || l.id === 'unused');
    return idx >= 0 ? idx : 1;
  }, [lanes]);

  // ─── Assign Beats to Lanes & Rows (Stable & Deterministic) ──────────
  const beatsWithLayout = useMemo(() => {
    // Sort stably so iteration is predictable
    const sorted = [...beats].sort((a, b) => {
      const aS = typeof a.startTime === 'number' ? a.startTime : a.id;
      const bS = typeof b.startTime === 'number' ? b.startTime : b.id;
      return aS - bS;
    });

    // Map of laneIdx -> map of rowIdx -> maxEndUnit
    const laneRowMap = new Map<number, Map<number, number>>();

    return sorted.map((beat) => {
      let laneIdx = typeof beat.trackIndex === 'number' && beat.trackIndex >= 0 && beat.trackIndex < lanes.length
        ? beat.trackIndex
        : (beat.isDisabled ? unusedLaneIndex : 2);

      if (beat.isDisabled && laneIdx !== unusedLaneIndex && lanes[laneIdx]?.isUnused !== true) {
        laneIdx = unusedLaneIndex;
      }

      const isUnusedLane = lanes[laneIdx]?.isUnused === true;
      const isOmittedOrDisabled = Boolean(beat.isDisabled || isUnusedLane);

      // Deterministic, PERMANENT color: NEVER changes when reordered
      const color = beat.color || CAUSALITY_PALETTE[Math.abs(beat.id) % CAUSALITY_PALETTE.length];

      const cleanTitle = (beat.title || 'Untitled Beat').trim();
      const isMultiLine = isOmittedOrDisabled && cleanTitle.length > 25;
      const minW = Math.max(90, Math.min(220, isOmittedOrDisabled ? cleanTitle.length * 6.5 + 24 : cleanTitle.length * 7.5 + 24));

      const durationUnits = typeof beat.durationPages === 'number' && beat.durationPages > 0
        ? Math.max(1.0, beat.durationPages)
        : Math.max(1.0, Math.round((minW / effectivePxPerUnit) * 10) / 10);

      // Constant fallback position keyed by project index so other beats NEVER shift when one moves
      const rawStart = typeof beat.startTime === 'number' && beat.startTime >= 0.5
        ? beat.startTime
        : (() => {
            const projectIdx = beats.findIndex(b => b.id === beat.id);
            return 2.5 + (projectIdx >= 0 ? projectIdx : 0) * 1.5;
          })();

      // Stable row assignment: If beat already has subtrackIndex or a cached row, KEEP IT!
      let assignedRow: number;
      if (typeof beat.subtrackIndex === 'number' && beat.subtrackIndex >= 0) {
        assignedRow = beat.subtrackIndex;
        beatRowCacheRef.current.set(beat.id, assignedRow);
      } else if (beatRowCacheRef.current.has(beat.id)) {
        assignedRow = beatRowCacheRef.current.get(beat.id)!;
      } else {
        // First time seeing this beat: find first available row that doesn't collide
        const rowEnds = laneRowMap.get(laneIdx) || new Map<number, number>();
        let r = 0;
        while ((rowEnds.get(r) || 0) > rawStart - 0.05) {
          r++;
        }
        assignedRow = r;
        beatRowCacheRef.current.set(beat.id, assignedRow);
      }

      // Record row end
      const rowEnds = laneRowMap.get(laneIdx) || new Map<number, number>();
      rowEnds.set(assignedRow, Math.max(rowEnds.get(assignedRow) || 0, rawStart + durationUnits));
      laneRowMap.set(laneIdx, rowEnds);

      return {
        ...beat,
        color,
        laneIdx,
        isOmittedOrDisabled,
        isMultiLine,
        startUnit: rawStart,
        durationUnits,
        row: assignedRow,
        minWidthPx: minW
      };
    });
  }, [beats, lanes, unusedLaneIndex, effectivePxPerUnit]);

  const snapToGrid = (unit: number): number => Math.max(0.5, Math.round(unit * 4) / 4);

  // ─── DYNAMIC LANE & GROUP GEOMETRY (AUTO-FIT & PREVENT OVERLAP) ────
  const layoutByLane = useMemo(() => {
    return lanes.map((lane, laneIdx) => {
      if (lane.collapsed) {
        return {
          laneHeight: 38,
          beatTopBase: 32,
          groupsLayoutMap: new Map<string, {
            topPx: number;
            heightPx: number;
            bottomPx: number;
            effectiveDurationUnits: number;
            isNested: boolean;
            isBlock: boolean;
            adoptedBeatsCount: number;
          }>(),
          beatsInLane: []
        };
      }

      const laneBeats = beatsWithLayout.filter(b => b.laneIdx === laneIdx);
      const laneGroups = groups.filter(g => g.laneId === lane.id);
      const laneBlocks = laneGroups.filter(g => g.type === 'block');
      const laneRegularGroups = laneGroups.filter(g => g.type !== 'block');
      const hasAnyBlocks = laneBlocks.length > 0;

      // 1. Detect nesting: Any group in a lane that has a sequence block is nested inside it
      const groupNestingMap = new Map<string, { isBlock: boolean; isNested: boolean; parentBlockId: string | null }>();
      laneGroups.forEach(grp => {
        if (grp.type === 'block') {
          groupNestingMap.set(grp.id, { isBlock: true, isNested: false, parentBlockId: null });
        } else {
          const parent = laneBlocks.find(blk =>
            grp.startUnit < (blk.startUnit + blk.durationUnits + 1.5) &&
            (grp.startUnit + grp.durationUnits) > (blk.startUnit - 1.5)
          ) || (hasAnyBlocks ? laneBlocks[0] : null);

          groupNestingMap.set(grp.id, {
            isBlock: false,
            isNested: Boolean(parent),
            parentBlockId: parent?.id || null
          });
        }
      });

      const hasAnyGroups = laneGroups.length > 0;

      // 2. Dedicated vertical zones to guarantee ZERO OVERLAP:
      // - Sequence Block header: top = 6px, height = 26px (Y: 6px -> 32px)
      // - Group header (when block exists): top = 38px, height = 24px (Y: 38px -> 62px)
      // - Group header (when standalone): top = 8px, height = 24px (Y: 8px -> 32px)
      //
      // Beat Rows MUST start strictly below all active headers:
      // If lane has sequence blocks: beatTopBase = 72px (Row 0 starts at 72px, completely clear of the 62px group header!)
      // If lane has standalone groups: beatTopBase = 44px
      // If lane has only empty canvas: beatTopBase = 32px
      const beatTopBase = hasAnyBlocks
        ? 72
        : (hasAnyGroups ? 44 : 32);

      // 3. Layout each beat in this lane
      const beatsInLane = laneBeats.map(b => {
        const isOutlined = b.isOmittedOrDisabled;
        const cardHeight = isOutlined ? (b.isMultiLine ? CARD_HEIGHT_OUTLINE : 28) : CARD_HEIGHT_SOLID;
        const rowStep = isOutlined && b.isMultiLine ? 54 : 32;
        const topPx = beatTopBase + b.row * rowStep;
        const bottomPx = topPx + cardHeight;
        return {
          ...b,
          cardHeight,
          topPx,
          bottomPx
        };
      });

      // 4. Calculate layout for groups first (with cluster-chain auto-adoption)
      const groupsLayoutMap = new Map<string, {
        topPx: number;
        heightPx: number;
        bottomPx: number;
        effectiveDurationUnits: number;
        isNested: boolean;
        isBlock: boolean;
        adoptedBeatsCount: number;
      }>();

      const sortedLaneBeats = [...beatsInLane].sort((a, b) => a.startUnit - b.startUnit);

      laneRegularGroups.forEach(grp => {
        const nesting = groupNestingMap.get(grp.id) || { isBlock: false, isNested: false, parentBlockId: null };
        const topPx = nesting.isNested ? 38 : 8;

        // Cluster-chain adoption:
        // Include all beats starting inside or near the group, AND any chained sequential beats extending from it
        const grpBeats: typeof beatsInLane = [];
        let clusterEnd = grp.startUnit + grp.durationUnits;
        let clusterStart = grp.startUnit;

        for (const b of sortedLaneBeats) {
          if (b.startUnit >= clusterStart - 0.4 && b.startUnit <= clusterEnd + 0.8) {
            grpBeats.push(b);
            clusterEnd = Math.max(clusterEnd, b.startUnit + b.durationUnits);
          }
        }

        // Auto-adopt width to encompass all beats in the cluster
        let effectiveDuration = Math.max(grp.durationUnits, (clusterEnd - grp.startUnit) + 0.5);

        // Auto-fit height to adopt beats vertically with generous padding
        const minHeight = nesting.isNested ? 80 : 88;
        let heightPx = minHeight;
        if (grpBeats.length > 0) {
          const maxBeatBottom = Math.max(...grpBeats.map(b => b.bottomPx));
          heightPx = Math.max(minHeight, (maxBeatBottom - topPx) + 16);
        }

        groupsLayoutMap.set(grp.id, {
          topPx,
          heightPx,
          bottomPx: topPx + heightPx,
          effectiveDurationUnits: effectiveDuration,
          isNested: nesting.isNested,
          isBlock: false,
          adoptedBeatsCount: grpBeats.length
        });
      });

      // Process sequence blocks (to encompass nested groups and all beats)
      laneBlocks.forEach(blk => {
        const topPx = 6;

        // Find nested groups
        const nestedGroups = laneRegularGroups.filter(g =>
          groupNestingMap.get(g.id)?.parentBlockId === blk.id
        );

        // Beats in or adjacent to this block
        const blkBeats: typeof beatsInLane = [];
        let blockClusterEnd = blk.startUnit + blk.durationUnits;
        for (const b of sortedLaneBeats) {
          if (b.startUnit >= blk.startUnit - 0.5 && b.startUnit <= blockClusterEnd + 1.0) {
            blkBeats.push(b);
            blockClusterEnd = Math.max(blockClusterEnd, b.startUnit + b.durationUnits);
          }
        }

        // Auto-adopt width to encompass all nested groups and beats
        const maxChildEnd = Math.max(
          blockClusterEnd,
          ...nestedGroups.map(ng => ng.startUnit + (groupsLayoutMap.get(ng.id)?.effectiveDurationUnits || ng.durationUnits)),
          blk.startUnit + blk.durationUnits
        );
        const effectiveDuration = Math.max(blk.durationUnits, (maxChildEnd - blk.startUnit) + 0.6);

        // Auto-fit height to adopt all nested groups and beats vertically
        const maxChildBottom = Math.max(
          ...nestedGroups.map(ng => groupsLayoutMap.get(ng.id)?.bottomPx || 0),
          ...blkBeats.map(b => b.bottomPx),
          60
        );
        const heightPx = Math.max(90, (maxChildBottom - topPx) + 18);

        groupsLayoutMap.set(blk.id, {
          topPx,
          heightPx,
          bottomPx: topPx + heightPx,
          effectiveDurationUnits: effectiveDuration,
          isNested: false,
          isBlock: true,
          adoptedBeatsCount: blkBeats.length
        });
      });

      // 5. Compute Lane Height: dynamically expands as groups & beats fill up
      const maxBeatsBottom = beatsInLane.reduce((max, b) => Math.max(max, b.bottomPx), 0);
      const maxGroupsBottom = Array.from(groupsLayoutMap.values()).reduce((max, g) => Math.max(max, g.bottomPx), 0);
      const maxContentBottom = Math.max(maxBeatsBottom, maxGroupsBottom);
      const laneHeight = Math.max(LANE_MIN_HEIGHT, maxContentBottom + 32);

      return {
        laneHeight,
        beatTopBase,
        groupsLayoutMap,
        beatsInLane
      };
    });
  }, [lanes, beatsWithLayout, groups]);

  // Dynamic lane height accessor
  const getLaneHeight = useCallback((laneIdx: number) => {
    return layoutByLane[laneIdx]?.laneHeight || LANE_MIN_HEIGHT;
  }, [layoutByLane]);

  const totalBoardUnits = useMemo(() => {
    const maxBeat = beatsWithLayout.length === 0 ? 35 : Math.max(...beatsWithLayout.map(b => b.startUnit + b.durationUnits));
    const maxGroup = groups.length === 0 ? 35 : Math.max(...groups.map(g => g.startUnit + g.durationUnits));
    return Math.max(35, Math.ceil(Math.max(maxBeat, maxGroup) + 6));
  }, [beatsWithLayout, groups]);

  const totalBoardWidth = Math.max(1600, totalBoardUnits * effectivePxPerUnit);

  // ─── Toggle Beat Enable / Disable ───────────────────────────────────
  const handleToggleBeatDisabled = useCallback((beatId: number) => {
    const targetBeat = beatsWithLayout.find(b => b.id === beatId);
    if (!targetBeat) return;
    captureSnapshot();

    const willDisable = !targetBeat.isOmittedOrDisabled;

    if (willDisable) {
      updateBeat(beatId, {
        isDisabled: true,
        trackIndex: unusedLaneIndex,
        startTime: snapToGrid(playheadPos || 3.0)
      });
    } else {
      const mainIdx = lanes.findIndex(l => !l.isUnused && l.id === 'main');
      const targetIdx = mainIdx >= 0 ? mainIdx : (selectedLaneIdx !== unusedLaneIndex ? selectedLaneIdx : 0);
      updateBeat(beatId, {
        isDisabled: false,
        trackIndex: targetIdx,
        startTime: snapToGrid(playheadPos || 2.5)
      });
    }
  }, [beatsWithLayout, captureSnapshot, unusedLaneIndex, updateBeat, playheadPos, lanes, selectedLaneIdx]);

  // ─── Beat Creation (Causality Waterfall) ────────────────────────────
  const createBeat = useCallback((laneIdx: number, startUnit?: number): number => {
    captureSnapshot();
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const sceneNo = beats.length + 1;
    const pos = startUnit ?? (playheadPos || 2.5);
    const color = CAUSALITY_PALETTE[beats.length % CAUSALITY_PALETTE.length];
    const isUnused = lanes[laneIdx]?.isUnused === true;

    const newBeat: Beat = {
      id: newId, x: 100, y: 100, title: '', sceneNumber: String(sceneNo),
      slug: { prefix: 'INT', location: 'SCENE', time: 'DAY' }, content: '<p></p>',
      trackIndex: laneIdx, subtrackIndex: 0, startTime: snapToGrid(pos),
      durationPages: 1.5, durationWidth: 1.5 * effectivePxPerUnit,
      isDisabled: isUnused,
      ...( { color } as any )
    };

    setBeats(prev => [...prev, newBeat]);
    setSelectedBeatId(newId);
    setSelectedLaneIdx(laneIdx);
    setEditingBeatId(newId);
    setEditingField('title');
    setEditingBeatTitle('');
    setEditingBeatSummary('');
    return newId;
  }, [beats.length, captureSnapshot, effectivePxPerUnit, playheadPos, setBeats, lanes]);

  // ─── Rapid Flow: Enter saves title → cascades next beat below ───────
  const handleRapidEntrySave = useCallback((beatId: number) => {
    const title = editingBeatTitle.trim() || `Untitled Beat`;
    updateBeat(beatId, { title });
    captureSnapshot();

    const thisBeat = beatsWithLayout.find(b => b.id === beatId);
    const laneIdx = thisBeat?.laneIdx ?? selectedLaneIdx;

    const nextStart = thisBeat ? thisBeat.startUnit + 0.6 : playheadPos + 1.0;
    createBeat(laneIdx, snapToGrid(nextStart));
  }, [editingBeatTitle, updateBeat, captureSnapshot, beatsWithLayout, selectedLaneIdx, playheadPos, createBeat]);

  const handleTabToSummary = useCallback((beatId: number) => {
    const title = editingBeatTitle.trim() || `Untitled Beat`;
    updateBeat(beatId, { title });
    const thisBeat = beats.find(b => b.id === beatId);
    setEditingField('summary');
    setEditingBeatSummary(thisBeat?.summary || '');
  }, [editingBeatTitle, updateBeat, beats]);

  const handleSummarySave = useCallback((beatId: number) => {
    updateBeat(beatId, { summary: editingBeatSummary.trim() });
    captureSnapshot();
    setEditingBeatId(null);
    setEditingField('title');
  }, [editingBeatSummary, updateBeat, captureSnapshot]);

  const handleSummaryEnter = useCallback((beatId: number) => {
    updateBeat(beatId, { summary: editingBeatSummary.trim() });
    captureSnapshot();

    const thisBeat = beatsWithLayout.find(b => b.id === beatId);
    const laneIdx = thisBeat?.laneIdx ?? selectedLaneIdx;
    const nextStart = thisBeat ? thisBeat.startUnit + 0.6 : playheadPos + 1.0;
    createBeat(laneIdx, snapToGrid(nextStart));
  }, [editingBeatSummary, updateBeat, captureSnapshot, beatsWithLayout, selectedLaneIdx, playheadPos, createBeat]);

  // ─── Lane Management ────────────────────────────────────────────────
  const handleAddLane = () => {
    const newId = `lane-${Date.now()}`;
    const newLaneNum = lanes.length;
    const color = CAUSALITY_PALETTE[lanes.length % CAUSALITY_PALETTE.length];
    saveLanes([...lanes, { id: newId, label: `Thread ${newLaneNum}`, color, isUnused: false, collapsed: false }]);
    setSelectedLaneIdx(lanes.length);
  };

  const handleToggleLaneCollapse = (laneId: string) => {
    saveLanes(lanes.map(l => l.id === laneId ? { ...l, collapsed: !l.collapsed } : l));
  };

  const handleRenameLane = (laneId: string, label: string) => {
    const t = label.trim();
    if (t) saveLanes(lanes.map(l => l.id === laneId ? { ...l, label: t } : l));
    setEditingLaneId(null);
  };

  const handleClearUnusedBeats = () => {
    if (confirm('Clear all parked beats in the Unused lane?')) {
      captureSnapshot();
      setBeats(prev => prev.filter(b => b.trackIndex !== unusedLaneIndex && !b.isDisabled));
    }
  };

  // ─── Group Management ───────────────────────────────────────────────
  const handleAddGroup = (type: 'group' | 'block' = 'group', customStart?: number, customLaneIdx?: number) => {
    const newId = `grp-${Date.now()}`;
    const activeLaneIdx = customLaneIdx ?? selectedLaneIdx;
    const activeLane = lanes[activeLaneIdx] || lanes[1];
    const laneBeats = beatsWithLayout.filter(b => b.laneIdx === activeLaneIdx);
    const selectedBeat = selectedBeatId ? laneBeats.find(b => b.id === selectedBeatId) : null;

    let start = customStart ?? (playheadPos || 4.0);
    let duration = type === 'block' ? 12.0 : 5.5;

    // Smart auto-adopt: if a beat is selected or playhead is near beats in active lane
    if (selectedBeat) {
      const nearby = laneBeats.filter(b =>
        Math.abs(b.startUnit - selectedBeat.startUnit) <= (type === 'block' ? 12.0 : 5.0)
      );
      if (nearby.length > 0) {
        const minStart = Math.min(...nearby.map(b => b.startUnit));
        const maxEnd = Math.max(...nearby.map(b => b.startUnit + b.durationUnits));
        start = Math.max(0.5, minStart - 0.25);
        duration = Math.max(type === 'block' ? 8.0 : 4.0, (maxEnd - start) + 0.5);
      }
    } else if (laneBeats.length > 0) {
      const targetPos = customStart ?? playheadPos;
      const nearby = laneBeats.filter(b =>
        b.startUnit >= targetPos - 0.5 && b.startUnit <= targetPos + (type === 'block' ? 12.0 : 6.0)
      );
      if (nearby.length > 0) {
        const minStart = Math.min(...nearby.map(b => b.startUnit));
        const maxEnd = Math.max(...nearby.map(b => b.startUnit + b.durationUnits));
        start = Math.max(0.5, minStart - 0.25);
        duration = Math.max(type === 'block' ? 8.0 : 4.0, (maxEnd - start) + 0.5);
      }
    }

    saveGroups([
      ...groups,
      {
        id: newId,
        laneId: activeLane.id,
        title: type === 'block' ? 'Sequence Block' : 'Group',
        startUnit: snapToGrid(start),
        durationUnits: snapToGrid(duration),
        type
      }
    ]);
  };

  const handleFitGroupToBeats = useCallback((groupId: string) => {
    const grp = groups.find(g => g.id === groupId);
    if (!grp) return;
    const laneIdx = lanes.findIndex(l => l.id === grp.laneId);
    if (laneIdx < 0) return;
    const laneBeats = beatsWithLayout.filter(b => b.laneIdx === laneIdx);
    const grpBeats = laneBeats.filter(b =>
      b.startUnit < (grp.startUnit + grp.durationUnits + 0.5) &&
      (b.startUnit + b.durationUnits) > (grp.startUnit - 0.5)
    );
    if (grpBeats.length === 0) return;
    const minStart = Math.min(...grpBeats.map(b => b.startUnit));
    const maxEnd = Math.max(...grpBeats.map(b => b.startUnit + b.durationUnits));
    const newStart = Math.max(0.5, snapToGrid(minStart - 0.25));
    const newDuration = snapToGrid(Math.max(grp.type === 'block' ? 6.0 : 3.0, (maxEnd - newStart) + 0.4));
    saveGroups(groups.map(g => g.id === groupId ? { ...g, startUnit: newStart, durationUnits: newDuration } : g));
  }, [groups, lanes, beatsWithLayout, saveGroups, snapToGrid]);

  const handleRenameGroup = (groupId: string, title: string) => {
    const t = title.trim();
    if (t) saveGroups(groups.map(g => g.id === groupId ? { ...g, title: t } : g));
    setEditingGroupId(null);
  };

  const handleDeleteGroup = (groupId: string, deleteBeats = false) => {
    const grp = groups.find(g => g.id === groupId);
    if (!grp) return;
    captureSnapshot();
    if (deleteBeats) {
      const laneIdx = lanes.findIndex(l => l.id === grp.laneId);
      setBeats(prev => prev.filter(b => {
        const inLane = b.trackIndex === laneIdx;
        const bStart = typeof b.startTime === 'number' ? b.startTime : 0;
        const inGrp = inLane && bStart >= grp.startUnit - 0.2 && bStart <= grp.startUnit + grp.durationUnits + 0.2;
        return !inGrp;
      }));
    }
    saveGroups(groups.filter(g => g.id !== groupId));
  };

  // ─── BUTTER-SMOOTH BEAT DRAGGING (ZERO-JITTER) ──────────────────────
  const handleBeatMouseDown = (e: React.MouseEvent, beatId: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const b = beatsWithLayout.find(item => item.id === beatId);
    if (!b) return;

    setSelectedBeatId(beatId);
    setSelectedLaneIdx(b.laneIdx);

    const domEl = document.querySelector(`[data-beat-id="${beatId}"]`) as HTMLElement | null;

    isDraggingBeatRef.current = true;
    beatDragDataRef.current = {
      beatId,
      startX: e.clientX,
      startY: e.clientY,
      initialStart: b.startUnit,
      initialLaneIdx: b.laneIdx,
      initialRow: b.row,
      currentUnit: b.startUnit,
      currentLaneIdx: b.laneIdx,
      currentRow: b.row,
      domEl
    };

    if (domEl) {
      domEl.style.transition = 'none';
      domEl.style.zIndex = '60';
      domEl.style.opacity = '0.9';
      domEl.style.pointerEvents = 'none';
    }
  };

  // ─── BUTTER-SMOOTH GROUP DRAGGING (Moves group & contained beats) ────
  const handleGroupMouseDown = (e: React.MouseEvent, groupId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const grp = groups.find(g => g.id === groupId);
    if (!grp) return;

    const laneIdx = lanes.findIndex(l => l.id === grp.laneId);
    const grpLaneIdx = laneIdx >= 0 ? laneIdx : 1;

    // Find all beats located inside this group
    const grpLayout = layoutByLane[grpLaneIdx]?.groupsLayoutMap.get(groupId);
    const effectiveDuration = grpLayout?.effectiveDurationUnits ?? grp.durationUnits;

    // Find all beats located inside or adopted by this group
    const contained = beatsWithLayout.filter(b =>
      b.laneIdx === grpLaneIdx &&
      b.startUnit >= grp.startUnit - 0.4 &&
      b.startUnit <= grp.startUnit + effectiveDuration + 0.4
    );

    // If it's a block, also find nested groups inside it
    const nestedGroups = grp.type === 'block'
      ? groups.filter(g =>
          g.id !== grp.id &&
          g.laneId === grp.laneId &&
          g.startUnit >= grp.startUnit - 0.4 &&
          (g.startUnit + g.durationUnits) <= (grp.startUnit + effectiveDuration + 0.8)
        )
      : [];

    const groupDomEl = document.querySelector(`[data-group-id="${groupId}"]`) as HTMLElement | null;
    const containedBeats = contained.map(b => ({
      id: b.id,
      initialStart: b.startUnit,
      domEl: document.querySelector(`[data-beat-id="${b.id}"]`) as HTMLElement | null
    }));
    const containedGroups = nestedGroups.map(ng => ({
      id: ng.id,
      initialStart: ng.startUnit,
      domEl: document.querySelector(`[data-group-id="${ng.id}"]`) as HTMLElement | null
    }));

    isDraggingGroupRef.current = true;
    groupDragDataRef.current = {
      groupId,
      startX: e.clientX,
      startY: e.clientY,
      initialStart: grp.startUnit,
      initialLaneIdx: grpLaneIdx,
      currentUnit: grp.startUnit,
      currentLaneIdx: grpLaneIdx,
      groupDomEl,
      containedBeats,
      containedGroups
    };

    if (groupDomEl) {
      groupDomEl.style.transition = 'none';
      groupDomEl.style.zIndex = '40';
      groupDomEl.style.opacity = '0.9';
    }
    containedGroups.forEach(cg => {
      if (cg.domEl) cg.domEl.style.transition = 'none';
    });
    containedBeats.forEach(cb => {
      if (cb.domEl) cb.domEl.style.transition = 'none';
    });
  };

  // ─── GROUP RESIZE HANDLE ────────────────────────────────────────────
  const handleGroupResizeMouseDown = (e: React.MouseEvent, groupId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const grp = groups.find(g => g.id === groupId);
    if (!grp) return;

    const groupDomEl = document.querySelector(`[data-group-id="${groupId}"]`) as HTMLElement | null;
    if (groupDomEl) {
      groupDomEl.style.transition = 'none';
    }

    isResizingGroupRef.current = true;
    groupResizeDataRef.current = {
      groupId,
      startX: e.clientX,
      initialDuration: grp.durationUnits,
      currentDuration: grp.durationUnits,
      groupDomEl
    };
  };

  // Global mousemove & mouseup listeners for hardware-accelerated drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Beat Dragging (Zero lag, 1:1 hardware tracked with row snapping)
      if (isDraggingBeatRef.current && beatDragDataRef.current) {
        const d = beatDragDataRef.current;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        const dp = dx / effectivePxPerUnit;
        const newUnit = snapToGrid(Math.max(0.5, d.initialStart + dp));

        // Determine target lane and relative Y inside target lane
        let targetLaneIdx = d.initialLaneIdx;
        let targetLaneRelY = 0;
        if (lanesContainerRef.current) {
          const rect = lanesContainerRef.current.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          let cumulative = 0;
          for (let i = 0; i < lanes.length; i++) {
            const h = getLaneHeight(i);
            if (relY >= cumulative && relY < cumulative + h) {
              targetLaneIdx = i;
              targetLaneRelY = relY - cumulative;
              break;
            }
            cumulative += h;
          }
          if (relY >= cumulative) {
            targetLaneIdx = lanes.length - 1;
            targetLaneRelY = relY - (cumulative - getLaneHeight(lanes.length - 1));
          }
          targetLaneIdx = Math.max(0, Math.min(lanes.length - 1, targetLaneIdx));
        }

        // Determine target row based on vertical position within target lane
        const laneLayout = layoutByLane[targetLaneIdx];
        const beatTopBase = laneLayout?.beatTopBase ?? 44;
        const targetRow = Math.max(0, Math.floor((targetLaneRelY - beatTopBase + 16) / 32));

        d.currentUnit = newUnit;
        d.currentLaneIdx = targetLaneIdx;
        d.currentRow = targetRow;

        // Apply hardware GPU transform
        if (d.domEl) {
          d.domEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.02)`;
        }
      }

      // 2. Group Dragging
      if (isDraggingGroupRef.current && groupDragDataRef.current) {
        const gd = groupDragDataRef.current;
        const dx = e.clientX - gd.startX;
        const dy = e.clientY - gd.startY;
        const dp = dx / effectivePxPerUnit;
        const newUnit = snapToGrid(Math.max(0.5, gd.initialStart + dp));

        let targetLaneIdx = gd.initialLaneIdx;
        if (lanesContainerRef.current) {
          const rect = lanesContainerRef.current.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          let cumulative = 0;
          for (let i = 0; i < lanes.length; i++) {
            const h = getLaneHeight(i);
            if (relY < cumulative) {
              targetLaneIdx = i;
              break;
            }
            cumulative += h;
          }
          targetLaneIdx = Math.max(0, Math.min(lanes.length - 1, targetLaneIdx));
        }

        gd.currentUnit = newUnit;
        gd.currentLaneIdx = targetLaneIdx;

        if (gd.groupDomEl) {
          gd.groupDomEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
        gd.containedGroups?.forEach(cg => {
          if (cg.domEl) {
            cg.domEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          }
        });
        gd.containedBeats.forEach(cb => {
          if (cb.domEl) {
            cb.domEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          }
        });
      }

      // 3. Group Resizing (Direct DOM manipulation - zero React lag & 120fps smooth)
      if (isResizingGroupRef.current && groupResizeDataRef.current) {
        const rd = groupResizeDataRef.current;
        const dx = e.clientX - rd.startX;
        const dp = dx / effectivePxPerUnit;
        const newDuration = Math.max(2.0, Math.round((rd.initialDuration + dp) * 2) / 2);
        rd.currentDuration = newDuration;
        if (rd.groupDomEl) {
          rd.groupDomEl.style.width = `${newDuration * effectivePxPerUnit}px`;
        }
      }
    };

    const handleGlobalMouseUp = () => {
      // 1. Commit Beat Drag
      if (isDraggingBeatRef.current && beatDragDataRef.current) {
        const d = beatDragDataRef.current;
        if (d.domEl) {
          d.domEl.style.transform = '';
          d.domEl.style.zIndex = '';
          d.domEl.style.opacity = '';
          d.domEl.style.pointerEvents = '';
          d.domEl.style.transition = '';
        }

        const isTargetUnused = lanes[d.currentLaneIdx]?.isUnused === true;
        const isInitialUnused = lanes[d.initialLaneIdx]?.isUnused === true;

        const updates: Partial<Beat> = {
          startTime: d.currentUnit,
          trackIndex: d.currentLaneIdx,
          subtrackIndex: d.currentRow
        };

        if (isTargetUnused && !isInitialUnused) updates.isDisabled = true;
        else if (!isTargetUnused && isInitialUnused) updates.isDisabled = false;

        beatRowCacheRef.current.set(d.beatId, d.currentRow);
        updateBeat(d.beatId, updates);
        captureSnapshot();

        isDraggingBeatRef.current = false;
        beatDragDataRef.current = null;
      }

      // 2. Commit Group Drag
      if (isDraggingGroupRef.current && groupDragDataRef.current) {
        const gd = groupDragDataRef.current;
        if (gd.groupDomEl) {
          gd.groupDomEl.style.transform = '';
          gd.groupDomEl.style.zIndex = '';
          gd.groupDomEl.style.opacity = '';
          gd.groupDomEl.style.transition = '';
        }
        gd.containedGroups?.forEach(cg => {
          if (cg.domEl) {
            cg.domEl.style.transform = '';
            cg.domEl.style.transition = '';
          }
        });
        gd.containedBeats.forEach(cb => {
          if (cb.domEl) {
            cb.domEl.style.transform = '';
            cb.domEl.style.transition = '';
          }
        });

        const targetLane = lanes[gd.currentLaneIdx] || lanes[1];
        const dOffset = gd.currentUnit - gd.initialStart;

        // Update group and any nested groups
        saveGroups(groups.map(g => {
          if (g.id === gd.groupId) {
            return {
              ...g,
              startUnit: gd.currentUnit,
              laneId: targetLane.id
            };
          }
          const cg = gd.containedGroups?.find(item => item.id === g.id);
          if (cg) {
            return {
              ...g,
              startUnit: snapToGrid(cg.initialStart + dOffset),
              laneId: targetLane.id
            };
          }
          return g;
        }));

        // Update contained beats
        const isTargetUnused = targetLane.isUnused === true;
        gd.containedBeats.forEach(cb => {
          updateBeat(cb.id, {
            startTime: snapToGrid(cb.initialStart + dOffset),
            trackIndex: gd.currentLaneIdx,
            isDisabled: isTargetUnused
          });
        });

        captureSnapshot();

        isDraggingGroupRef.current = false;
        groupDragDataRef.current = null;
      }

      // 3. Commit Group Resize (Single storage save on release)
      if (isResizingGroupRef.current && groupResizeDataRef.current) {
        const rd = groupResizeDataRef.current;
        if (rd.groupDomEl) {
          rd.groupDomEl.style.transition = '';
        }
        saveGroups(groups.map(g => g.id === rd.groupId ? { ...g, durationUnits: rd.currentDuration } : g));
        isResizingGroupRef.current = false;
        groupResizeDataRef.current = null;
        captureSnapshot();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [effectivePxPerUnit, lanes, groups, updateBeat, captureSnapshot, getLaneHeight, saveGroups, layoutByLane]);

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || t?.isContentEditable) return;

      if (e.code === 'Enter' && editingBeatId === null) {
        e.preventDefault();
        createBeat(selectedLaneIdx, playheadPos);
        return;
      }
      if ((e.key === 'd' || e.key === 'D') && selectedBeatId !== null && editingBeatId === null) {
        e.preventDefault();
        handleToggleBeatDisabled(selectedBeatId);
        return;
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoomLevel(z => Math.min(2.5, z + 0.15)); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoomLevel(z => Math.max(0.4, z - 0.15)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedLaneIdx(i => Math.max(0, i - 1)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedLaneIdx(i => Math.min(lanes.length - 1, i + 1)); }
      else if ((e.code === 'Delete' || e.code === 'Backspace') && selectedBeatId !== null && editingBeatId === null) {
        e.preventDefault();
        setBeats(prev => prev.filter(b => b.id !== selectedBeatId));
        setSelectedBeatId(null);
        captureSnapshot();
      } else if (e.key === 'Escape') {
        setSelectedBeatId(null);
        setEditingBeatId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [editingBeatId, selectedBeatId, selectedLaneIdx, lanes.length, playheadPos, createBeat, setBeats, captureSnapshot, handleToggleBeatDisabled]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!boardScrollRef.current) return;
    const rect = boardScrollRef.current.getBoundingClientRect();
    const scrollLeft = boardScrollRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft - 176;
    if (clickX > 0) {
      setPlayheadPos(snapToGrid(clickX / effectivePxPerUnit));
    }
  };

  // ─── Theme Colors ───────────────────────────────────────────────────
  const themeStyles = useMemo(() => {
    if (isLight) {
      return {
        canvasBg: '#e4e6ed',
        topBarBg: '#f8fafc',
        topBarBorder: '#cbd5e1',
        topBarText: '#334155',
        bottomBarBg: '#f8fafc',
        bottomBarBorder: '#cbd5e1',
        bottomBarText: '#334155',
        laneBorder: '#cbd5e1',
        cyanPlayhead: '#0ea5e9',
        blockBg: 'rgba(216, 219, 228, 0.65)',
        blockBorder: 'rgba(148, 163, 184, 0.45)',
        blockHeaderBg: 'rgba(203, 213, 225, 0.90)',
        blockHeaderText: '#0f172a',
        groupBg: 'rgba(226, 232, 240, 0.70)',
        groupBorder: 'rgba(148, 163, 184, 0.40)',
        groupHeaderBg: 'rgba(203, 213, 225, 0.75)',
        groupHeaderText: '#334155',
      };
    }
    return {
      canvasBg: '#3d4047',
      topBarBg: '#1a1c22',
      topBarBorder: '#0f1014',
      topBarText: '#cbd5e1',
      bottomBarBg: '#16171b',
      bottomBarBorder: '#25272e',
      bottomBarText: '#94a3b8',
      laneBorder: 'rgba(0, 0, 0, 0.35)',
      cyanPlayhead: '#00e5ff',
      blockBg: 'rgba(90, 93, 102, 0.45)',
      blockBorder: 'rgba(255, 255, 255, 0.10)',
      blockHeaderBg: 'rgba(0, 0, 0, 0.55)',
      blockHeaderText: '#ffffff',
      groupBg: 'rgba(75, 78, 86, 0.55)',
      groupBorder: 'rgba(255, 255, 255, 0.12)',
      groupHeaderBg: 'rgba(0, 0, 0, 0.40)',
      groupHeaderText: 'rgba(255, 255, 255, 0.80)',
    };
  }, [isLight]);

  return (
    <div
      className={`w-full h-full flex flex-col select-none overflow-hidden relative transition-colors duration-150 ${
        isFullscreen ? 'fixed inset-0 z-[9999]' : ''
      }`}
      style={{
        backgroundColor: themeStyles.canvasBg,
        color: isLight ? '#0f172a' : '#f1f2f6'
      }}
    >
      {/* ─── CAUSALITY TOP MENU BAR ─── */}
      <div
        className="h-7 px-3 border-b flex items-center justify-between text-[11px] font-sans shrink-0 z-30 transition-colors"
        style={{
          backgroundColor: themeStyles.topBarBg,
          borderColor: themeStyles.topBarBorder,
          color: themeStyles.topBarText
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold tracking-wide">
            <span style={{ color: themeStyles.cyanPlayhead }}>Causality</span>
            <span className="opacity-40 font-normal">·</span>
            <span className="font-normal text-[10px] opacity-80">{currentProjectName}</span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-[10px] opacity-75">
            <span className="hover:opacity-100 cursor-pointer transition-opacity">File</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Edit</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity" onClick={() => setIsScriptRollingOpen(true)}>Script</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Timeline</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Characters</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity font-bold">Whiteboard</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Account</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Window</span>
            <span className="hover:opacity-100 cursor-pointer transition-opacity">Help</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[9px] font-mono opacity-50">
          <span>{beats.filter(b => !b.isDisabled).length} active</span>
          <span>·</span>
          <span>{beats.filter(b => b.isDisabled).length} disabled</span>
          <span>·</span>
          <span>{lanes.length} lanes</span>
        </div>
      </div>

      {/* ─── WHITEBOARD MAIN CANVAS ─── */}
      <div
        ref={boardScrollRef}
        onClick={handleCanvasClick}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const scrollLeft = e.currentTarget.scrollLeft;
          const canvasUnit = snapToGrid((e.clientX - rect.left + scrollLeft - 176) / effectivePxPerUnit);
          setContextMenu({
            type: 'canvas',
            laneIdx: selectedLaneIdx,
            canvasUnit: Math.max(1, canvasUnit),
            x: e.clientX,
            y: e.clientY
          });
        }}
        className="flex-1 overflow-auto flex flex-col relative select-none"
        style={{ backgroundColor: themeStyles.canvasBg }}
      >
        <div
          style={{ width: `${totalBoardWidth + 240}px` }}
          className="min-h-full flex flex-col relative"
        >
          {/* Vertical Cyan Playhead Line */}
          <div
            style={{
              left: `${playheadPos * effectivePxPerUnit + 176}px`,
              height: `${lanes.reduce((s, _, i) => s + getLaneHeight(i), 0) + 120}px`,
              backgroundColor: themeStyles.cyanPlayhead
            }}
            className="absolute top-0 w-[1.5px] pointer-events-none z-30 shadow-md"
          >
            <div
              style={{ backgroundColor: themeStyles.cyanPlayhead }}
              className="w-2.5 h-2.5 rounded-full shadow-md -translate-x-[4px] -translate-y-[2px]"
            />
          </div>

          {/* Lanes Container */}
          <div ref={lanesContainerRef} className="flex-1 flex flex-col relative">
            {/* ─── CAUSALITY DEPENDENCY CONNECTIONS SVG LAYER ─── */}
            <svg
              className="absolute inset-0 pointer-events-none z-15 overflow-visible"
              style={{
                width: `${totalBoardWidth + 240}px`,
                height: `${lanes.reduce((s, _, i) => s + getLaneHeight(i), 0)}px`
              }}
            >
              <defs>
                <marker
                  id="causality-arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="causality-arrow-highlight"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00e5ff" />
                </marker>
              </defs>

              {connections.map((conn, idx) => {
                const allBeatsInLanes = layoutByLane.flatMap(l => l.beatsInLane);
                const fromBeat = allBeatsInLanes.find(b => b.id === conn.from);
                const toBeat = allBeatsInLanes.find(b => b.id === conn.to);
                if (!fromBeat || !toBeat) return null;

                const getLaneTop = (lIdx: number) => {
                  let c = 0;
                  for (let i = 0; i < lIdx; i++) c += getLaneHeight(i);
                  return c;
                };

                const x1 = (fromBeat.startUnit + fromBeat.durationUnits) * effectivePxPerUnit + 176;
                const y1 = getLaneTop(fromBeat.laneIdx) + (fromBeat.topPx ?? 40) + ((fromBeat.cardHeight ?? 24) / 2);

                const x2 = toBeat.startUnit * effectivePxPerUnit + 176;
                const y2 = getLaneTop(toBeat.laneIdx) + (toBeat.topPx ?? 40) + ((toBeat.cardHeight ?? 24) / 2);

                const isHighlight = selectedBeatId === conn.from || selectedBeatId === conn.to;
                const isForward = x2 > x1 + 15;

                let pathD = '';
                if (isForward) {
                  const dx = Math.max(30, (x2 - x1) * 0.45);
                  pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                } else {
                  const dx = 40;
                  const dy = y2 >= y1 ? 30 : -30;
                  pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x1 + dx} ${y1 + dy}, ${(x1 + x2) / 2} ${(y1 + y2) / 2} C ${x2 - dx} ${y2 - dy}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                }

                return (
                  <path
                    key={`conn-${conn.from}-${conn.to}-${idx}`}
                    d={pathD}
                    fill="none"
                    stroke={isHighlight ? '#00e5ff' : (conn.color || '#f59e0b')}
                    strokeWidth={isHighlight ? 2.5 : 1.5}
                    strokeOpacity={isHighlight ? 1 : 0.70}
                    markerEnd={isHighlight ? 'url(#causality-arrow-highlight)' : 'url(#causality-arrow)'}
                    className="transition-all"
                  />
                );
              })}
            </svg>

            {lanes.map((lane, laneIdx) => {
              const laneLayout = layoutByLane[laneIdx];
              const laneHeight = laneLayout?.laneHeight || getLaneHeight(laneIdx);
              const laneGroups = groups.filter(g => g.laneId === lane.id);

              return (
                <div
                  key={lane.id}
                  className={`flex w-full relative transition-colors ${
                    laneIdx > 0 ? 'border-t' : ''
                  }`}
                  style={{
                    height: `${laneHeight}px`,
                    borderColor: themeStyles.laneBorder
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLaneIdx(laneIdx);
                  }}
                >
                  {/* Sticky Left Lane Badge */}
                  <div className="w-44 shrink-0 sticky left-0 z-20 px-2 py-2 flex items-start select-none">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLaneCollapse(lane.id);
                      }}
                      style={{
                        backgroundColor: lane.color && !['#1c1d21', '#18191d', '#1e2025', '#ff060101', '#ff000000', '#060101', '#000000'].includes(lane.color.toLowerCase())
                          ? lane.color
                          : (isLight ? '#334155' : '#18191d'),
                        borderColor: 'rgba(255, 255, 255, 0.15)'
                      }}
                      className="px-2 py-1 rounded-[4px] text-[11px] font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer text-white border hover:brightness-110"
                      title="Click to collapse / expand lane"
                    >
                      <span className="text-[9px] opacity-75">
                        {lane.collapsed ? '▶' : '▼'}
                      </span>

                      {editingLaneId === lane.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingLaneLabel}
                          onChange={(e) => setEditingLaneLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameLane(lane.id, editingLaneLabel);
                            if (e.key === 'Escape') setEditingLaneId(null);
                          }}
                          onBlur={() => handleRenameLane(lane.id, editingLaneLabel)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent outline-none w-24 text-[11px] font-bold"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingLaneId(lane.id);
                            setEditingLaneLabel(lane.label);
                          }}
                          className="truncate max-w-[115px]"
                        >
                          {lane.label}
                        </span>
                      )}

                      {lane.isUnused && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearUnusedBeats();
                          }}
                          className="ml-1 opacity-70 hover:opacity-100 hover:text-red-400 transition-colors cursor-pointer"
                          title="Clear all unused/disabled beats"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lane Canvas Area */}
                  {!lane.collapsed && (
                    <div
                      style={{ width: `${totalBoardWidth}px`, height: `${laneHeight}px` }}
                      onDoubleClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickPos = snapToGrid(Math.max(1, (e.clientX - rect.left) / effectivePxPerUnit));
                        createBeat(laneIdx, clickPos);
                      }}
                      className="flex-1 relative overflow-visible"
                    >
                      {/* Empty Lane Invitation */}
                      {beats.length === 0 && !lane.isUnused && laneIdx === 2 && (
                        <div className="absolute left-16 top-1/2 -translate-y-1/2 flex items-center gap-4 px-4 py-3 rounded-xl border border-dashed border-white/20 bg-black/20 dark:bg-white/5 backdrop-blur-md pointer-events-auto select-none z-20">
                          <div className="text-xs">
                            <span className="font-semibold block text-sm opacity-95">Ready to structure your screenplay</span>
                            <span className="opacity-70 text-[11px]">Press <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-amber-400 font-mono font-bold">Enter</kbd> to add beats in flow, or double-click anywhere</span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                createBeat(laneIdx, 2.5);
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#00e5ff] text-black hover:bg-[#38bdf8] transition-all cursor-pointer shadow-md active:scale-95"
                            >
                              + Add Beat
                            </button>
                            {typeof autoGenerate5Scenes === 'function' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  autoGenerate5Scenes();
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 hover:bg-white/10 transition-all cursor-pointer"
                              >
                                Load Sample Story
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Groups & Blocks (Pass-through pointer-events so beats receive all clicks) */}
                      {laneGroups.map(grp => {
                        const grpLayout = laneLayout?.groupsLayoutMap.get(grp.id);
                        const isBlock = grp.type === 'block';
                        const isNested = grpLayout?.isNested ?? false;
                        const grpLeft = grp.startUnit * effectivePxPerUnit;
                        const grpWidth = (grpLayout?.effectiveDurationUnits ?? grp.durationUnits) * effectivePxPerUnit;
                        const grpTop = grpLayout?.topPx ?? (isBlock ? 6 : (isNested ? 36 : 8));
                        const grpHeight = grpLayout?.heightPx ?? 80;
                        const beatCount = grpLayout?.adoptedBeatsCount ?? 0;

                        return (
                          <div
                            key={grp.id}
                            data-group-id={grp.id}
                            style={{
                              left: `${grpLeft}px`,
                              width: `${grpWidth}px`,
                              top: `${grpTop}px`,
                              height: `${grpHeight}px`,
                              backgroundColor: isBlock ? themeStyles.blockBg : themeStyles.groupBg,
                              borderColor: isBlock ? themeStyles.blockBorder : themeStyles.groupBorder,
                              zIndex: isBlock ? 5 : (isNested ? 8 : 6)
                            }}
                            className="absolute rounded-[6px] transition-[background-color,border-color,box-shadow] duration-150 pointer-events-none flex flex-col overflow-visible border shadow-xs"
                          >
                            {/* Group Header Title (Active pointer-events for dragging & renaming) */}
                            <div
                              onMouseDown={(e) => handleGroupMouseDown(e, grp.id)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({
                                  type: 'group',
                                  groupId: grp.id,
                                  laneIdx,
                                  x: e.clientX,
                                  y: e.clientY
                                });
                              }}
                              style={{
                                backgroundColor: isBlock ? themeStyles.blockHeaderBg : themeStyles.groupHeaderBg,
                                color: isBlock ? themeStyles.blockHeaderText : themeStyles.groupHeaderText
                              }}
                              className={`px-2.5 flex items-center justify-between select-none pointer-events-auto cursor-grab active:cursor-grabbing border-b border-black/10 dark:border-white/10 ${
                                isBlock
                                  ? 'h-[26px] font-bold text-[11px] rounded-t-[5px]'
                                  : 'h-[22px] font-semibold text-[10px] rounded-t-[5px]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {isBlock ? (
                                  <Layers size={12} className="text-purple-400 shrink-0" />
                                ) : (
                                  <FolderPlus size={11} className="text-amber-400 shrink-0" />
                                )}
                                {editingGroupId === grp.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingGroupTitle}
                                    onChange={(e) => setEditingGroupTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameGroup(grp.id, editingGroupTitle);
                                      if (e.key === 'Escape') setEditingGroupId(null);
                                    }}
                                    onBlur={() => handleRenameGroup(grp.id, editingGroupTitle)}
                                    className="bg-black/50 text-white rounded px-1.5 py-0.5 outline-none text-[10px]"
                                  />
                                ) : (
                                  <span
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingGroupId(grp.id);
                                      setEditingGroupTitle(grp.title);
                                    }}
                                    className="truncate cursor-pointer hover:underline"
                                    title={isBlock ? "Double-click to rename. Drag header to move block with its groups and beats." : "Double-click to rename. Drag header to move group with its beats."}
                                  >
                                    {grp.title}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-black/30 dark:bg-white/10 text-white/70 font-mono font-medium">
                                  {beatCount} {beatCount === 1 ? 'beat' : 'beats'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFitGroupToBeats(grp.id);
                                  }}
                                  className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                                  title="Auto-fit boundaries to adopt beats"
                                >
                                  <Maximize2 size={isBlock ? 10 : 9.5} />
                                </button>
                              </div>

                              {/* Right resize handle on group */}
                              <div
                                onMouseDown={(e) => handleGroupResizeMouseDown(e, grp.id)}
                                className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize rounded-r-[6px] pointer-events-auto ${
                                  isBlock ? 'hover:bg-purple-500/30' : 'hover:bg-amber-500/30'
                                }`}
                                title="Drag to resize width"
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Beats in this Lane (High z-index and pointer-events-auto for guaranteed right-click & drag) */}
                      {(laneLayout?.beatsInLane || []).map(beat => {
                        const isSelected = selectedBeatId === beat.id;
                        const isEditing = editingBeatId === beat.id;
                        const leftPx = beat.startUnit * effectivePxPerUnit;
                        const widthPx = Math.max(beat.minWidthPx, beat.durationUnits * effectivePxPerUnit);
                        const isOutlined = beat.isOmittedOrDisabled;
                        const topPx = beat.topPx;
                        const cardHeight = beat.cardHeight;

                        return (
                          <div
                            key={beat.id}
                            data-beat-id={beat.id}
                            onMouseDown={(e) => { if (!isEditing) handleBeatMouseDown(e, beat.id); }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (!isEditing) {
                                setEditingBeatId(beat.id);
                                setEditingField('title');
                                setEditingBeatTitle(beat.title);
                                setEditingBeatSummary(beat.summary || '');
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedBeatId(beat.id);
                              setContextMenu({
                                type: 'beat',
                                beatId: beat.id,
                                x: e.clientX,
                                y: e.clientY
                              });
                            }}
                            style={{
                              left: `${leftPx}px`,
                              top: `${topPx}px`,
                              width: `${widthPx}px`,
                              height: `${cardHeight}px`,
                              backgroundColor: isOutlined
                                ? isLight ? '#ffffff' : 'rgba(25, 27, 33, 0.75)'
                                : (beat.color || '#3b5284'),
                              border: isOutlined
                                ? `1.5px solid ${beat.color || '#eab308'}`
                                : 'none',
                              color: isOutlined
                                ? isLight ? '#0f172a' : '#ffffff'
                                : '#ffffff'
                            }}
                            className={`absolute rounded-[3px] select-none cursor-grab active:cursor-grabbing flex items-center px-2 z-20 pointer-events-auto transition-[box-shadow,background-color,border-color,opacity] duration-150 ${
                              isOutlined ? 'shadow-xs' : 'shadow-sm'
                            } ${
                              isSelected ? 'ring-2 ring-white scale-[1.02] shadow-xl z-30' : 'hover:brightness-110'
                            }`}
                          >
                            {isEditing && editingField === 'title' ? (
                              <input
                                type="text"
                                autoFocus
                                placeholder="Type beat name..."
                                value={editingBeatTitle}
                                onChange={(e) => setEditingBeatTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleRapidEntrySave(beat.id);
                                  } else if (e.key === 'Tab') {
                                    e.preventDefault();
                                    handleTabToSummary(beat.id);
                                  } else if (e.key === 'Escape') {
                                    const title = editingBeatTitle.trim() || 'Untitled Beat';
                                    updateBeat(beat.id, { title });
                                    setEditingBeatId(null);
                                  }
                                }}
                                onBlur={() => {
                                  const title = editingBeatTitle.trim() || 'Untitled Beat';
                                  updateBeat(beat.id, { title });
                                  if (editingField === 'title') setEditingBeatId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full bg-black/20 text-white rounded px-1 text-[11px] font-medium outline-none placeholder-white/50"
                              />
                            ) : (
                              <span
                                className={`${
                                  isOutlined
                                    ? 'text-[10.5px] leading-snug font-medium line-clamp-2'
                                    : 'text-[11px] font-medium truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]'
                                }`}
                              >
                                {beat.title || 'Untitled Beat'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── CAUSALITY SECTION BREAKS / MILESTONES RULER ─── */}
          {sectionBreaks.length > 0 && (
            <div
              className="h-8 border-t relative shrink-0 select-none overflow-visible"
              style={{
                borderColor: themeStyles.laneBorder,
                backgroundColor: isLight ? '#f1f5f9' : '#1c1d22'
              }}
            >
              <div className="w-44 shrink-0 sticky left-0 z-20 px-3 py-1.5 text-[10px] font-bold opacity-60 flex items-center">
                Milestones
              </div>
              {sectionBreaks.map((sb) => {
                const leftPx = sb.unit * effectivePxPerUnit + 176;
                return (
                  <div
                    key={sb.id}
                    onClick={() => {
                      if (boardScrollRef.current) {
                        boardScrollRef.current.scrollTo({ left: Math.max(0, leftPx - 300), behavior: 'smooth' });
                      }
                      setPlayheadPos(sb.unit);
                    }}
                    style={{ left: `${leftPx}px` }}
                    className="absolute top-1.5 px-2.5 py-0.5 rounded-[3px] bg-[#00838f] hover:bg-[#0097a7] border border-[#00bcd4]/50 text-white text-[10px] font-bold shadow-sm cursor-pointer whitespace-nowrap z-20 transition-all hover:scale-105 active:scale-95"
                    title={`Milestone: ${sb.title} (Click to jump)`}
                  >
                    {sb.title}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── CAUSALITY BOTTOM TOOLBAR ─── */}
      <div
        className="h-11 px-4 border-t flex items-center justify-between shrink-0 z-30 select-none transition-colors"
        style={{
          backgroundColor: themeStyles.bottomBarBg,
          borderColor: themeStyles.bottomBarBorder,
          color: themeStyles.bottomBarText
        }}
      >
        {/* Left: View Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {}}
            className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
            title="Push / Shove timeline"
          >
            <ArrowLeftRight size={13} />
            <span className="text-[9px]">Push</span>
          </button>

          <button
            onClick={() => setZoomLevel(z => Math.max(0.4, z - 0.2))}
            className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
            title="Overview (Zoom Out)"
          >
            <ZoomOut size={13} />
            <span className="text-[9px]">Overview</span>
          </button>

          <button
            onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))}
            className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
            title="Detail (Zoom In)"
          >
            <ZoomIn size={13} />
            <span className="text-[9px]">Detail</span>
          </button>

          <button
            onClick={() => setPlayheadPos(p => Math.max(1, p - 1.5))}
            className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
            title="Previous"
          >
            <ChevronLeft size={13} />
            <span className="text-[9px]">Previous</span>
          </button>

          <button
            onClick={() => setPlayheadPos(p => p + 1.5)}
            className="flex flex-col items-center justify-center px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-[10px]"
            title="Next"
          >
            <ChevronRight size={13} />
            <span className="text-[9px]">Next</span>
          </button>
        </div>

        {/* Center: Hierarchy Buttons (Lane · Block · Group · Beat) */}
        <div
          className={`flex items-center p-0.5 rounded-full border shadow-inner ${
            isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#252830] border-white/10'
          }`}
        >
          <button
            onClick={handleAddLane}
            className={`px-3.5 py-1 text-[11px] font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
              isLight ? 'text-slate-800 hover:bg-white' : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
            title="Add Lane"
          >
            <span className="text-[8px] text-[#00e5ff]">▶</span>
            <span>Lane</span>
          </button>

          <button
            onClick={() => handleAddGroup('block')}
            className={`px-3.5 py-1 text-[11px] font-semibold rounded-full transition-all cursor-pointer ${
              isLight ? 'text-slate-800 hover:bg-white' : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
            title="Add Block Container"
          >
            Block
          </button>

          <button
            onClick={() => handleAddGroup('group')}
            className={`px-3.5 py-1 text-[11px] font-semibold rounded-full transition-all cursor-pointer ${
              isLight ? 'text-slate-800 hover:bg-white' : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
            title="Add Group"
          >
            Group
          </button>

          <button
            onClick={() => createBeat(selectedLaneIdx, playheadPos)}
            className="px-4 py-1 text-[11px] font-bold text-black bg-[#00e5ff] hover:bg-[#38bdf8] rounded-full transition-all cursor-pointer shadow-sm active:scale-95"
            title="Add Beat (or press Enter)"
          >
            Beat
          </button>
        </div>

        {/* Right: Research / AI / Fullscreen */}
        <div className="flex items-center gap-1">
          {aiAvailable && (
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 hover:text-amber-500 transition-colors cursor-pointer"
              title="AI Assistant"
            >
              <Sparkles size={13} />
              <span className="text-[9px]">AI</span>
            </button>
          )}

          <button
            onClick={() => setIsScriptRollingOpen(true)}
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Open Script Preview"
          >
            <ScrollText size={13} />
            <span className="text-[9px]">Script</span>
          </button>

          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Full Screen"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="text-[9px]">Full Screen</span>
          </button>
        </div>
      </div>

      {/* ─── COMPREHENSIVE CONTEXT MENU (Beats, Groups, Canvas) ─── */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[99998]"
            onMouseDown={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            style={{
              left: `${Math.min(window.innerWidth - 220, Math.max(10, contextMenu.x))}px`,
              top: `${Math.min(window.innerHeight - 280, Math.max(10, contextMenu.y))}px`
            }}
            className={`fixed z-[99999] w-56 rounded-xl shadow-2xl p-1.5 text-xs font-sans border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 ${
              isLight
                ? 'bg-white/95 border-slate-300 text-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.15)]'
                : 'bg-[#181a20]/95 border-white/10 text-white shadow-[0_10px_30px_rgba(0,0,0,0.7)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Beat Context Menu */}
            {contextMenu.type === 'beat' && contextMenu.beatId && (() => {
              const mb = beatsWithLayout.find(b => b.id === contextMenu.beatId);
              if (!mb) return null;

              return (
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => { onEditBeat(mb.id); setContextMenu(null); }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <ScrollText size={13} className="text-[#00e5ff]" />
                    <span className="font-semibold">Edit in Script</span>
                  </button>

                  <button
                    onClick={() => {
                      handleToggleBeatDisabled(mb.id);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      mb.isOmittedOrDisabled
                        ? 'text-emerald-500 hover:bg-emerald-500/15'
                        : 'text-amber-500 hover:bg-amber-500/15'
                    }`}
                  >
                    {mb.isOmittedOrDisabled ? (
                      <>
                        <Eye size={13} />
                        <span>Enable (Move to Script)</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={13} />
                        <span>Disable (Park in Unused)</span>
                      </>
                    )}
                  </button>

                  {/* Beat Color Swatches */}
                  <div className={`px-2 py-1.5 my-1 rounded-lg border flex flex-col gap-1.5 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'
                  }`}>
                    <span className="text-[10px] font-semibold opacity-60">Color Swatch</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {CAUSALITY_PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            updateBeat(mb.id, { color: c } as any);
                            setContextMenu(null);
                          }}
                          style={{ backgroundColor: c }}
                          className="w-5 h-5 rounded-full cursor-pointer hover:scale-125 transition-transform flex items-center justify-center shadow-xs"
                        >
                          {mb.color === c && <Check size={10} className="text-white drop-shadow-md" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingBeatId(mb.id);
                      setEditingField('title');
                      setEditingBeatTitle(mb.title);
                      setEditingBeatSummary(mb.summary || '');
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <Edit3 size={13} className="text-cyan-400" />
                    <span>Rename Beat</span>
                  </button>

                  <button
                    onClick={() => {
                      captureSnapshot();
                      const newId = Date.now();
                      setBeats([...beats, { ...mb, id: newId, title: `${mb.title} (Copy)`, startTime: snapToGrid(mb.startUnit + 0.6) }]);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <Copy size={13} className="text-emerald-400" />
                    <span>Duplicate</span>
                  </button>

                  <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

                  <button
                    onClick={() => {
                      setBeats(prev => prev.filter(b => b.id !== mb.id));
                      setContextMenu(null);
                      captureSnapshot();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-red-500/20 text-red-500 cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Beat</span>
                  </button>
                </div>
              );
            })()}

            {/* Canvas Context Menu */}
            {contextMenu.type === 'canvas' && (
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    createBeat(contextMenu.laneIdx ?? selectedLaneIdx, contextMenu.canvasUnit ?? playheadPos);
                    setContextMenu(null);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer font-semibold transition-colors ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <Plus size={13} className="text-[#00e5ff]" />
                  <span>Add Beat Here</span>
                </button>

                <button
                  onClick={() => {
                    handleAddGroup('group', contextMenu.canvasUnit, contextMenu.laneIdx);
                    setContextMenu(null);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <FolderPlus size={13} className="text-amber-400" />
                  <span>Add Group Here</span>
                </button>

                <button
                  onClick={() => {
                    handleAddGroup('block', contextMenu.canvasUnit, contextMenu.laneIdx);
                    setContextMenu(null);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <Layers size={13} className="text-purple-400" />
                  <span>Add Sequence Block</span>
                </button>

                <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

                <button
                  onClick={() => {
                    handleAddLane();
                    setContextMenu(null);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <Plus size={13} />
                  <span>Add Story Lane</span>
                </button>
              </div>
            )}

            {/* Group Context Menu */}
            {contextMenu.type === 'group' && contextMenu.groupId && (() => {
              const grp = groups.find(g => g.id === contextMenu.groupId);
              if (!grp) return null;

              return (
                <div className="flex flex-col gap-0.5">
                  <div className="px-2 py-1 font-bold truncate opacity-60 text-[10px] flex items-center gap-1.5">
                    {grp.type === 'block' ? (
                      <Layers size={11} className="text-purple-400" />
                    ) : (
                      <FolderPlus size={11} className="text-amber-400" />
                    )}
                    <span>{grp.type === 'block' ? 'Sequence Block' : 'Group'}: {grp.title}</span>
                  </div>

                  <button
                    onClick={() => {
                      handleFitGroupToBeats(grp.id);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <Maximize2 size={13} className="text-emerald-400" />
                    <span>Fit Boundaries to Adopt Beats</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingGroupId(grp.id);
                      setEditingGroupTitle(grp.title);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <Edit3 size={13} className="text-cyan-400" />
                    <span>Rename {grp.type === 'block' ? 'Block' : 'Group'}</span>
                  </button>

                  <button
                    onClick={() => {
                      createBeat(contextMenu.laneIdx ?? selectedLaneIdx, grp.startUnit + 0.5);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    <Plus size={13} className="text-[#00e5ff]" />
                    <span>Add Beat Inside</span>
                  </button>

                  <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />

                  <button
                    onClick={() => {
                      handleDeleteGroup(grp.id, false);
                      setContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <Trash2 size={13} />
                    <span>Ungroup (Keep Beats)</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete group "${grp.title}" and all beats inside it?`)) {
                        handleDeleteGroup(grp.id, true);
                        setContextMenu(null);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-red-500/20 text-red-500 cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Group & Beats</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ─── MODALS ─── */}
      <ScriptRollingPreviewModal
        isOpen={isScriptRollingOpen}
        onClose={() => setIsScriptRollingOpen(false)}
        isPlaying={false}
        onTogglePlay={() => {}}
        playheadPage={playheadPos}
        onSeek={setPlayheadPos}
        beats={beatsWithLayout.filter(b => !b.isOmittedOrDisabled).map(b => ({ ...b, startPage: b.startUnit, durationPages: b.durationUnits }))}
        totalScreenplayPages={totalBoardUnits}
        appAccentColor={appAccentColor}
        playbackSpeed={1.0}
        onPlaybackSpeedChange={() => {}}
        dawThemeIsDark={!isLight}
      />
      <AISceneGeneratorModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
};

export default BoardView;