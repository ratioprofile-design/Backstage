/**
 * High-Performance Myers O(ND) Script Revision Diff Engine
 * Features:
 * - 32-bit FNV-1a line hashing for integer-level comparisons
 * - Common prefix & common suffix trimming for sub-millisecond execution
 * - Int32Array typed vector buffer for zero-GC inner snake loops
 * - Scene-level screenplay delta tracking with page shift calculation
 */

export enum DiffOp {
  EQUAL = 0,
  INSERT = 1,
  DELETE = 2
}

export interface DiffLine {
  op: DiffOp;
  lineA: number; // 1-indexed, 0 if INSERT
  lineB: number; // 1-indexed, 0 if DELETE
  text: string;
}

export interface DiffHunk {
  startLineA: number;
  countA: number;
  startLineB: number;
  countB: number;
  lines: DiffLine[];
}

export interface ElementDelta {
  category: string; // CAST, PROPS, STUNTS, SFX, VFX, etc.
  name: string;
  isAdded: boolean; // true = added in Rev B, false = removed from Rev A
}

export interface SceneDiffResult {
  sceneId: string;
  sceneNumber: string;
  status: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  titleA?: string;
  titleB?: string;
  pageShiftEighths: number;
  hunks: DiffHunk[];
  elementDeltas: ElementDelta[];
}

export interface ScriptDiffSummary {
  addedScenesCount: number;
  removedScenesCount: number;
  modifiedScenesCount: number;
  unchangedScenesCount: number;
  netPageShiftEighths: number;
  scenes: SceneDiffResult[];
  totalInsertions: number;
  totalDeletions: number;
  executionTimeMs: number;
}

export interface ScriptSceneInput {
  id: string;
  sceneNumber: string;
  heading: string;
  scriptText: string;
  pageEighths?: number;
  breakdownItems?: Array<{ category: string; name: string }>;
}

/**
 * 32-bit FNV-1a Hash for fast line comparisons
 */
export function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Split text into array of clean lines without trailing CR
 */
export function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith('\r')) {
      lines[i] = lines[i].slice(0, -1);
    }
  }
  return lines;
}

/**
 * High-Speed Line-level Myers Diff
 */
export function diffLines(textA: string, textB: string): DiffLine[] {
  const result: DiffLine[] = [];
  const linesA = splitLines(textA);
  const linesB = splitLines(textB);

  const N = linesA.length;
  const M = linesB.length;

  if (N === 0 && M === 0) return result;

  if (N === 0) {
    for (let j = 0; j < M; j++) {
      result.push({ op: DiffOp.INSERT, lineA: 0, lineB: j + 1, text: linesB[j] });
    }
    return result;
  }

  if (M === 0) {
    for (let i = 0; i < N; i++) {
      result.push({ op: DiffOp.DELETE, lineA: i + 1, lineB: 0, text: linesA[i] });
    }
    return result;
  }

  // Pre-calculate line hashes
  const hashesA = new Uint32Array(N);
  for (let i = 0; i < N; i++) hashesA[i] = fnv1a32(linesA[i]);

  const hashesB = new Uint32Array(M);
  for (let j = 0; j < M; j++) hashesB[j] = fnv1a32(linesB[j]);

  // Fast-path: Common Prefix
  let prefix = 0;
  while (prefix < N && prefix < M && hashesA[prefix] === hashesB[prefix] && linesA[prefix] === linesB[prefix]) {
    result.push({ op: DiffOp.EQUAL, lineA: prefix + 1, lineB: prefix + 1, text: linesA[prefix] });
    prefix++;
  }

  // Fast-path: Common Suffix
  let suffix = 0;
  while (
    suffix < (N - prefix) && 
    suffix < (M - prefix) && 
    hashesA[N - 1 - suffix] === hashesB[M - 1 - suffix] && 
    linesA[N - 1 - suffix] === linesB[M - 1 - suffix]
  ) {
    suffix++;
  }

  const subN = N - prefix - suffix;
  const subM = M - prefix - suffix;

  if (subN > 0 || subM > 0) {
    const maxD = subN + subM;
    const offset = maxD;
    const vSize = 2 * maxD + 1;
    const V = new Int32Array(vSize);
    const trace: Int32Array[] = [];

    let reachedD = -1;

    for (let d = 0; d <= maxD; d++) {
      trace.push(new Int32Array(V));
      for (let k = -d; k <= d; k += 2) {
        let x = 0;
        if (k === -d || (k !== d && V[k - 1 + offset] < V[k + 1 + offset])) {
          x = V[k + 1 + offset]; // down (insertion)
        } else {
          x = V[k - 1 + offset] + 1; // right (deletion)
        }
        let y = x - k;

        // Snake: match identical lines
        while (
          x < subN && 
          y < subM && 
          hashesA[prefix + x] === hashesB[prefix + y] && 
          linesA[prefix + x] === linesB[prefix + y]
        ) {
          x++;
          y++;
        }

        V[k + offset] = x;

        if (x >= subN && y >= subM) {
          reachedD = d;
          break;
        }
      }
      if (reachedD !== -1) break;
    }

    // Backtrack snake path
    if (reachedD !== -1) {
      const middleDiff: DiffLine[] = [];
      let curX = subN;
      let curY = subM;

      for (let backD = reachedD; backD > 0; backD--) {
        const prevV = trace[backD];
        const curK = curX - curY;
        let prevK = 0;

        if (curK === -backD || (curK !== backD && prevV[curK - 1 + offset] < prevV[curK + 1 + offset])) {
          prevK = curK + 1;
        } else {
          prevK = curK - 1;
        }

        const prevX = prevV[prevK + offset];
        const prevY = prevX - prevK;

        while (curX > prevX && curY > prevY) {
          curX--;
          curY--;
          middleDiff.push({
            op: DiffOp.EQUAL,
            lineA: prefix + curX + 1,
            lineB: prefix + curY + 1,
            text: linesA[prefix + curX]
          });
        }

        if (curX > prevX) {
          curX--;
          middleDiff.push({
            op: DiffOp.DELETE,
            lineA: prefix + curX + 1,
            lineB: 0,
            text: linesA[prefix + curX]
          });
        } else if (curY > prevY) {
          curY--;
          middleDiff.push({
            op: DiffOp.INSERT,
            lineA: 0,
            lineB: prefix + curY + 1,
            text: linesB[prefix + curY]
          });
        }
      }

      while (curX > 0 && curY > 0) {
        curX--;
        curY--;
        middleDiff.push({
          op: DiffOp.EQUAL,
          lineA: prefix + curX + 1,
          lineB: prefix + curY + 1,
          text: linesA[prefix + curX]
        });
      }

      middleDiff.reverse();
      for (let i = 0; i < middleDiff.length; i++) {
        result.push(middleDiff[i]);
      }
    }
  }

  // Append suffix EQUALs
  for (let s = 0; s < suffix; s++) {
    const idxA = N - suffix + s;
    const idxB = M - suffix + s;
    result.push({
      op: DiffOp.EQUAL,
      lineA: idxA + 1,
      lineB: idxB + 1,
      text: linesA[idxA]
    });
  }

  return result;
}

