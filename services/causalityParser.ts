/**
 * Causality Story Sequencer Importer
 * 
 * Supports importing Causality project files (.cau and exported JSON, formatVersion 18-30+).
 * Correctly extracts:
 * - Real Screenplay text from Causality Snippets (converting <p class="action|character|dialogue|parenthetical|transition">
 *   into Backstage <div class="sc-line sc-..."> elements)
 * - Real Scene Headings (INT/EXT, Location, Time of Day, Scene Number) from Snippet scene data
 * - Chronological Screenplay sequence via orderLinks.timeslices
 * - Beat Synopsis into beat.summary (card outline notes)
 * - Beat Title into beat.title
 * - Characters into characterData and beat.breakdown.CAST
 * - Whiteboard coordinates, groups, and connections
 */

import { Beat, Group, Connection, CharacterData, ProjectState, Slugline, BreakdownData } from '../types';

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
    groupsCount: number;
    charactersCount: number;
    connectionsCount: number;
    screenplayWordsCount: number;
  };
  projectName?: string;
  warning?: string;
}

/**
 * Checks whether an unknown data payload matches the Causality file format.
 */
export function isCausalityData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // FormatVersion check
  if (typeof data.formatVersion === 'number') {
    return true;
  }
  
  // ObjectLinks signature
  if (data.objectLinks && typeof data.objectLinks === 'object') {
    const linkKeys = Object.keys(data.objectLinks);
    if (linkKeys.some(k => k.startsWith('Beat') || k.startsWith('Whiteboard') || k.startsWith('Snippet') || k.includes('.'))) {
      return true;
    }
  }

  // Objects dictionary signature
  if (data.objects && typeof data.objects === 'object') {
    if (data.objects.beatObjects || data.objects.snippets || data.objects.whiteboardBlocks) {
      return true;
    }
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
  const links = data.objectLinks || {};
  const rawObjects = data.objects || {};

  // Helper to extract a dictionary or array from objects regardless of naming convention
  const getObjectMap = (names: string[]): Record<string, any> => {
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
    return {};
  };

  const beatObjects = getObjectMap(['beatObjects', 'BeatObject', 'Beat', 'beats']);
  const snippets = getObjectMap(['snippets', 'Snippet', 'snippet']);
  const characters = getObjectMap(['characters', 'Character', 'character', 'CharacterObject']);
  const whiteboardBlocks = getObjectMap(['whiteboardBlocks', 'WhiteboardBlock', 'blocks']);
  const whiteboardGroups = getObjectMap(['whiteboardGroups', 'WhiteboardGroup', 'groups']);
  const beatAliases = getObjectMap(['beatAliases', 'BeatAlias', 'aliases']);

  // 1. Build Graph Links Index
  const aliasToBeat = new Map<string, string>();
  const aliasToBlock = new Map<string, string>();
  const aliasToGroup = new Map<string, string>();
  const beatToSnippet = new Map<string, string>();
  const beatToSnippets = new Map<string, string[]>();
  const beatToTimeslice = new Map<string, string>();
  const timesliceToBeat = new Map<string, string>();
  const usageToBeat = new Map<string, string>();
  const usageToChar = new Map<string, string>();
  const beatToCharacters = new Map<string, Set<string>>();

  for (const [linkName, linkList] of Object.entries(links)) {
    if (!Array.isArray(linkList)) continue;
    const lower = linkName.toLowerCase();

    for (const link of linkList) {
      if (!link.id1 || !link.id2) continue;

      if (lower === 'beatalias.beatobject' || lower.includes('alias.beat')) {
        aliasToBeat.set(link.id1, link.id2);
      } else if (lower === 'beatalias.whiteboardblock' || lower.includes('alias.block')) {
        aliasToBlock.set(link.id1, link.id2);
      } else if (lower === 'beatalias.whiteboardgroup' || lower.includes('alias.group')) {
        aliasToGroup.set(link.id1, link.id2);
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

  // 2. Reconstruct Chronological Timeslice Sequence
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

  if (timesliceHead) {
    let curr: string | undefined = timesliceHead;
    while (curr) {
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

  // 4. Extract Whiteboard Groups into Backstage Group[]
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
      color: rawGroup.color || '#3b82f6',
      boardId: 0
    });
    groupIndex++;
  }

  // Invert alias links to find blocks for each beat
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

  // 5. Build Backstage Beats with FULL SCREENPLAY and exact Scene Headings
  const beats: Beat[] = [];
  let totalScreenplayWords = 0;

  const cardWidth = 300;
  const cardHeight = 180;
  const colGap = 40;
  const rowGap = 50;
  const maxCols = 5;

  let sequentialSceneNum = 1;

  for (let i = 0; i < orderedBeatIds.length; i++) {
    const beatId = orderedBeatIds[i];
    const b = beatObjects[beatId];
    if (!b) continue;

    const bId = nextNumericId++;
    const sId = beatToSnippet.get(beatId);
    const linkedSnippetIds = beatToSnippets.get(beatId) || [];
    if (sId && !linkedSnippetIds.includes(sId)) {
      linkedSnippetIds.unshift(sId);
    }

    // Find primary snippet with scene heading data
    const sn = linkedSnippetIds.map(id => snippets[id]).find(s => s && (s.sceneLocation || s.content)) || (sId ? snippets[sId] : null);

    // A. Title & Summary
    // b.name is the beat card title; b.synopsis is the beat summary/notes
    const title = (b.name || sn?.sceneLocation || `Scene ${sequentialSceneNum}`).trim();
    const summary = (b.synopsis || '').trim();

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
        if (converted) snippetHtmlParts.push(converted);
      }
    }

    let content = '';
    if (snippetHtmlParts.length > 0) {
      content = snippetHtmlParts.join('');
      const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      totalScreenplayWords += wordCount;
    } else if (summary) {
      // If no script dialogue exists, provide the outline action
      content = `<div class="sc-line sc-action">${summary}</div>`;
    } else {
      content = `<div class="sc-line sc-action"><br></div>`;
    }

    // D. Canvas Positioning
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

    // E. Color
    const color = b.color || block?.baseColor || '#3b82f6';

    // F. Cast and Breakdown tags
    const charIds = beatToCharacters.get(beatId) || new Set<string>();
    const castList: string[] = [];

    // Add character usages
    for (const cid of charIds) {
      const cname = charIdToName.get(cid);
      if (cname && !castList.includes(cname)) {
        castList.push(cname);
      }
    }

    // Also extract character lines directly from screenplay content
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
      breakdown,
      breakdownData: breakdown
    });

    if (sn && sn.sceneNumber && typeof sn.sceneNumber.number === 'number' && sn.sceneNumber.number < 9999) {
      sequentialSceneNum = sn.sceneNumber.number + 1;
    } else {
      sequentialSceneNum++;
    }
  }

  // 6. Connect Beats Chronologically
  const connections: Connection[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    connections.push({
      from: beats[i].id,
      to: beats[i + 1].id,
      style: 'curve',
      color: beats[i].color || '#60a5fa',
      boardId: 0
    });
  }

  const resultState: Partial<ProjectState> = {
    beats,
    groups,
    connections,
    characterData,
    nextId: nextNumericId + 20,
    activeBoardId: 0
  };

  const name = data.name || (data.id ? `Causality Story (${data.id.slice(0, 8)})` : 'Causality Screenplay');

  return {
    success: beats.length > 0,
    projectState: resultState,
    projectName: name,
    stats: {
      beatsCount: beats.length,
      groupsCount: groups.length,
      charactersCount: Object.keys(characterData).length,
      connectionsCount: connections.length,
      screenplayWordsCount: totalScreenplayWords
    }
  };
}
