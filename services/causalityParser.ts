/**
 * Causality Story Sequencer Importer
 * 
 * Supports importing Causality project files (.cau and exported JSON, formatVersion 18-32+).
 * Correctly extracts:
 * - Real Screenplay text from Causality Snippets (converting <p class="action|character|dialogue|parenthetical|transition">
 *   into Backstage <div class="sc-line sc-..."> elements)
 * - Real Scene Headings (INT/EXT, Location, Time of Day, Scene Number) from Snippet scene data
 * - Chronological Screenplay sequence via orderLinks.timeslices
 * - Beat Synopsis into beat.summary (card outline notes)
 * - Beat Title into beat.title
 * - Characters into characterData and beat.breakdown.CAST
 * - Whiteboard Lanes into Backstage NLE DAW Tracks (with native lane colors and titles)
 * - Whiteboard coordinates, groups, and real cause-and-effect Dependency Connections
 * - Automatic Tamil/Indic script language detection
 */

import { Beat, Group, Connection, CharacterData, ProjectState, Slugline, BreakdownData, TimelineTrack } from '../types';

export interface CausalityLink {
  id1: string;
  id2: string;
}

export interface CausalityProjectData {
  formatVersion?: number;
  id?: string;
  objectLinks?: Record<string, CausalityLink[]>;
  orderLinks?: Record<string, CausalityLink[]>;
  objects?: Record<string, any> | any[];
  [key: string]: any;
}

export interface CausalityImportResult {
  success: boolean;
  projectState?: Partial<ProjectState>;
  stats: {
    beatsCount: number;
    disabledBeatsCount?: number;
    groupsCount: number;
    charactersCount: number;
    connectionsCount: number;
    screenplayWordsCount: number;
    lanesCount: number;
  };
  projectName?: string;
  warning?: string;
  error?: string;
  isTamilMode?: boolean;
  tracks?: TimelineTrack[];
}

export type CausalityParseResult = CausalityImportResult;

/**
 * Standard palette for tracks when lane baseColor is missing or too dark
 */
const TRACK_PALETTE = [
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#3b82f6', // Cobalt
  '#ec4899', // Pink
  '#eab308', // Gold
  '#14b8a6', // Teal
  '#64748b', // Slate
];

/**
 * Converts Causality ARGB hex color (#AARRGGBB) to CSS hex color (#RRGGBB).
 * Also safeguards against near-black or unreadable colors on dark backgrounds.
 */
export function convertCausalityColor(rawColor?: any, fallback: string = '#3b82f6'): string {
  if (rawColor === undefined || rawColor === null) return fallback;
  let str = '';
  if (typeof rawColor === 'number') {
    str = '#' + (rawColor >>> 0).toString(16).padStart(8, '0');
  } else if (typeof rawColor === 'string') {
    str = rawColor.trim();
  } else {
    return fallback;
  }
  
  if (str.startsWith('#') && str.length === 9) {
    // Causality stores ARGB #AARRGGBB -> convert to #RRGGBB
    const rgb = str.slice(3).toLowerCase();
    // Guard against pure or near-black/transparent colors which disappear on dark DAW lanes
    if (rgb === '000000' || rgb === '060101' || rgb === '0d0d0d' || rgb === '111111') {
      return fallback;
    }
    return `#${rgb}`;
  }
  
  if (str.startsWith('#') && (str.length === 7 || str.length === 4)) {
    const hex = str.slice(1).toLowerCase();
    if (hex === '000000' || hex === '000') return fallback;
    return str;
  }
  
  return fallback;
}

/**
 * Checks whether an unknown data payload matches the Causality file format.
 */
export function isCausalityData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // FormatVersion check (e.g. 18 to 35)
  if (typeof data.formatVersion === 'number') {
    return true;
  }
  
  // ObjectLinks signature
  if (data.objectLinks && typeof data.objectLinks === 'object') {
    const linkKeys = Object.keys(data.objectLinks);
    if (linkKeys.some(k => k.startsWith('Beat') || k.startsWith('Whiteboard') || k.startsWith('Snippet') || k.startsWith('Dependency') || k.includes('.'))) {
      return true;
    }
  }

  // Objects dictionary signature
  if (data.objects && typeof data.objects === 'object') {
    if (data.objects.beatObjects || data.objects.snippets || data.objects.whiteboardBlocks || data.objects.whiteboardLanes) {
      return true;
    }
  }

  // Direct root entities signature
  if (data.beatObjects || (data.snippets && data.whiteboardBlocks)) {
    return true;
  }

  return false;
}

