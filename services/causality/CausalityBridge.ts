import { SpatialHashGrid } from './SpatialGrid';

export const BEAT_STRIDE_BYTES = 48;
export const BEAT_STRIDE_WORDS = 12;

// Field offsets in 32-bit words (each word = 4 bytes)
export const BEAT_OFFSET_ID = 0;              // uint32
export const BEAT_OFFSET_X = 1;               // float32
export const BEAT_OFFSET_Y = 2;               // float32
export const BEAT_OFFSET_WIDTH = 3;           // float32
export const BEAT_OFFSET_HEIGHT = 4;          // float32
export const BEAT_OFFSET_LANE_INDEX = 5;      // int32
export const BEAT_OFFSET_SEQUENCE_ORDER = 6;  // uint32
export const BEAT_OFFSET_COLOR_RGBA = 7;      // uint32
export const BEAT_OFFSET_FLAGS = 8;           // uint32 (selected, dragging, etc.)
export const BEAT_OFFSET_DURATION_SECS = 9;   // float32
export const BEAT_OFFSET_ACT_INDEX = 10;      // uint32
export const BEAT_OFFSET_PADDING = 11;        // uint32

export enum BeatFlags {
  NONE = 0,
  SELECTED = 1 << 0,
  HOVERED = 1 << 1,
  LOCKED = 1 << 2,
  COLLAPSED = 1 << 3,
  DRAGGING = 1 << 4,
  CAUSAL_ERR = 1 << 5,
  ACTIVE = 1 << 6,
}

export enum ConnectionType {
  CAUSAL_HARD = 0,
  CAUSAL_SOFT = 1,
  SUBPLOT = 2,
  CHARACTER_ARC = 3,
  TEMPORAL = 4,
}

export interface ViewportCamera {
  x: number;
  y: number;
  zoom: number;
  screenWidth: number;
  screenHeight: number;
}

export interface BeatData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  laneIndex: number;
  sequenceOrder: number;
  colorRgba: number;
  flags: number;
  durationSecs: number;
  actIndex: number;
}

export interface StoryLaneData {
  laneIndex: number;
  yOffset: number;
  height: number;
  colorRgba: number;
  flags: number;
  beatCount: number;
}

export interface CausalConnectionData {
  id: number;
  sourceBeatId: number;
  targetBeatId: number;
  type: ConnectionType;
  strength: number;
  flags: number;
}

/**
 * Interface contract matching the C++ CausalityEngine
 */
export interface ICausalityEngine {
  addBeat(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    laneIndex: number,
    colorRgba?: number,
    durationSecs?: number,
    actIndex?: number
  ): boolean;
  updateBeatPosition(id: number, x: number, y: number): boolean;
  setBeatFlags(id: number, flags: number): boolean;
  removeBeat(id: number): boolean;
  getBeat(id: number): BeatData | null;
  getBeatByIndex(index: number): BeatData | null;

  addLane(laneIndex: number, yOffset: number, height: number, colorRgba?: number): boolean;
  updateLane(laneIndex: number, yOffset: number, height: number): boolean;
  removeLane(laneIndex: number): boolean;
  getLane(laneIndex: number): StoryLaneData | null;

  addConnection(id: number, sourceId: number, targetId: number, type?: ConnectionType): boolean;
  removeConnection(id: number): boolean;

  // Phase 2: Causal DAG & Multi-Lane Ripple
  solveLaneRipple(laneIndex: number, movedBeatId: number, newX: number, minGap?: number): number;
  propagateCausalRipple(sourceBeatId: number, minCausalGap?: number): number;
  wouldCreateCycle(sourceBeatId: number, targetBeatId: number): boolean;
  validateDAGAndMarkErrors(): number;
  snapBeatPosition(rawX: number, laneIndex: number, snapThreshold?: number): number;

  queryVisibleBeats(camera: ViewportCamera, outIndices: Int32Array): number;
  querySpatialRange(minX: number, minY: number, maxX: number, maxY: number, outIds: Int32Array): number;
  hitTestBeat(worldX: number, worldY: number): number;

  getBeatsBuffer(): ArrayBuffer;
  getBeatsCount(): number;
  clearAll(): void;
}

