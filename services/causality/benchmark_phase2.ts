import { FlatMemoryCausalityEngine, BeatFlags } from './CausalityBridge';

console.log('=== CAUSALITY ENGINE PHASE 2 BENCHMARK & VERIFICATION ===\n');

const engine = new FlatMemoryCausalityEngine(5000);

// Setup 3 Story Lanes:
// Lane 0: Protagonist Lane
// Lane 1: Antagonist Lane
// Lane 2: Romance / Subplot Lane
engine.addLane(0, 50, 160, 0x38bdf8ff);
engine.addLane(1, 250, 160, 0xf43f5eff);
engine.addLane(2, 450, 160, 0x10b981ff);

// Test 1: Single Lane Ripple editing
console.log('--- Test 1: Multi-Lane Ripple Editing ---');
// Insert 5 beats in Lane 0: x = 0, 200, 400, 600, 800 (each width = 150)
engine.addBeat(1, 0, 50, 150, 100, 0);
engine.addBeat(2, 200, 50, 150, 100, 0);
engine.addBeat(3, 400, 50, 150, 100, 0);
engine.addBeat(4, 600, 50, 150, 100, 0);
engine.addBeat(5, 800, 50, 150, 100, 0);

console.log('Initial beat 2 X:', engine.getBeat(2)?.x);
console.log('Initial beat 3 X:', engine.getBeat(3)?.x);
console.log('Initial beat 4 X:', engine.getBeat(4)?.x);

// Move beat 2 from 200 to 450 (which collides with beat 3 at 400 and beat 4 at 600)
// With minGap = 24, beat 3 must ripple to 450 + 150 + 24 = 624
// Beat 4 (at 600) must ripple to 624 + 150 + 24 = 798
// Beat 5 (at 800) is fine since 798 + 150 + 24 = 972 -> beat 5 ripples to 972
const rippledCount = engine.solveLaneRipple(0, 2, 450, 24);
console.log(`Rippled beats count: ${rippledCount}`);
console.log('After ripple beat 2 X:', engine.getBeat(2)?.x, '(expected 450)');
console.log('After ripple beat 3 X:', engine.getBeat(3)?.x, '(expected 624)');
console.log('After ripple beat 4 X:', engine.getBeat(4)?.x, '(expected 798)');
console.log('After ripple beat 5 X:', engine.getBeat(5)?.x, '(expected 972)');

const test1Pass = 
  engine.getBeat(2)?.x === 450 &&
  engine.getBeat(3)?.x === 624 &&
  engine.getBeat(4)?.x === 798 &&
  engine.getBeat(5)?.x === 972;

console.log(`Test 1 Result: ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

// Test 2: Cross-Lane Causal DAG Ripple
console.log('--- Test 2: Cross-Lane Causal Ripple Propagation ---');
// Lane 0: Beat 10 (x=100, w=150)
// Lane 1: Beat 20 (x=200, w=150)
// Beat 10 causes Beat 20 (10 -> 20)
// Lane 2: Beat 30 (x=300, w=150)
// Beat 20 causes Beat 30 (20 -> 30)
engine.addBeat(10, 100, 50, 150, 100, 0);
engine.addBeat(20, 200, 250, 150, 100, 1);
engine.addBeat(30, 300, 450, 150, 100, 2);

engine.addConnection(101, 10, 20);
engine.addConnection(102, 20, 30);

// Move Beat 10 forward to x = 500
// Cause Beat 10 now ends at 500 + 150 = 650.
// Min causal gap = 40.
// Beat 20 must be pushed to at least 650 + 40 = 690.
// Beat 20 now ends at 690 + 150 = 840.
// Beat 30 must cascade and be pushed to at least 840 + 40 = 880!
engine.updateBeatPosition(10, 500, 50);
const causalRippled = engine.propagateCausalRipple(10, 40);
console.log(`Causal rippled count: ${causalRippled}`);
console.log('Beat 10 X:', engine.getBeat(10)?.x, '(expected 500)');
console.log('Beat 20 X:', engine.getBeat(20)?.x, '(expected 690)');
console.log('Beat 30 X:', engine.getBeat(30)?.x, '(expected 880)');

const test2Pass = 
  engine.getBeat(10)?.x === 500 &&
  engine.getBeat(20)?.x === 690 &&
  engine.getBeat(30)?.x === 880;

console.log(`Test 2 Result: ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

// Test 3: Circular Causal Cycle Detection
console.log('--- Test 3: Cycle Paradox Detection & DAG Validation ---');
// 10 -> 20 -> 30 already exists.
// Checking if 30 -> 10 would create a cycle:
const wouldCycle = engine.wouldCreateCycle(30, 10);
console.log('Would 30 -> 10 create a cycle?:', wouldCycle, '(expected true)');

// Force add cycle connection anyway to test validateDAGAndMarkErrors
engine.addConnection(103, 30, 10);
const errorCount = engine.validateDAGAndMarkErrors();
console.log(`Detected error nodes in cycle: ${errorCount} (expected 3)`);

const b10Err = (engine.getBeat(10)?.flags ?? 0) & BeatFlags.CAUSAL_ERR;
const b20Err = (engine.getBeat(20)?.flags ?? 0) & BeatFlags.CAUSAL_ERR;
const b30Err = (engine.getBeat(30)?.flags ?? 0) & BeatFlags.CAUSAL_ERR;

console.log(`Beat 10 marked with error flag: ${Boolean(b10Err)}`);
console.log(`Beat 20 marked with error flag: ${Boolean(b20Err)}`);
console.log(`Beat 30 marked with error flag: ${Boolean(b30Err)}`);

const test3Pass = wouldCycle === true && errorCount === 3 && Boolean(b10Err) && Boolean(b20Err) && Boolean(b30Err);
console.log(`Test 3 Result: ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

// Test 4: Magnetic Snapping
console.log('--- Test 4: Magnetic Snapping ---');
const snapGrid = engine.snapBeatPosition(103.5, 0, 16);
console.log('Snap 103.5 to grid (50px interval):', snapGrid, '(expected 100)');

// Test 5: High-load performance benchmark
console.log('--- Test 5: High-Load Performance Benchmark (500 Connected Beats) ---');
engine.clearAll();

// Build a long causal chain of 500 beats across 5 alternating lanes
for (let i = 0; i < 500; i++) {
  engine.addBeat(i + 1, i * 100, (i % 5) * 120, 80, 60, i % 5);
  if (i > 0) {
    engine.addConnection(i, i, i + 1);
  }
}

// Measure time to push Beat 1 by 50,000 units forward, causing a 500-node cascading ripple!
const startRipple = performance.now();
engine.updateBeatPosition(1, 50000, 0);
const totalPushed = engine.propagateCausalRipple(1, 20);
const endRipple = performance.now();

const elapsedMs = endRipple - startRipple;
console.log(`Propagated cascade across ${totalPushed} beats in: ${elapsedMs.toFixed(3)} ms`);
console.log(`Execution speed per beat: ${(elapsedMs * 1000 / totalPushed).toFixed(2)} µs/beat`);
console.log(`Test 5 Result: ${elapsedMs < 15.0 ? 'PASSED (Sub-frame instant!) 🚀' : 'SLOW ⚠️'}\n`);
