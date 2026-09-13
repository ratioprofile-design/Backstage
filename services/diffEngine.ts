import { DiffResult, Beat } from '../types';

export interface VersionComparisonSummary {
  results: DiffResult[];
  addedScenesCount: number;
  removedScenesCount: number;
  modifiedScenesCount: number;
  unchangedScenesCount: number;
  newProps: any[];
  newStunts: any[];
  newCast: any[];
  netPageShiftEighths: number;
}

export function compareScriptVersions(scenesA: any[], scenesB: any[]): VersionComparisonSummary {
  const mapA = new Map<string, any>();
  const mapB = new Map<string, any>();

  // Map by normalized scene number or ID
  scenesA.forEach((s) => mapA.set(String(s.sceneNumber || s.id).trim(), s));
  scenesB.forEach((s) => mapB.set(String(s.sceneNumber || s.id).trim(), s));

  const allSceneNumbers = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort((a, b) => {
    const numA = parseInt(a, 10) || 0;
    const numB = parseInt(b, 10) || 0;
    return numA - numB;
  });

  const results: DiffResult[] = [];
  const newPropsList: any[] = [];
  const newStuntsList: any[] = [];
  const newCastList: any[] = [];

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;
  let totalPageShift = 0;

  for (const sceneNum of allSceneNumbers) {
    const sceneA = mapA.get(sceneNum);
    const sceneB = mapB.get(sceneNum);

    const getItems = (s: any) => {
      if (s?.breakdownItems) return s.breakdownItems;
      if (s?.breakdownData) {
        const items: any[] = [];
        Object.entries(s.breakdownData).forEach(([cat, list]: [string, any]) => {
          if (Array.isArray(list)) {
            list.forEach(item => items.push({
              category: cat.toUpperCase(),
              name: typeof item === 'string' ? item : item.name,
            }));
          }
        });
        return items;
      }
      return [];
    };

    const getHeading = (s: any) => s?.rawHeading || s?.title || `SCENE ${s?.sceneNumber || s?.id}`;
    const getScript = (s: any) => s?.rawScript || s?.text || s?.html || '';
    const getPages = (s: any) => s?.pagesEighths || (s?.pageCount ? Math.round(parseFloat(s.pageCount) * 8) : 8);

    if (!sceneA && sceneB) {
      // Added in Revision B
      addedCount++;
      const pageShift = getPages(sceneB);
      totalPageShift += pageShift;

      const items = getItems(sceneB);
      items.forEach((item: any) => {
        if (item.category === 'PROPS' || item.category === 'PROP') newPropsList.push(item);
        if (item.category === 'STUNTS' || item.category === 'STUNT' || item.category === 'PRACTICAL') newStuntsList.push(item);
        if (item.category === 'CAST') newCastList.push(item);
      });

      results.push({
        sceneId: String(sceneB.id),
        sceneNumber: sceneNum,
        status: 'ADDED',
        titleB: getHeading(sceneB),
        textB: getScript(sceneB),
        addedItems: items,
        removedItems: [],
        pageShiftEighths: pageShift,
      });
    } else if (sceneA && !sceneB) {
      // Removed in Revision B
      removedCount++;
      const pageShift = -getPages(sceneA);
      totalPageShift += pageShift;

      results.push({
        sceneId: String(sceneA.id),
        sceneNumber: sceneNum,
        status: 'REMOVED',
        titleA: getHeading(sceneA),
        textA: getScript(sceneA),
        addedItems: [],
        removedItems: getItems(sceneA),
        pageShiftEighths: pageShift,
      });
    } else if (sceneA && sceneB) {
      // Both exist - compare text and items
      const textA = getScript(sceneA).trim();
      const textB = getScript(sceneB).trim();
      const textChanged = textA !== textB;
      const pageShift = getPages(sceneB) - getPages(sceneA);
      totalPageShift += pageShift;

      const itemsA = getItems(sceneA);
      const itemsB = getItems(sceneB);

      const namesA = new Set(itemsA.map((i: any) => `${i.category}:${i.name?.toLowerCase()}`));
      const namesB = new Set(itemsB.map((i: any) => `${i.category}:${i.name?.toLowerCase()}`));

      const addedItems = itemsB.filter((i: any) => !namesA.has(`${i.category}:${i.name?.toLowerCase()}`));
      const removedItems = itemsA.filter((i: any) => !namesB.has(`${i.category}:${i.name?.toLowerCase()}`));

      addedItems.forEach((item: any) => {
        if (item.category === 'PROPS' || item.category === 'PROP') newPropsList.push(item);
        if (item.category === 'STUNTS' || item.category === 'STUNT' || item.category === 'PRACTICAL') newStuntsList.push(item);
        if (item.category === 'CAST') newCastList.push(item);
      });

      if (textChanged || addedItems.length > 0 || removedItems.length > 0 || pageShift !== 0) {
        modifiedCount++;
        results.push({
          sceneId: String(sceneB.id),
          sceneNumber: sceneNum,
          status: 'MODIFIED',
          titleA: getHeading(sceneA),
          titleB: getHeading(sceneB),
          textA: textA,
          textB: textB,
          addedItems,
          removedItems,
          pageShiftEighths: pageShift,
        });
      } else {
        unchangedCount++;
        results.push({
          sceneId: String(sceneB.id),
          sceneNumber: sceneNum,
          status: 'UNCHANGED',
          titleA: getHeading(sceneA),
          titleB: getHeading(sceneB),
          textA: textA,
          textB: textB,
          addedItems: [],
          removedItems: [],
          pageShiftEighths: 0,
        });
      }
    }
  }

  return {
    results,
    addedScenesCount: addedCount,
    removedScenesCount: removedCount,
    modifiedScenesCount: modifiedCount,
    unchangedScenesCount: unchangedCount,
    newProps: deduplicateItems(newPropsList),
    newStunts: deduplicateItems(newStuntsList),
    newCast: deduplicateItems(newCastList),
    netPageShiftEighths: totalPageShift,
  };
}

function deduplicateItems(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of items) {
    const key = (item.name || '').toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