/**
 * High-performance Flat ArrayBuffer implementation of the Causality Engine in TypeScript.
 * Operates on contiguous pre-allocated memory buffers, completely eliminating V8 garbage collection!
 */
export class FlatMemoryCausalityEngine implements ICausalityEngine {
  private buffer: ArrayBuffer;
  private floatView: Float32Array;
  private uintView: Uint32Array;
  private intView: Int32Array;

  private beatsCount: number = 0;
  private maxBeats: number;
  private idToIndexMap = new Map<number, number>();

  private lanes = new Map<number, StoryLaneData>();
  private connections = new Map<number, CausalConnectionData>();
  private forwardAdjacency = new Map<number, number[]>();
  private backwardAdjacency = new Map<number, number[]>();
  private spatialGrid = new SpatialHashGrid(500, 160);
  private candIdsBuffer: Int32Array;

  constructor(maxBeats = 10000) {
    this.maxBeats = maxBeats;
    // Pre-allocate contiguous flat memory buffer (10,000 beats = 480 KB)
    this.buffer = new ArrayBuffer(maxBeats * BEAT_STRIDE_BYTES);
    this.floatView = new Float32Array(this.buffer);
    this.uintView = new Uint32Array(this.buffer);
    this.intView = new Int32Array(this.buffer);
    this.candIdsBuffer = new Int32Array(5000);
  }

  addBeat(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    laneIndex: number,
    colorRgba = 0x38bdf8ff,
    durationSecs = 120,
    actIndex = 1
  ): boolean {
    if (this.idToIndexMap.has(id)) return false;
    if (this.beatsCount >= this.maxBeats) return false;

    const idx = this.beatsCount;
    const baseWord = idx * BEAT_STRIDE_WORDS;

    this.uintView[baseWord + BEAT_OFFSET_ID] = id;
    this.floatView[baseWord + BEAT_OFFSET_X] = x;
    this.floatView[baseWord + BEAT_OFFSET_Y] = y;
    this.floatView[baseWord + BEAT_OFFSET_WIDTH] = width;
    this.floatView[baseWord + BEAT_OFFSET_HEIGHT] = height;
    this.intView[baseWord + BEAT_OFFSET_LANE_INDEX] = laneIndex;
    this.uintView[baseWord + BEAT_OFFSET_SEQUENCE_ORDER] = idx;
    this.uintView[baseWord + BEAT_OFFSET_COLOR_RGBA] = colorRgba;
    this.uintView[baseWord + BEAT_OFFSET_FLAGS] = BeatFlags.ACTIVE;
    this.floatView[baseWord + BEAT_OFFSET_DURATION_SECS] = durationSecs;
    this.uintView[baseWord + BEAT_OFFSET_ACT_INDEX] = actIndex;

    this.idToIndexMap.set(id, idx);
    this.beatsCount++;

    const lane = this.lanes.get(laneIndex);
    if (lane) lane.beatCount++;

    // Phase 3: Spatial Indexing
    this.spatialGrid.insert(id, x, y, width, height);

    return true;
  }

  updateBeatPosition(id: number, x: number, y: number): boolean {
    const idx = this.idToIndexMap.get(id);
    if (idx === undefined) return false;

    const baseWord = idx * BEAT_STRIDE_WORDS;
    this.floatView[baseWord + BEAT_OFFSET_X] = x;
    this.floatView[baseWord + BEAT_OFFSET_Y] = y;

    const w = this.floatView[baseWord + BEAT_OFFSET_WIDTH];
    const h = this.floatView[baseWord + BEAT_OFFSET_HEIGHT];
    this.spatialGrid.update(id, x, y, w, h);

    return true;
  }

  setBeatFlags(id: number, flags: number): boolean {
    const idx = this.idToIndexMap.get(id);
    if (idx === undefined) return false;

    const baseWord = idx * BEAT_STRIDE_WORDS;
    this.uintView[baseWord + BEAT_OFFSET_FLAGS] = flags;
    return true;
  }