/**
 * Converts Causality snippet HTML into Backstage screenplay HTML.
 * Causality uses:
 *   <p class="action">...</p>
 *   <p class="character">...</p>
 *   <p class="dialogue">...</p>
 *   <p class="parenthetical">...</p>
 *   <p class="transition">...</p>
 *   <p class="shot">...</p>
 *   <p class="lyrics">...</p>
 * Backstage uses:
 *   <div class="sc-line sc-action">...</div>
 *   <div class="sc-line sc-character">...</div>
 *   <div class="sc-line sc-dialogue">...</div>
 *   <div class="sc-line sc-parenthetical">...</div>
 *   <div class="sc-line sc-transition">...</div>
 */
export function convertCausalitySnippetToBackstageHtml(causalityHtml: string): string {
  if (!causalityHtml || !causalityHtml.trim()) return '';

  return causalityHtml
    .replace(/<p\s+class="([^"]+)"\s*>([\s\S]*?)<\/p>/gi, (_match, rawCls, inner) => {
      let type = String(rawCls).toLowerCase().trim();
      
      // Map Causality-specific types to Backstage supported types
      if (type === 'heading' || type === 'slugline') {
        type = 'action'; // Headings are handled by the scene slugline header in Backstage
      } else if (type === 'comment') {
        type = 'action';
      } else if (!['action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'lyrics'].includes(type)) {
        type = 'action';
      }

      // Preserve inline underline / bold / italic formatting
      const cleanedInner = inner
        .replace(/<s\s+underline="true">([\s\S]*?)<\/s>/gi, '<u>$1</u>')
        .replace(/<s\s+bold="true">([\s\S]*?)<\/s>/gi, '<b>$1</b>')
        .replace(/<s\s+italic="true">([\s\S]*?)<\/s>/gi, '<i>$1</i>')
        .replace(/<s\s+strikethrough="true">([\s\S]*?)<\/s>/gi, '<s>$1</s>')
        .trim();

      return `<div class="sc-line sc-${type}">${cleanedInner || '<br>'}</div>`;
    })
    .trim();
}

/**
 * Normalizes INT/EXT prefix into standard screenplay notation with trailing period.
 */
function normalizeIntExt(val?: string): string {
  if (!val) return 'INT.';
  const trimmed = val.trim().toUpperCase();
  if (trimmed === 'INT/EXT' || trimmed === 'I/E' || trimmed === 'I/E.') return 'INT./EXT.';
  if (trimmed === 'EXT/INT') return 'EXT./INT.';
  if (trimmed.endsWith('.')) return trimmed;
  return `${trimmed}.`;
}

/**
 * Parses a Causality project into Backstage's ProjectState format.
 */
