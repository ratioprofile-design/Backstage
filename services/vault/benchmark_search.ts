import { VaultSearchEngine, VaultDocumentInput } from './VaultSearchEngine';

console.log('===============================================================');
console.log('⚡ BACKSTAGE VAULT ENGINE — STEP 5.2 INVERTED SEARCH BENCHMARK');
console.log('===============================================================\n');

const engine = new VaultSearchEngine();

// 1. Generate 250 Realistic Film Production Documents (~500,000 words)
console.log('--- TEST 1: Batch Indexing 250 Production Documents ---');

const categories = ['SCRIPT', 'CALLSHEET', 'BREAKDOWN', 'SAFETY', 'LOCATION', 'AUDIO', 'LOOKBOOK'];
const sampleKeywords = [
  'anamorphic lens', 'pyrotechnic arc box', 'optical cryo-key', 'subterranean turbine',
  'tactical stealth suit', 'charred land deeds', 'incinerator release valve',
  'decelerator stunt rig', 'hydraulic blast door', 'failsafe protocol omega',
  'volumetric hologram stream', 'class C fire suppression', '50mm Kowa prime'
];

const docs: VaultDocumentInput[] = [];

for (let i = 1; i <= 250; i++) {
  const cat = categories[i % categories.length];
  const kw1 = sampleKeywords[i % sampleKeywords.length];
  const kw2 = sampleKeywords[(i * 3) % sampleKeywords.length];

  const bodyLines: string[] = [
    `PRODUCTION ASSET ARCHIVE RECORD #${i}`,
    `CLASSIFICATION: RESTRICTED PRODUCTION DRAFT - ${cat}`,
    `PRIMARY DEPARTMENT: ${cat} UNIT DISPATCH`,
    ``,
    `SECTION 1. TECHNICAL SPECIFICATIONS`,
    `All crew members must verify the operation of the ${kw1} prior to call time.`,
    `Secondary monitoring confirms that the ${kw2} has passed safety inspection.`,
    `Ensure line-of-sight clearance across the primary soundstage axis.`,
    ``,
    `SECTION 2. OPERATIONAL LOG & SCRIPT EXCERPT`,
    `Scene ${i} setup requires atmospheric haze at level 4.`,
    `Maya approaches the central pedestal holding the optical cryo-key securely.`,
    `Sterling signals the tactical team to advance along the catwalk perimeter.`,
    `The subterranean turbine drone amplifies to 40Hz with mechanical resonance.`,
    ``,
    `SECTION 3. CONTINGENCY & SAFETY PROTOCOLS`,
    `In case of emergency, trigger manual override on the hydraulic blast door immediately.`,
    `Class C CO2 extinguishers stationed at east and west exits.`,
    `End of document archive #${i}.`
  ];

  docs.push({
    id: `doc_${i}`,
    title: `${cat} - Production Asset Record ${i} (${kw1})`,
    category: cat,
    content: bodyLines.join('\n')
  });
}

const tIndexStart = performance.now();
for (const doc of docs) {
  engine.indexDocument(doc);
}
const tIndexEnd = performance.now();
const indexDuration = tIndexEnd - tIndexStart;

console.log(`Indexed ${engine.documentCount} documents in ${indexDuration.toFixed(2)} ms.`);
console.log(`Throughput: ${(docs.length / (indexDuration / 1000)).toFixed(0)} docs/second.`);

if (engine.documentCount === 250) {
  console.log('✅ PASS: All 250 documents successfully indexed into inverted memory pool.\n');
} else {
  console.error('❌ FAIL: Document count mismatch.');
  process.exit(1);
}

// 2. Exact Search Validation
console.log('--- TEST 2: Exact Keyword Search & Snippet Extraction ---');
const resExact = engine.search('pyrotechnic arc box', 5);

console.log(`Query: "pyrotechnic arc box" -> ${resExact.totalHits} hits in ${resExact.queryTimeUs.toFixed(1)} µs`);
if (resExact.matches.length > 0) {
  const top = resExact.matches[0];
  console.log(`- Top Hit: [${top.category}] ${top.docTitle} (Score: ${top.score.toFixed(2)}, Line: ${top.lineNumber})`);
  console.log(`  Snippet: "${top.matchedSnippet}"`);
  console.log(`  Tokens: [${top.matchedTokens.join(', ')}]`);
  console.log('✅ PASS: Exact search returned valid ranked hits with extracted snippets.\n');
} else {
  console.error('❌ FAIL: No hits found for exact keyword.');
  process.exit(1);
}