  removeBeat(id: number): boolean {
    const idx = this.idToIndexMap.get(id);
    if (idx === undefined) return false;

    const laneIdx = this.intView[idx * BEAT_STRIDE_WORDS + BEAT_OFFSET_LANE_INDEX];
    const lane = this.lanes.get(laneIdx);
    if (lane && lane.beatCount > 0) lane.beatCount--;

    const lastIdx = this.beatsCount - 1;
    if (idx !== lastIdx) {
      // O(1) Swap-and-Pop: copy last beat into removed beat slot
      const srcWord = lastIdx * BEAT_STRIDE_WORDS;
      const dstWord = idx * BEAT_STRIDE_WORDS;

      for (let i = 0; i < BEAT_STRIDE_WORDS; i++) {
        this.uintView[dstWord + i] = this.uintView[srcWord + i];
      }

      const movedId = this.uintView[dstWord + BEAT_OFFSET_ID];
      this.idToIndexMap.set(movedId, idx);
    }

    this.idToIndexMap.delete(id);
    this.beatsCount--;
    this.spatialGrid.remove(id);
    return true;
  }

  getBeat(id: number): BeatData | null {
    const idx = this.idToIndexMap.get(id);
    if (idx === undefined) return null;

    const base = idx * BEAT_STRIDE_WORDS;
    return {
      id: this.uintView[base + BEAT_OFFSET_ID],
      x: this.floatView[base + BEAT_OFFSET_X],
      y: this.floatView[base + BEAT_OFFSET_Y],
      width: this.floatView[base + BEAT_OFFSET_WIDTH],
      height: this.floatView[base + BEAT_OFFSET_HEIGHT],
      laneIndex: this.intView[base + BEAT_OFFSET_LANE_INDEX],
      sequenceOrder: this.uintView[base + BEAT_OFFSET_SEQUENCE_ORDER],
      colorRgba: this.uintView[base + BEAT_OFFSET_COLOR_RGBA],
      flags: this.uintView[base + BEAT_OFFSET_FLAGS],
      durationSecs: this.floatView[base + BEAT_OFFSET_DURATION_SECS],
      actIndex: this.uintView[base + BEAT_OFFSET_ACT_INDEX],
    };
  }

  getBeatByIndex(idx: number): BeatData | null {
    if (idx < 0 || idx >= this.beatsCount) return null;
    const base = idx * BEAT_STRIDE_WORDS;
    return {
      id: this.uintView[base + BEAT_OFFSET_ID],
      x: this.floatView[base + BEAT_OFFSET_X],
      y: this.floatView[base + BEAT_OFFSET_Y],
      width: this.floatView[base + BEAT_OFFSET_WIDTH],
      height: this.floatView[base + BEAT_OFFSET_HEIGHT],
      laneIndex: this.intView[base + BEAT_OFFSET_LANE_INDEX],
      sequenceOrder: this.uintView[base + BEAT_OFFSET_SEQUENCE_ORDER],
      colorRgba: this.uintView[base + BEAT_OFFSET_COLOR_RGBA],
      flags: this.uintView[base + BEAT_OFFSET_FLAGS],
      durationSecs: this.floatView[base + BEAT_OFFSET_DURATION_SECS],
      actIndex: this.uintView[base + BEAT_OFFSET_ACT_INDEX],
    };
  }

  addLane(laneIndex: number, yOffset: number, height: number, colorRgba = 0x1e293bff): boolean {
    if (this.lanes.has(laneIndex)) return false;
    this.lanes.set(laneIndex, {
      laneIndex,
      yOffset,
      height,
      colorRgba,
      flags: 1,
      beatCount: 0,
    });
    return true;
  }

  updateLane(laneIndex: number, yOffset: number, height: number): boolean {
    const lane = this.lanes.get(laneIndex);
    if (!lane) return false;
    lane.yOffset = yOffset;
    lane.height = height;
    return true;
  }

  removeLane(laneIndex: number): boolean {
    return this.lanes.delete(laneIndex);
  }

  getLane(laneIndex: number): StoryLaneData | null {
    return this.lanes.get(laneIndex) || null;
  }