/**
 * Group diff lines into contextual hunks (e.g. 3 lines of surrounding context)
 */
export function createHunks(lines: DiffLine[], contextLines: number = 3): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  if (lines.length === 0) return hunks;

  const total = lines.length;
  let i = 0;

  while (i < total) {
    if (lines[i].op === DiffOp.EQUAL) {
      i++;
      continue;
    }

    const hunkStart = (i > contextLines) ? (i - contextLines) : 0;
    let hunkEnd = i;

    while (hunkEnd < total) {
      if (lines[hunkEnd].op !== DiffOp.EQUAL) {
        hunkEnd++;
      } else {
        let lookAhead = hunkEnd;
        let foundAnotherChange = false;
        while (lookAhead < total && (lookAhead - hunkEnd) <= (2 * contextLines)) {
          if (lines[lookAhead].op !== DiffOp.EQUAL) {
            foundAnotherChange = true;
            hunkEnd = lookAhead + 1;
            break;
          }
          lookAhead++;
        }
        if (!foundAnotherChange) {
          hunkEnd = Math.min(total, hunkEnd + contextLines);
          break;
        }
      }
    }

    const hunkLines = lines.slice(hunkStart, hunkEnd);
    let countA = 0;
    let countB = 0;
    let firstLineA = 0;
    let firstLineB = 0;

    for (const l of hunkLines) {
      if (l.op === DiffOp.EQUAL) {
        if (firstLineA === 0) firstLineA = l.lineA;
        if (firstLineB === 0) firstLineB = l.lineB;
        countA++;
        countB++;
      } else if (l.op === DiffOp.DELETE) {
        if (firstLineA === 0) firstLineA = l.lineA;
        countA++;
      } else if (l.op === DiffOp.INSERT) {
        if (firstLineB === 0) firstLineB = l.lineB;
        countB++;
      }
    }

    hunks.push({
      startLineA: firstLineA,
      countA,
      startLineB: firstLineB,
      countB,
      lines: hunkLines
    });

    i = hunkEnd;
  }

  return hunks;
}

/**
 * Compare entire screenplay drafts with scene-level tracking, line diffs, and element deltas
 */