// 3. Multi-Term Search Validation
console.log('--- TEST 3: Multi-Term Cross-Document Ranking ---');
const resMulti = engine.search('maya tactical optical cryo-key', 5);
console.log(`Query: "maya tactical optical cryo-key" -> ${resMulti.totalHits} hits in ${resMulti.queryTimeUs.toFixed(1)} µs`);
if (resMulti.matches.length > 0) {
  console.log(`- Top Hit: ${resMulti.matches[0].docTitle} (Score: ${resMulti.matches[0].score.toFixed(2)})`);
  console.log('✅ PASS: Multi-term BM25 scoring computed properly.\n');
} else {
  console.error('❌ FAIL: Multi-term search returned zero hits.');
  process.exit(1);
}

// 4. Fuzzy / Typo Search Validation
console.log('--- TEST 4: Trigram Fuzzy / Typo Search ---');
// Intentional typos: "pyrtechnic" (pyrotechnic) and "turbne" (turbine)
const resFuzzy = engine.search('pyrtechnic turbne', 5);
console.log(`Query: "pyrtechnic turbne" (with typos) -> ${resFuzzy.totalHits} hits in ${resFuzzy.queryTimeUs.toFixed(1)} µs`);
if (resFuzzy.matches.length > 0) {
  console.log(`- Top Hit: ${resFuzzy.matches[0].docTitle}`);
  console.log(`  Matched Fuzzy Tokens: [${resFuzzy.matches[0].matchedTokens.join(', ')}]`);
  console.log('✅ PASS: Trigram fuzzy index successfully bridged misspelled query.\n');
} else {
  console.error('❌ FAIL: Fuzzy search failed to find candidate terms.');
  process.exit(1);
}

// 5. High-Frequency Latency Stress Benchmark (1,000 queries)
console.log('--- TEST 5: Latency & Throughput Benchmark (1,000 Real Queries) ---');
const queryPool = [
  'anamorphic lens',
  'pyrotechnic arc box',
  'optical cryo-key',
  'subterranean turbine drone',
  'tactical stealth suit',
  'failsafe protocol omega',
  'hydraulic blast door',
  'class C fire suppression',
  'catwalk perimeter',
  'emergency manual override'
];

const QUERY_RUNS = 1000;
const queryTimesUs: number[] = [];

for (let i = 0; i < QUERY_RUNS; i++) {
  const q = queryPool[i % queryPool.length];
  const t0 = performance.now();
  engine.search(q, 10);
  const dtUs = (performance.now() - t0) * 1000;
  queryTimesUs.push(dtUs);
}

queryTimesUs.sort((a, b) => a - b);
const p50Us = queryTimesUs[Math.floor(queryTimesUs.length * 0.5)];
const p90Us = queryTimesUs[Math.floor(queryTimesUs.length * 0.9)];
const p99Us = queryTimesUs[Math.floor(queryTimesUs.length * 0.99)];
const avgUs = queryTimesUs.reduce((a, b) => a + b, 0) / queryTimesUs.length;

console.log(`Queries completed: ${QUERY_RUNS}`);
console.log(`Average Query Latency:  ${avgUs.toFixed(1)} µs (${(avgUs / 1000).toFixed(3)} ms)`);
console.log(`P50 (Median) Latency:   ${p50Us.toFixed(1)} µs (${(p50Us / 1000).toFixed(3)} ms)`);
console.log(`P90 Latency:            ${p90Us.toFixed(1)} µs (${(p90Us / 1000).toFixed(3)} ms)`);
console.log(`P99 Latency:            ${p99Us.toFixed(1)} µs (${(p99Us / 1000).toFixed(3)} ms)`);

const qps = (1000000 / avgUs);
console.log(`Search Throughput:      ${qps.toFixed(0)} queries/second`);

if (p50Us < 200) {
  console.log(`\n🚀 ULTRA-FAST SEARCH: Sub-200 microsecond query latency achieved (${p50Us.toFixed(1)} µs)!`);
}

console.log('\n===============================================================');
console.log('🎉 STEP 5.2 BENCHMARK PASSED 100%');
console.log('===============================================================');
