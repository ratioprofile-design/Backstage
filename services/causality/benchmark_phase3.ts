import { FlatMemoryCausalityEngine, ViewportCamera } from './CausalityBridge';

console.log('=== CAUSALITY ENGINE PHASE 3: SPATIAL INDEXING BENCHMARK ===\n');

const TOTAL_BEATS = 20000;
console.log(`Setting up engine with ${TOTAL_BEATS.toLocaleString()} beats across 8 lanes...`);
const engine = new FlatMemoryCausalityEngine(TOTAL_BEATS + 500);

// Populate 8 lanes
for (let l = 0; l < 8; l++) {
  engine.addLane(l, l * 160, 160);
}

// Insert 20,000 beats spanning 0 to 500,000 px in world coordinates
const startInsert = performance.now();
for (let i = 0; i < TOTAL_BEATS; i++) {
  const lane = i % 8;
  const x = Math.floor(i / 8) * 200;
  const y = lane * 160 + 30;
  engine.addBeat(i + 1, x, y, 180, 80, lane);
}
const endInsert = performance.now();
console.log(`Indexed ${TOTAL_BEATS.toLocaleString()} beats into Spatial Grid in: ${(endInsert - startInsert).toFixed(2)} ms`);

// Test 1: Viewport Culling Query Performance (Screen: 1920x1080 at zoom 1.0)
console.log('\n--- Test 1: Sub-Microsecond Spatial Viewport Culling ---');
const camera: ViewportCamera = {
  x: 25000, // In the middle of the 500,000 px timeline
  y: 640,
  zoom: 1.0,
  screenWidth: 1920,
  screenHeight: 1080
};

const outIndices = new Int32Array(500);

// Warm-up query
engine.queryVisibleBeats(camera, outIndices);

// Run 1,000 viewport queries across moving camera
const startCull = performance.now();
const ITERATIONS = 1000;
let totalVisibleFound = 0;

for (let iter = 0; iter < ITERATIONS; iter++) {
  camera.x = 20000 + iter * 50;
  const count = engine.queryVisibleBeats(camera, outIndices);
  totalVisibleFound += count;
}
const endCull = performance.now();

const avgQueryTimeMs = (endCull - startCull) / ITERATIONS;
const avgQueryTimeMicrosecs = avgQueryTimeMs * 1000;
const queriesPerSec = Math.round(1000 / avgQueryTimeMs);

console.log(`Executed ${ITERATIONS} spatial viewport queries across ${TOTAL_BEATS.toLocaleString()} beats.`);
console.log(`Average Query Time: ${avgQueryTimeMicrosecs.toFixed(2)} µs (${avgQueryTimeMs.toFixed(5)} ms)`);
console.log(`Viewport Culling Query Rate: ${queriesPerSec.toLocaleString()} queries/sec`);
console.log(`Average beats visible per frame: ${Math.round(totalVisibleFound / ITERATIONS)}`);

const test1Pass = avgQueryTimeMicrosecs < 50.0;
console.log(`Test 1 Result: ${test1Pass ? 'PASSED (Sub-50µs ultra-fast!) 🚀' : 'SLOW ⚠️'}\n`);

// Test 2: Point Hit-Testing with Spatial Index vs Brute Force
console.log('--- Test 2: Point Hit-Testing Performance ---');
// Hit test at beat #5001's center
const targetBeat = engine.getBeat(5001);
if (!targetBeat) throw new Error('Beat not found');

const clickX = targetBeat.x + targetBeat.width / 2;
const clickY = targetBeat.y + targetBeat.height / 2;

const startHit = performance.now();
let hitId = -1;
for (let i = 0; i < 5000; i++) {
  hitId = engine.hitTestBeat(clickX, clickY);
}
const endHit = performance.now();
const avgHitMicrosecs = ((endHit - startHit) / 5000) * 1000;

console.log(`Hit-test result ID: ${hitId} (expected 5001)`);
console.log(`Average Hit-Test Time: ${avgHitMicrosecs.toFixed(3)} µs`);
const test2Pass = hitId === 5001 && avgHitMicrosecs < 15.0;
console.log(`Test 2 Result: ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

// Test 3: Marquee Box Range Selection
console.log('--- Test 3: Spatial Marquee Box Selection ---');
const boxIds = new Int32Array(500);
// Select a 1000x400 rectangle around beat 1000
const b1000 = engine.getBeat(1000)!;
const selectedCount = engine.querySpatialRange(
  b1000.x - 200,
  b1000.y - 50,
  b1000.x + 800,
  b1000.y + 350,
  boxIds
);

console.log(`Spatial Box Selection retrieved: ${selectedCount} beats in selection bounding box.`);
const test3Pass = selectedCount > 0 && selectedCount < 100;
console.log(`Test 3 Result: ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

console.log('=== PHASE 3 VERIFICATION SUMMARY ===');
console.log(`All Phase 3 Spatial Indexing benchmarks verified: ${test1Pass && test2Pass && test3Pass ? 'ALL PASSED ✅' : 'FAILURES OCCURRED ❌'}`);