  addConnection(id: number, sourceId: number, targetId: number, type = ConnectionType.CAUSAL_HARD): boolean {
    if (sourceId === targetId) return false;
    this.connections.set(id, {
      id,
      sourceBeatId: sourceId,
      targetBeatId: targetId,
      type,
      strength: 1.0,
      flags: 0,
    });

    if (!this.forwardAdjacency.has(sourceId)) {
      this.forwardAdjacency.set(sourceId, []);
    }
    this.forwardAdjacency.get(sourceId)!.push(targetId);

    if (!this.backwardAdjacency.has(targetId)) {
      this.backwardAdjacency.set(targetId, []);
    }
    this.backwardAdjacency.get(targetId)!.push(sourceId);

    return true;
  }

  removeConnection(id: number): boolean {
    const conn = this.connections.get(id);
    if (!conn) return false;

    const fwd = this.forwardAdjacency.get(conn.sourceBeatId);
    if (fwd) {
      const idx = fwd.indexOf(conn.targetBeatId);
      if (idx !== -1) fwd.splice(idx, 1);
    }

    const bwd = this.backwardAdjacency.get(conn.targetBeatId);
    if (bwd) {
      const idx = bwd.indexOf(conn.sourceBeatId);
      if (idx !== -1) bwd.splice(idx, 1);
    }

    return this.connections.delete(id);
  }

  // ==========================================
  // PHASE 2: CAUSAL DAG & MULTI-LANE RIPPLE
  // ==========================================

  solveLaneRipple(laneIndex: number, movedBeatId: number, newX: number, minGap = 24): number {
    const movedIdx = this.idToIndexMap.get(movedBeatId);
    if (movedIdx === undefined) return 0;

    // Collect all beat indices in this lane
    const laneIndices: number[] = [];
    for (let i = 0; i < this.beatsCount; i++) {
      if (this.intView[i * BEAT_STRIDE_WORDS + BEAT_OFFSET_LANE_INDEX] === laneIndex) {
        laneIndices.push(i);
      }
    }

    // Sort lane beats by CURRENT X coordinate before moving
    laneIndices.sort((a, b) => {
      const xA = this.floatView[a * BEAT_STRIDE_WORDS + BEAT_OFFSET_X];
      const xB = this.floatView[b * BEAT_STRIDE_WORDS + BEAT_OFFSET_X];
      if (Math.abs(xA - xB) > 0.001) return xA - xB;
      return this.uintView[a * BEAT_STRIDE_WORDS + BEAT_OFFSET_ID] - this.uintView[b * BEAT_STRIDE_WORDS + BEAT_OFFSET_ID];
    });

    const movedPos = laneIndices.indexOf(movedIdx);
    if (movedPos === -1) return 0;

    // Now update the moved beat's position
    const movedBase = movedIdx * BEAT_STRIDE_WORDS;
    this.floatView[movedBase + BEAT_OFFSET_X] = newX;
    this.intView[movedBase + BEAT_OFFSET_LANE_INDEX] = laneIndex;
    this.spatialGrid.update(
      movedBeatId,
      newX,
      this.floatView[movedBase + BEAT_OFFSET_Y],
      this.floatView[movedBase + BEAT_OFFSET_WIDTH],
      this.floatView[movedBase + BEAT_OFFSET_HEIGHT]
    );

    let rippledCount = 0;
    for (let i = movedPos + 1; i < laneIndices.length; i++) {
      const prevIdx = laneIndices[i - 1];
      const currIdx = laneIndices[i];

      const prevBase = prevIdx * BEAT_STRIDE_WORDS;
      const currBase = currIdx * BEAT_STRIDE_WORDS;

      const prevX = this.floatView[prevBase + BEAT_OFFSET_X];
      const prevWidth = this.floatView[prevBase + BEAT_OFFSET_WIDTH];
      const currX = this.floatView[currBase + BEAT_OFFSET_X];

      const requiredMinX = prevX + prevWidth + minGap;
      if (currX < requiredMinX) {
        this.floatView[currBase + BEAT_OFFSET_X] = requiredMinX;
        const currId = this.uintView[currBase + BEAT_OFFSET_ID];
        this.spatialGrid.update(
          currId,
          requiredMinX,
          this.floatView[currBase + BEAT_OFFSET_Y],
          this.floatView[currBase + BEAT_OFFSET_WIDTH],
          this.floatView[currBase + BEAT_OFFSET_HEIGHT]
        );
        rippledCount++;
      }
    }

    return rippledCount;
  }