export function parseCausalityProject(data: CausalityProjectData): CausalityImportResult {
  try {
    const links = data.objectLinks || {};
    const rawObjects = data.objects || {};

    // Helper to extract a dictionary or array from objects regardless of naming convention or nesting
    const getObjectMap = (names: string[]): Record<string, any> => {
      // 1. Check rawObjects
      for (const name of names) {
        const val = (rawObjects as any)[name];
        if (val && typeof val === 'object') {
          if (Array.isArray(val)) {
            const map: Record<string, any> = {};
            for (const item of val) {
              if (item && item.id) map[item.id] = item;
            }
            return map;
          }
          return val;
        }
      }

      // 2. Check top-level data
      for (const name of names) {
        const val = (data as any)[name];
        if (val && typeof val === 'object') {
          if (Array.isArray(val)) {
            const map: Record<string, any> = {};
            for (const item of val) {
              if (item && item.id) map[item.id] = item;
            }
            return map;
          }
          return val;
        }
      }

      // 3. Check data.project or data.document
      const subContainer = (data as any).project || (data as any).document;
      if (subContainer && typeof subContainer === 'object') {
        for (const name of names) {
          const val = subContainer[name];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              const map: Record<string, any> = {};
              for (const item of val) {
                if (item && item.id) map[item.id] = item;
              }
              return map;
            }
            return val;
          }
        }
      }

      // 4. Flat array of typed objects
      if (Array.isArray(rawObjects)) {
        const map: Record<string, any> = {};
        for (const item of rawObjects) {
          const itemType = (item?.$type || item?.type || '').toLowerCase();
          if (names.some(n => itemType.includes(n.toLowerCase())) && item?.id) {
            map[item.id] = item;
          }
        }
        if (Object.keys(map).length > 0) return map;
      }

      return {};
    };

    const beatObjects = getObjectMap(['beatObjects', 'BeatObject', 'Beat', 'beats']);
    const snippets = getObjectMap(['snippets', 'Snippet', 'snippet']);
    const characters = getObjectMap(['characters', 'Character', 'character', 'CharacterObject']);
    const whiteboardBlocks = getObjectMap(['whiteboardBlocks', 'WhiteboardBlock', 'blocks']);
    const whiteboardGroups = getObjectMap(['whiteboardGroups', 'WhiteboardGroup', 'groups']);
    const whiteboardLanes = getObjectMap(['whiteboardLanes', 'WhiteboardLane', 'lanes', 'laneObjects', 'timelineTracks', 'timeTracks', 'tracks', 'Track', 'Lane']);

    // 1. Build Graph Links Index
    const aliasToBeat = new Map<string, string>();
    const aliasToBlock = new Map<string, string>();
    const aliasToGroup = new Map<string, string>();
    const groupToBlock = new Map<string, string>();
    const blockToLane = new Map<string, string>();
    const beatToDirectLane = new Map<string, string>();
    const beatToSnippet = new Map<string, string>();
    const beatToSnippets = new Map<string, string[]>();
    const beatToTimeslice = new Map<string, string>();
    const timesliceToBeat = new Map<string, string>();
    const usageToBeat = new Map<string, string>();
    const usageToChar = new Map<string, string>();
    const beatToCharacters = new Map<string, Set<string>>();

    // Causality dependency links
    const connSource = new Map<string, string>();
    const connDest = new Map<string, string>();
    const depObjectToBeat = new Map<string, string>();

    for (const [linkName, linkList] of Object.entries(links)) {
      if (!Array.isArray(linkList)) continue;
      const lower = linkName.toLowerCase();

      for (const link of linkList) {
        if (!link.id1 || !link.id2) continue;

        if (lower === 'beatalias.beatobject' || lower.includes('alias.beat')) {
          aliasToBeat.set(link.id1, link.id2);
        } else if (lower === 'beatalias.whiteboardblock' || lower.includes('alias.whiteboardblock')) {
          aliasToBlock.set(link.id1, link.id2);
        } else if (lower === 'beatalias.whiteboardgroup' || lower.includes('alias.whiteboardgroup')) {
          aliasToGroup.set(link.id1, link.id2);
        } else if (lower === 'whiteboardgroup.whiteboardblock') {
          groupToBlock.set(link.id1, link.id2);
        } else if (lower === 'whiteboardblock.whiteboardlane' || lower.includes('block.whiteboardlane') || lower.includes('block.lane')) {
          blockToLane.set(link.id1, link.id2);
        } else if (lower === 'whiteboardlane.whiteboardblock' || lower.includes('lane.whiteboardblock') || lower.includes('lane.block')) {
          blockToLane.set(link.id2, link.id1);
        } else if (lower.includes('lane') || lower.includes('track')) {
          if (whiteboardBlocks[link.id1] && whiteboardLanes[link.id2]) {
            blockToLane.set(link.id1, link.id2);
          } else if (whiteboardLanes[link.id1] && whiteboardBlocks[link.id2]) {
            blockToLane.set(link.id2, link.id1);
          } else if (beatObjects[link.id1] && whiteboardLanes[link.id2]) {
            beatToDirectLane.set(link.id1, link.id2);
          } else if (whiteboardLanes[link.id1] && beatObjects[link.id2]) {
            beatToDirectLane.set(link.id2, link.id1);
          }
        } else if (lower === 'beatobject.activesnippet' || lower === 'snippet.beatobject') {
          // In Causality, id1 is BeatObject and id2 is Snippet
          beatToSnippet.set(link.id1, link.id2);
          const list = beatToSnippets.get(link.id1) || [];
          if (!list.includes(link.id2)) list.push(link.id2);
          beatToSnippets.set(link.id1, list);
        } else if (lower === 'beatobject.timeslice') {
          beatToTimeslice.set(link.id1, link.id2);
          timesliceToBeat.set(link.id2, link.id1);
        } else if (lower === 'beatcharacterusage.beatobject') {
          usageToBeat.set(link.id1, link.id2);
        } else if (lower === 'beatcharacterusage.character') {
          usageToChar.set(link.id1, link.id2);
        } else if (lower === 'dependencyconnection.sourceobject') {
          connSource.set(link.id1, link.id2);
        } else if (lower === 'dependencyconnection.destinationobject') {
          connDest.set(link.id1, link.id2);
        } else if (lower === 'dependencyobject.sourcebeat') {
          depObjectToBeat.set(link.id1, link.id2);
        }
      }
    }

    // Resolve Beat -> Characters mapping
    for (const [usageId, beatId] of usageToBeat.entries()) {
      const charId = usageToChar.get(usageId);
      if (charId) {
        const set = beatToCharacters.get(beatId) || new Set<string>();
        set.add(charId);
        beatToCharacters.set(beatId, set);
      }
    }

    // Partial recovery mode: If beatObjects is empty but aliasToBeat links exist (e.g. outline export)
    if (Object.keys(beatObjects).length === 0 && aliasToBeat.size > 0) {
      let counter = 1;
      for (const [_aliasId, beatGuid] of aliasToBeat.entries()) {
        if (!beatObjects[beatGuid]) {
          beatObjects[beatGuid] = {
            id: beatGuid,
            name: `Scene ${counter++}`,
            synopsis: ''
          };
        }
      }
    }

    // 2. Reconstruct Chronological Timeslice Sequence with Cycle-Safety Guard
    const orderList = data.orderLinks?.timeslices || [];
    const nextTimeslice = new Map<string, string>();
    const prevTimeslice = new Map<string, string>();

    for (const link of orderList) {
      if (link.id1 && link.id2) {
        nextTimeslice.set(link.id1, link.id2);
        prevTimeslice.set(link.id2, link.id1);
      }
    }

    let timesliceHead: string | null = null;
    for (const link of orderList) {
      if (!prevTimeslice.has(link.id1)) {
        timesliceHead = link.id1;
        break;
      }
    }

    const orderedBeatIds: string[] = [];
    const visitedBeatIds = new Set<string>();
    const visitedTimeslices = new Set<string>();

    if (timesliceHead) {
      let curr: string | undefined = timesliceHead;
      while (curr && !visitedTimeslices.has(curr)) {
        visitedTimeslices.add(curr);
        const bId = timesliceToBeat.get(curr);
        if (bId && beatObjects[bId] && !visitedBeatIds.has(bId)) {
          orderedBeatIds.push(bId);
          visitedBeatIds.add(bId);
        }
        curr = nextTimeslice.get(curr);
      }
    }

    // Also include any remaining beats that were not on the timeslice list
    for (const bId of Object.keys(beatObjects)) {
      if (!visitedBeatIds.has(bId)) {
        orderedBeatIds.push(bId);
        visitedBeatIds.add(bId);
      }
    }

    // 3. Extract Characters into Backstage CharacterData
    const characterData: Record<string, CharacterData> = {};
    const charIdToName = new Map<string, string>();

    for (const [rawId, rawChar] of Object.entries(characters)) {
      const name = String(rawChar.name || rawChar.title || 'UNNAMED').trim().toUpperCase();
      const id = rawChar.id || rawId;
      charIdToName.set(id, name);
      charIdToName.set(rawId, name);

      characterData[name] = {
        id,
        name,
        age: Number(rawChar.age) || 30,
        gender: rawChar.gender || 'Unknown',
        ethnicity: rawChar.ethnicity || 'Unknown',
        hair: rawChar.hair || '',
        eyes: rawChar.eyes || '',
        build: rawChar.build || '',
        occupation: rawChar.occupation || '',
        archetype: rawChar.archetype || rawChar.role || 'Supporting',
        physiology: rawChar.physiology || '',
        sociology: rawChar.sociology || '',
        psychology: rawChar.psychology || '',
        backstory: rawChar.backstory || rawChar.description || '',
        images: rawChar.images || [],
        relationships: [],
        billingTier: rawChar.isLead ? 'lead' : 'supporting'
      };
    }

    // 4. Extract Whiteboard Lanes into TimelineTrack[]
    const sortedLaneEntries = Object.entries(whiteboardLanes).sort(([_aId, a], [_bId, b]) => {
      const idxA = typeof a.indexHint === 'number' ? a.indexHint : (typeof a.order === 'number' ? a.order : (typeof a.index === 'number' ? a.index : (typeof a.y === 'number' ? a.y : 999)));
      const idxB = typeof b.indexHint === 'number' ? b.indexHint : (typeof b.order === 'number' ? b.order : (typeof b.index === 'number' ? b.index : (typeof b.y === 'number' ? b.y : 999)));
      return idxA - idxB;
    });

    const tracks: TimelineTrack[] = [];
    const laneIdToTrackIndex = new Map<string, number>();

    sortedLaneEntries.forEach(([laneId, lane], idx) => {
      const trackNum = idx + 1;
      const trackColor = convertCausalityColor(lane.baseColor || lane.color, TRACK_PALETTE[idx % TRACK_PALETTE.length]);
      tracks.push({
        id: `v${trackNum}`,
        label: (lane.name || lane.title || lane.label || `Track ${trackNum}`).trim(),
        type: idx === 0 ? 'main' : idx === 1 ? 'subplot' : 'parallel',
        color: trackColor,
        height: 112,
        volume: 80,
        subtrackCount: 0
      });
      laneIdToTrackIndex.set(laneId, idx);
      if (lane.id) laneIdToTrackIndex.set(lane.id, idx);
    });

    // Invert alias links to find blocks and groups for each beat
    const beatToBlock = new Map<string, any>();
    const beatToGroup = new Map<string, any>();

    for (const [aliasId, beatId] of aliasToBeat.entries()) {
      const blockId = aliasToBlock.get(aliasId);
      if (blockId && whiteboardBlocks[blockId]) {
        beatToBlock.set(beatId, whiteboardBlocks[blockId]);
      }
      const groupId = aliasToGroup.get(aliasId);
      if (groupId && whiteboardGroups[groupId]) {
        beatToGroup.set(beatId, whiteboardGroups[groupId]);
      }
    }

    // Resolve Beat -> Lane ID mapping (Multi-Strategy Resolution)
    const beatToLaneId = new Map<string, string>();

    // Strategy A: Direct Beat -> Lane links
    for (const [beatId, laneId] of beatToDirectLane.entries()) {
      beatToLaneId.set(beatId, laneId);
    }

    // Strategy B: Direct lane properties on Beat object
    for (const [beatId, b] of Object.entries(beatObjects)) {
      const directLane = (b as any).laneId || (b as any).whiteboardLaneId || (b as any).lane || (b as any).trackId || (b as any).track;
      if (directLane && (laneIdToTrackIndex.has(directLane) || typeof directLane === 'string')) {
        beatToLaneId.set(beatId, directLane);
      }
    }

    // Strategy C: Beat Alias -> Block -> Lane
    for (const [aliasId, beatId] of aliasToBeat.entries()) {
      let blockId = aliasToBlock.get(aliasId);
      if (!blockId) {
        const groupId = aliasToGroup.get(aliasId);
        if (groupId) {
          blockId = groupToBlock.get(groupId);
        }
      }
      if (blockId) {
        const blk = whiteboardBlocks[blockId];
        const laneId = blockToLane.get(blockId) || blk?.laneId || blk?.whiteboardLaneId || blk?.lane || blk?.parentLaneId;
        if (laneId && !beatToLaneId.has(beatId)) {
          beatToLaneId.set(beatId, laneId);
        }
      }
    }

    // Strategy D: Spatial Y-Containment Fallback (if lanes exist and blocks have Y coordinates)
    const lanesWithY = sortedLaneEntries
      .filter(([_id, lane]) => typeof lane.y === 'number' || typeof lane.top === 'number')
      .map(([id, lane], idx) => ({
        id,
        idx,
        y: typeof lane.y === 'number' ? lane.y : (lane.top ?? idx * 500),
        height: typeof lane.height === 'number' ? lane.height : (lane.userSize?.height ?? 500)
      }))
      .sort((a, b) => a.y - b.y);

    if (lanesWithY.length > 0) {
      for (const beatId of orderedBeatIds) {
        if (beatToLaneId.has(beatId)) continue;
        const blk = beatToBlock.get(beatId);
        if (blk && typeof blk.y === 'number') {
          let matchedLane = lanesWithY.find((l, idx) => {
            const nextLane = lanesWithY[idx + 1];
            const bottom = nextLane ? nextLane.y : l.y + l.height;
            return blk.y >= l.y && blk.y < bottom;
          });
          if (!matchedLane) {
            let closestDist = Infinity;
            for (const l of lanesWithY) {
              const dist = Math.abs(blk.y - l.y);
              if (dist < closestDist) {
                closestDist = dist;
                matchedLane = l;
              }
            }
          }
          if (matchedLane) {
            beatToLaneId.set(beatId, matchedLane.id);
          }
        }
      }
    }

    // Strategy E: Horizontal Row Clustering Fallback (if no lanes exist at all in file)
    if (tracks.length === 0) {
      const yValues: number[] = [];
      for (const [aliasId, beatId] of aliasToBeat.entries()) {
        const blockId = aliasToBlock.get(aliasId);
        const block = blockId ? whiteboardBlocks[blockId] : null;
        if (block && typeof block.y === 'number') {
          yValues.push(block.y);
        }
      }

      const sortedY = [...new Set(yValues.map(y => Math.round(y / 150) * 150))].sort((a, b) => a - b);
      if (sortedY.length > 1) {
        sortedY.forEach((clusterY, idx) => {
          const tId = `cluster_${clusterY}`;
          laneIdToTrackIndex.set(tId, idx);
          tracks.push({
            id: `v${idx + 1}`,
            label: idx === 0 ? 'A-Story / Main Thread' : idx === 1 ? 'B-Story / Subplot' : `Lane ${idx + 1}`,
            type: idx === 0 ? 'main' : idx === 1 ? 'subplot' : 'parallel',
            color: TRACK_PALETTE[idx % TRACK_PALETTE.length],
            height: 112,
            volume: 80,
            subtrackCount: 0
          });
        });

        for (const beatId of orderedBeatIds) {
          const blk = beatToBlock.get(beatId);
          if (blk && typeof blk.y === 'number') {
            const clusterKey = `cluster_${Math.round(blk.y / 150) * 150}`;
            beatToLaneId.set(beatId, clusterKey);
          }
        }
      } else {
        tracks.push(
          { id: 'v1', label: 'A-Story / Main Protagonist', type: 'main', color: '#06b6d4', height: 112, volume: 85, subtrackCount: 0 },
          { id: 'v2', label: 'B-Story / Allies & Romance', type: 'subplot', color: '#f59e0b', height: 112, volume: 75, subtrackCount: 0 },
          { id: 'v3', label: 'Antagonist & Obstacles', type: 'parallel', color: '#f43f5e', height: 112, volume: 80, subtrackCount: 0 },
          { id: 'v4', label: 'Atmosphere, Tone & B-Roll', type: 'broll', color: '#a855f7', height: 112, volume: 60, subtrackCount: 0 },
          { id: 'v5', label: 'Theme & Philosophy', type: 'theme', color: '#10b981', height: 112, volume: 70, subtrackCount: 0 }
        );
      }
    }

    // 5. Extract Whiteboard Groups into Backstage Group[]
    const groups: Group[] = [];
    const groupIdToBackstageId = new Map<string, number>();
    let nextNumericId = 1;

    let groupIndex = 0;
    for (const [rawId, rawGroup] of Object.entries(whiteboardGroups)) {
      const gId = nextNumericId++;
      groupIdToBackstageId.set(rawId, gId);
      if (rawGroup.id) groupIdToBackstageId.set(rawGroup.id, gId);

      const title = rawGroup.name || rawGroup.title || `Act ${groupIndex + 1}`;
      const x = typeof rawGroup.x === 'number' ? rawGroup.x : groupIndex * 620;
      const y = typeof rawGroup.y === 'number' ? rawGroup.y : 50;
      const width = rawGroup.userSize?.width || rawGroup.width || 560;
      const height = rawGroup.userSize?.height || rawGroup.height || 850;

      groups.push({
        id: gId,
        title,
        x,
        y,
        width,
        height,
        color: convertCausalityColor(rawGroup.color, TRACK_PALETTE[groupIndex % TRACK_PALETTE.length]),
        boardId: 0
      });
      groupIndex++;
    }

    // 6. Build Backstage Beats with FULL SCREENPLAY and exact Scene Headings
    const beats: Beat[] = [];
    const beatGuidToNumericId = new Map<string, number>();
    let totalScreenplayWords = 0;
    let disabledBeatsCount = 0;

    const cardWidth = 300;
    const cardHeight = 180;
    const colGap = 40;
    const rowGap = 50;
    const maxCols = 5;

    let sequentialSceneNum = 1;
    let accumulatedTimelinePage = 1.0;
    let hasTamilContent = false;
    const tamilRegex = /[\u0B80-\u0BFF]/;

    for (let i = 0; i < orderedBeatIds.length; i++) {
      const beatId = orderedBeatIds[i];
      const b = beatObjects[beatId];
      if (!b) continue;

      const bId = nextNumericId++;
      beatGuidToNumericId.set(beatId, bId);
      if (b.id) beatGuidToNumericId.set(b.id, bId);

      const sId = beatToSnippet.get(beatId);
      const linkedSnippetIds = beatToSnippets.get(beatId) || [];
      if (sId && !linkedSnippetIds.includes(sId)) {
        linkedSnippetIds.unshift(sId);
      }

      // Find primary snippet with scene heading data
      const sn = linkedSnippetIds.map(id => snippets[id]).find(s => s && (s.sceneLocation || s.content)) || (sId ? snippets[sId] : null);

      // A. Title & Summary
      const title = (b.name || sn?.sceneLocation || `Scene ${sequentialSceneNum}`).trim();
      const summary = (b.synopsis || '').trim();

      // Check for Tamil in title/summary
      if (!hasTamilContent && (tamilRegex.test(title) || tamilRegex.test(summary))) {
        hasTamilContent = true;
      }

      // B. Scene Number & Slugline from Snippet
      let sceneNumberStr = '';
      if (sn && sn.sceneNumber && typeof sn.sceneNumber.number === 'number' && sn.sceneNumber.number < 9999) {
        sceneNumberStr = `${sn.sceneNumber.number}${sn.sceneNumber.letters || ''}`;
      } else {
        sceneNumberStr = `${sequentialSceneNum}`;
      }

      const prefix = normalizeIntExt(sn?.sceneIntExt);
      const location = (sn?.sceneLocation || title || 'SCENE').toUpperCase().trim();
      const time = (sn?.sceneTime || 'DAY').toUpperCase().trim();

      const slug: Slugline = {
        prefix,
        location,
        time
      };

      // C. Screenplay Content (FULL SCREENPLAY from Snippets)
      const snippetHtmlParts: string[] = [];
      for (const snId of linkedSnippetIds) {
        const snObj = snippets[snId];
        if (snObj && snObj.content && snObj.content.trim()) {
          const converted = convertCausalitySnippetToBackstageHtml(snObj.content);
          if (converted) {
            snippetHtmlParts.push(converted);
            if (!hasTamilContent && tamilRegex.test(converted)) {
              hasTamilContent = true;
            }
          }
        }
      }

      let content = '';
      if (snippetHtmlParts.length > 0) {
        content = snippetHtmlParts.join('');
        const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
        totalScreenplayWords += wordCount;
      } else if (summary) {
        // Outline action fallback
        content = `<div class="sc-line sc-action">${summary}</div>`;
      } else {
        content = `<div class="sc-line sc-action"><br></div>`;
      }

      // D. Narrative Track Mapping
      let assignedTrackIdx = 0;
      const laneId = beatToLaneId.get(beatId);
      if (laneId && laneIdToTrackIndex.has(laneId)) {
        assignedTrackIdx = laneIdToTrackIndex.get(laneId)!;
      } else if (typeof (b as any).trackIndex === 'number') {
        assignedTrackIdx = (b as any).trackIndex;
      }
      if (assignedTrackIdx < 0 || assignedTrackIdx >= tracks.length) {
        assignedTrackIdx = 0;
      }
      const track = tracks[assignedTrackIdx] || tracks[0];

      // E. Canvas Positioning & Timeline Placement
      const block = beatToBlock.get(beatId);
      let x = 100 + (i % maxCols) * (cardWidth + colGap);
      let y = 100 + Math.floor(i / maxCols) * (cardHeight + rowGap);
      let w = cardWidth;
      let h = cardHeight;

      if (block) {
        if (typeof block.x === 'number') x = block.x;
        if (typeof block.y === 'number') y = block.y;
        if (block.userSize?.width) w = block.userSize.width;
        if (block.userSize?.height) h = block.userSize.height;
      }

      // Check if beat or its block/snippet is disabled in Causality
      const isBlockDisabled = block && (
        block.blockState === 'ObjectState.Disabled' ||
        block.blockState === 'Disabled' ||
        block.blockState === 1 ||
        String(block.blockState || '').toLowerCase().includes('disable') ||
        block.state === 'ObjectState.Disabled' ||
        block.state === 'Disabled' ||
        block.state === 1 ||
        String(block.state || '').toLowerCase().includes('disable') ||
        block.disabled === true ||
        block.isDisabled === true ||
        block.enabled === false
      );

      const isSnippetDisabled = sn && (
        sn.state === 'ObjectState.Disabled' ||
        sn.state === 'Disabled' ||
        sn.disabled === true ||
        sn.isOmitted === true
      );

      const isBeatDisabled = 
        b.beatState === 'ObjectState.Disabled' || 
        b.beatState === 'Disabled' || 
        b.beatState === 1 || 
        String(b.beatState || '').toLowerCase().includes('disable') ||
        b.state === 'ObjectState.Disabled' || 
        b.state === 'Disabled' || 
        b.state === 'disabled' || 
        b.state === 1 || 
        String(b.state || '').toLowerCase().includes('disable') ||
        (b as any).disabled === true || 
        (b as any).isDisabled === true || 
        (b as any).enabled === false ||
        (b as any).active === false ||
        (b as any).isOmitted === true ||
        (b as any).omitted === true;

      const isUnsequencedInCausality = orderList.length > 0 && !beatToTimeslice.has(beatId) && !b.name?.toLowerCase().includes('scene');

      const isDisabled = Boolean(isBeatDisabled || isBlockDisabled || isSnippetDisabled || isUnsequencedInCausality);

      if (isDisabled) {
        disabledBeatsCount++;
        // Exclude disabled / omitted Causality beats from the imported screenplay
        continue;
      }

      // Calculate screenplay page duration from word count
      const wordCount = (content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      const durationPages = Math.max(1.0, Math.min(8.0, Math.round((wordCount / 220) * 2) / 2 || 2.0));
      const startTime = accumulatedTimelinePage;
      const durationWidth = Math.round(durationPages * 48); // 48px per page standard scale
      accumulatedTimelinePage += durationPages;

      // F. Color
      const color = convertCausalityColor(b.color || block?.baseColor || track.color, track.color);

      // G. Cast and Breakdown tags
      const charIds = beatToCharacters.get(beatId) || new Set<string>();
      const castList: string[] = [];

      for (const cid of charIds) {
        const cname = charIdToName.get(cid);
        if (cname && !castList.includes(cname)) {
          castList.push(cname);
        }
      }

      if (content) {
        const charMatches = content.matchAll(/<div class="sc-line sc-character">([^<]+)<\/div>/gi);
        for (const m of charMatches) {
          const charName = m[1].replace(/\s*\([^)]*\)/g, '').trim().toUpperCase();
          if (charName && !castList.includes(charName)) {
            castList.push(charName);
          }
        }
      }

      const breakdown: BreakdownData = {
        CAST: castList,
        cast: castList,
        props: [],
        sound: [],
        costume: [],
        vfx: [],
        practical: [],
        location: [location]
      };

      const grp = beatToGroup.get(beatId);
      const grpId = grp && grp.id ? groupIdToBackstageId.get(grp.id) : undefined;
      const grpTitle = grp ? (grp.name || grp.title) : undefined;

      beats.push({
        id: bId,
        x,
        y,
        w,
        h,
        title,
        summary,
        sceneNumber: sceneNumberStr,
        slug,
        content,
        color,
        shots: [],
        status: 'ready',
        notes: [],
        versions: [],
        boardId: 0,
        trackIndex: assignedTrackIdx,
        subtrackIndex: 0,
        startTime,
        durationPages,
        durationWidth,
        breakdown,
        breakdownData: breakdown,
        groupId: grpId,
        groupTitle: grpTitle,
        isDisabled
      });

      if (sn && sn.sceneNumber && typeof sn.sceneNumber.number === 'number' && sn.sceneNumber.number < 9999) {
        sequentialSceneNum = sn.sceneNumber.number + 1;
      } else {
        sequentialSceneNum++;
      }
    }

    // 7. Extract Real Causality Dependency Connections (ONLY actual user-created links)
    const connections: Connection[] = [];
    const connectedPairs = new Set<string>();

    for (const [connId, rawSrc] of connSource.entries()) {
      const rawDst = connDest.get(connId);
      if (rawDst) {
        const srcBeatGuid = depObjectToBeat.get(rawSrc) || rawSrc;
        const dstBeatGuid = depObjectToBeat.get(rawDst) || rawDst;
        const fromNum = beatGuidToNumericId.get(srcBeatGuid);
        const toNum = beatGuidToNumericId.get(dstBeatGuid);
        if (fromNum && toNum && fromNum !== toNum) {
          const pairKey = `${fromNum}->${toNum}`;
          if (!connectedPairs.has(pairKey)) {
            connectedPairs.add(pairKey);
            connections.push({
              from: fromNum,
              to: toNum,
              style: 'curve',
              color: '#f59e0b', // Studio Amber dependency connector
              boardId: 0
            });
          }
        }
      }
    }

    const resultState: Partial<ProjectState> = {
      beats,
      groups,
      connections,
      characterData,
      tracks,
      nextId: nextNumericId + 20,
      activeBoardId: 0,
      isTamilMode: hasTamilContent
    };

    const name = data.name || (data.id ? `Causality Story (${data.id.slice(1, 9)})` : 'Causality Screenplay');

    return {
      success: beats.length > 0,
      projectState: resultState,
      projectName: name,
      isTamilMode: hasTamilContent,
      tracks,
      stats: {
        beatsCount: beats.length,
        disabledBeatsCount,
        groupsCount: groups.length,
        charactersCount: Object.keys(characterData).length,
        connectionsCount: connections.length,
        screenplayWordsCount: totalScreenplayWords,
        lanesCount: tracks.length
      }
    };
  } catch (err: any) {
    console.error('Failed to parse Causality project', err);
    return {
      success: false,
      error: err?.message || 'Unknown error while parsing Causality project',
      stats: {
        beatsCount: 0,
        groupsCount: 0,
        charactersCount: 0,
        connectionsCount: 0,
        screenplayWordsCount: 0,
        lanesCount: 0
      }
    };
  }
}