export function compareScriptDrafts(
  scenesA: ScriptSceneInput[],
  scenesB: ScriptSceneInput[]
): ScriptDiffSummary {
  const t0 = performance.now();

  const mapA = new Map<string, ScriptSceneInput>();
  const mapB = new Map<string, ScriptSceneInput>();

  for (const s of scenesA) mapA.set(s.sceneNumber.trim(), s);
  for (const s of scenesB) mapB.set(s.sceneNumber.trim(), s);

  // Preserve scene order
  const allNumbers: string[] = [];
  for (const s of scenesA) allNumbers.push(s.sceneNumber.trim());
  for (const s of scenesB) {
    const num = s.sceneNumber.trim();
    if (!mapA.has(num)) allNumbers.push(num);
  }

  const summary: ScriptDiffSummary = {
    addedScenesCount: 0,
    removedScenesCount: 0,
    modifiedScenesCount: 0,
    unchangedScenesCount: 0,
    netPageShiftEighths: 0,
    scenes: [],
    totalInsertions: 0,
    totalDeletions: 0,
    executionTimeMs: 0
  };

  for (const num of allNumbers) {
    const sA = mapA.get(num);
    const sB = mapB.get(num);

    const res: SceneDiffResult = {
      sceneId: (sB || sA)?.id || '',
      sceneNumber: num,
      status: 'UNCHANGED',
      pageShiftEighths: 0,
      hunks: [],
      elementDeltas: []
    };

    if (!sA && sB) {
      summary.addedScenesCount++;
      res.status = 'ADDED';
      res.titleB = sB.heading;
      const pages = sB.pageEighths ?? 8;
      res.pageShiftEighths = pages;
      summary.netPageShiftEighths += pages;

      if (sB.breakdownItems) {
        for (const item of sB.breakdownItems) {
          res.elementDeltas.push({ category: item.category, name: item.name, isAdded: true });
        }
      }

      const diff = diffLines('', sB.scriptText);
      res.hunks = createHunks(diff, 3);
      for (const d of diff) {
        if (d.op === DiffOp.INSERT) summary.totalInsertions++;
      }
      summary.scenes.push(res);

    } else if (sA && !sB) {
      summary.removedScenesCount++;
      res.status = 'REMOVED';
      res.titleA = sA.heading;
      const pages = sA.pageEighths ?? 8;
      res.pageShiftEighths = -pages;
      summary.netPageShiftEighths -= pages;

      if (sA.breakdownItems) {
        for (const item of sA.breakdownItems) {
          res.elementDeltas.push({ category: item.category, name: item.name, isAdded: false });
        }
      }

      const diff = diffLines(sA.scriptText, '');
      res.hunks = createHunks(diff, 3);
      for (const d of diff) {
        if (d.op === DiffOp.DELETE) summary.totalDeletions++;
      }
      summary.scenes.push(res);

    } else if (sA && sB) {
      res.titleA = sA.heading;
      res.titleB = sB.heading;

      const shift = (sB.pageEighths ?? 8) - (sA.pageEighths ?? 8);
      res.pageShiftEighths = shift;
      summary.netPageShiftEighths += shift;

      // Element delta
      const setA = new Set<string>((sA.breakdownItems || []).map(i => `${i.category}:::${i.name}`));
      const setB = new Set<string>((sB.breakdownItems || []).map(i => `${i.category}:::${i.name}`));

      for (const key of setB) {
        if (!setA.has(key)) {
          const [cat, name] = key.split(':::');
          res.elementDeltas.push({ category: cat, name, isAdded: true });
        }
      }

      for (const key of setA) {
        if (!setB.has(key)) {
          const [cat, name] = key.split(':::');
          res.elementDeltas.push({ category: cat, name, isAdded: false });
        }
      }

      const textChanged = (sA.scriptText !== sB.scriptText) || (sA.heading !== sB.heading);
      if (textChanged || res.elementDeltas.length > 0) {
        summary.modifiedScenesCount++;
        res.status = 'MODIFIED';
        const diff = diffLines(sA.scriptText, sB.scriptText);
        res.hunks = createHunks(diff, 3);
        for (const d of diff) {
          if (d.op === DiffOp.INSERT) summary.totalInsertions++;
          if (d.op === DiffOp.DELETE) summary.totalDeletions++;
        }
      } else {
        summary.unchangedScenesCount++;
        res.status = 'UNCHANGED';
      }

      summary.scenes.push(res);
    }
  }

  summary.executionTimeMs = performance.now() - t0;
  return summary;
}

/**
 * Format hunks to standard unified diff format (git-compatible)
 */
export function formatUnifiedDiff(
  fileA: string,
  fileB: string,
  hunks: DiffHunk[]
): string {
  let out = `--- ${fileA}\n+++ ${fileB}\n`;
  for (const h of hunks) {
    out += `@@ -${h.startLineA},${h.countA} +${h.startLineB},${h.countB} @@\n`;
    for (const l of h.lines) {
      if (l.op === DiffOp.EQUAL) out += ` ${l.text}\n`;
      else if (l.op === DiffOp.INSERT) out += `+${l.text}\n`;
      else if (l.op === DiffOp.DELETE) out += `-${l.text}\n`;
    }
  }
  return out;
}