  propagateCausalRipple(sourceBeatId: number, minCausalGap = 40): number {
    const srcIdx = this.idToIndexMap.get(sourceBeatId);
    if (srcIdx === undefined) return 0;

    const queue: number[] = [sourceBeatId];
    const visited = new Set<number>([sourceBeatId]);
    let affectedCount = 0;

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currIdx = this.idToIndexMap.get(currId);
      if (currIdx === undefined) continue;

      const parentBase = currIdx * BEAT_STRIDE_WORDS;
      const parentX = this.floatView[parentBase + BEAT_OFFSET_X];
      const parentWidth = this.floatView[parentBase + BEAT_OFFSET_WIDTH];

      const children = this.forwardAdjacency.get(currId);
      if (!children) continue;

      for (const childId of children) {
        const childIdx = this.idToIndexMap.get(childId);
        if (childIdx === undefined) continue;

        const childBase = childIdx * BEAT_STRIDE_WORDS;
        const childX = this.floatView[childBase + BEAT_OFFSET_X];
        const childLane = this.intView[childBase + BEAT_OFFSET_LANE_INDEX];
        const requiredMinX = parentX + parentWidth + minCausalGap;

        if (childX < requiredMinX) {
          this.floatView[childBase + BEAT_OFFSET_X] = requiredMinX;
          affectedCount++;

          // Ripple downstream in child's lane
          this.solveLaneRipple(childLane, childId, requiredMinX, 24);

          if (!visited.has(childId)) {
            visited.add(childId);
            queue.push(childId);
          }
        }
      }
    }

    return affectedCount;
  }

  wouldCreateCycle(sourceBeatId: number, targetBeatId: number): boolean {
    if (sourceBeatId === targetBeatId) return true;

    const queue: number[] = [targetBeatId];
    const visited = new Set<number>([targetBeatId]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === sourceBeatId) return true;

      const children = this.forwardAdjacency.get(curr);
      if (children) {
        for (const nextId of children) {
          if (nextId === sourceBeatId) return true;
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        }
      }
    }

    return false;
  }

  validateDAGAndMarkErrors(): number {
    for (let i = 0; i < this.beatsCount; i++) {
      this.uintView[i * BEAT_STRIDE_WORDS + BEAT_OFFSET_FLAGS] &= ~BeatFlags.CAUSAL_ERR;
    }

    const state = new Map<number, number>(); // 0: unvisited, 1: visiting, 2: visited
    for (let i = 0; i < this.beatsCount; i++) {
      state.set(this.uintView[i * BEAT_STRIDE_WORDS + BEAT_OFFSET_ID], 0);
    }

    const cycleNodes = new Set<number>();
    const path: number[] = [];

    const dfs = (u: number) => {
      state.set(u, 1);
      path.push(u);

      const children = this.forwardAdjacency.get(u);
      if (children) {
        for (const v of children) {
          const st = state.get(v) ?? 0;
          if (st === 1) {
            let inCycle = false;
            for (const node of path) {
              if (node === v) inCycle = true;
              if (inCycle) cycleNodes.add(node);
            }
          } else if (st === 0) {
            dfs(v);
          }
        }
      }

      path.pop();
      state.set(u, 2);
    };

    for (let i = 0; i < this.beatsCount; i++) {
      const id = this.uintView[i * BEAT_STRIDE_WORDS + BEAT_OFFSET_ID];
      if ((state.get(id) ?? 0) === 0) {
        dfs(id);
      }
    }

    for (const id of cycleNodes) {
      const idx = this.idToIndexMap.get(id);
      if (idx !== undefined) {
        this.uintView[idx * BEAT_STRIDE_WORDS + BEAT_OFFSET_FLAGS] |= BeatFlags.CAUSAL_ERR;
      }
    }

    return cycleNodes.size;
  }

  snapBeatPosition(rawX: number, laneIndex: number, snapThreshold = 16): number {
    let bestX = rawX;
    let minDiff = snapThreshold + 1.0;

    // 1. Grid snap (50px interval)
    const gridInterval = 50.0;
    const nearestGrid = Math.round(rawX / gridInterval) * gridInterval;
    const gridDiff = Math.abs(rawX - nearestGrid);
    if (gridDiff <= snapThreshold && gridDiff < minDiff) {
      minDiff = gridDiff;
      bestX = nearestGrid;
    }

    // 2. Snap to neighbor beats in the same lane
    for (let i = 0; i < this.beatsCount; i++) {
      const base = i * BEAT_STRIDE_WORDS;
      if (this.intView[base + BEAT_OFFSET_LANE_INDEX] === laneIndex) {
        const bx = this.floatView[base + BEAT_OFFSET_X];
        const bw = this.floatView[base + BEAT_OFFSET_WIDTH];

        // Snap to right edge of neighbor
        const rightEdge = bx + bw + 16.0;
        const rDiff = Math.abs(rawX - rightEdge);
        if (rDiff <= snapThreshold && rDiff < minDiff) {
          minDiff = rDiff;
          bestX = rightEdge;
        }

        // Snap to left edge of neighbor
        const lDiff = Math.abs(rawX - bx);
        if (lDiff <= snapThreshold && lDiff < minDiff) {
          minDiff = lDiff;
          bestX = bx;
        }
      }
    }

    return bestX;
  }

  /**
   * Phase 3 Spatial Viewport Culling query: sub-microsecond cell traversal
   */
  queryVisibleBeats(camera: ViewportCamera, outIndices: Int32Array): number {
    if (camera.zoom <= 0.0001) return 0;

    const halfW = (camera.screenWidth * 0.5) / camera.zoom;
    const halfH = (camera.screenHeight * 0.5) / camera.zoom;

    const minX = camera.x - halfW;
    const maxX = camera.x + halfW;
    const minY = camera.y - halfH;
    const maxY = camera.y + halfH;

    if (this.candIdsBuffer.length < outIndices.length) {
      this.candIdsBuffer = new Int32Array(outIndices.length);
    }
    const candCount = this.spatialGrid.queryRange(minX, minY, maxX, maxY, this.candIdsBuffer);

    let count = 0;
    const max = outIndices.length;

    for (let i = 0; i < candCount && count < max; i++) {
      const id = this.candIdsBuffer[i];
      const idx = this.idToIndexMap.get(id);
      if (idx === undefined) continue;

      const base = idx * BEAT_STRIDE_WORDS;
      const bx = this.floatView[base + BEAT_OFFSET_X];
      const by = this.floatView[base + BEAT_OFFSET_Y];
      const bw = this.floatView[base + BEAT_OFFSET_WIDTH];
      const bh = this.floatView[base + BEAT_OFFSET_HEIGHT];

      if (bx + bw >= minX && bx <= maxX && by + bh >= minY && by <= maxY) {
        outIndices[count++] = idx;
      }
    }

    return count;
  }

  /**
   * Phase 3 Spatial Box / Marquee Selection query
   */
  querySpatialRange(minX: number, minY: number, maxX: number, maxY: number, outIds: Int32Array): number {
    return this.spatialGrid.queryRange(minX, minY, maxX, maxY, outIds);
  }

  /**
   * Phase 3 O(1) Spatial Point Hit-Testing
   */
  hitTestBeat(worldX: number, worldY: number): number {
    const candidates = this.spatialGrid.queryPointCandidates(worldX, worldY);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const id = candidates[i];
      const idx = this.idToIndexMap.get(id);
      if (idx === undefined) continue;

      const base = idx * BEAT_STRIDE_WORDS;
      const bx = this.floatView[base + BEAT_OFFSET_X];
      const by = this.floatView[base + BEAT_OFFSET_Y];
      const bw = this.floatView[base + BEAT_OFFSET_WIDTH];
      const bh = this.floatView[base + BEAT_OFFSET_HEIGHT];

      if (worldX >= bx && worldX <= bx + bw && worldY >= by && worldY <= by + bh) {
        return id;
      }
    }
    return -1;
  }

  getBeatsBuffer(): ArrayBuffer {
    return this.buffer;
  }

  getBeatsCount(): number {
    return this.beatsCount;
  }

  clearAll(): void {
    this.beatsCount = 0;
    this.idToIndexMap.clear();
    this.lanes.clear();
    this.connections.clear();
    this.forwardAdjacency.clear();
    this.backwardAdjacency.clear();
    this.spatialGrid.clear();
  }
}
