import { Beat, CharacterData, Shot, WritingGoal } from '../types';

const stripHtml = (html: string): string =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const countWords = (html: string): number => {
  const text = stripHtml(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
};

const truncate = (text: string, max: number): string => {
  if (!text) return '';
  const clean = stripHtml(text);
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
};

const nameOf = (item: string | { name: string; source?: string }): string =>
  typeof item === 'string' ? item : item?.name || '';

export interface ContinuityLook {
  id: string;
  dept: string;
  targetName: string;
  lookNumber: number;
  title: string;
  fromScene: number;
  toScene: number;
  description?: string;
  damageLevel?: string;
  bloodLevel?: string;
  notes?: string;
  status?: string;
}

export function readContinuityLooks(): ContinuityLook[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem('backstage_continuity_looks');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface ProjectSnapshotInput {
  projectName: string;
  beats: Beat[];
  characterData: Record<string, CharacterData>;
  generatedShots: Shot[];
  globalNotes?: { content: string }[];
  writingGoal?: WritingGoal | null;
  dailyStats?: Record<string, number>;
  maxScenes?: number;
}

// Serializes everything Backstage knows about the project into a structured
// text report the AI can answer questions about and summarize into reports.
export function buildProjectSnapshot(input: ProjectSnapshotInput): string {
  const { projectName, beats, characterData, generatedShots } = input;
  const maxScenes = input.maxScenes || 60;

  const scenes = beats
    .map((b) => ({ beat: b, num: b.sceneNumber || String(beats.indexOf(b) + 1) }))
    .filter((s) => s.beat.title || s.beat.content || s.beat.summary);

  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.beat.content), 0);
  const estPages = Math.round(totalWords / 55);
  const estMinutes = estPages;
  const shotsAll = generatedShots || [];

  const lines: string[] = [];
  lines.push(`PROJECT: ${projectName}`);
  lines.push(`OVERVIEW: ${scenes.length} scenes, ${totalWords.toLocaleString()} words (~${estPages} pages, ~${estMinutes} min runtime), ${Object.keys(characterData || {}).length} characters, ${shotsAll.length} storyboard shots.`);
  lines.push('');

  // ---- SCRIPT ANALYSIS / SCENE LIST ----
  lines.push(`== SCRIPT ANALYSIS (${scenes.length} scenes) ==`);
  scenes.slice(0, maxScenes).forEach(({ beat, num }, i) => {
    const status = beat.status === 'ready' ? 'LOCKED' : 'NOT READY';
    const words = countWords(beat.content);
    const loc = beat.slug?.location || '?';
    const time = beat.slug?.time || '?';
    const bd = beat.breakdown;
    const bdCount = bd ? Object.values(bd).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
    const shots = Array.isArray(beat.shots) ? beat.shots.length : 0;
    const summary = beat.summary ? truncate(beat.summary, 220) : '';
    lines.push(
      `${num}. [${status}] "${beat.title || 'Untitled'}" | ${loc} — ${time} | ${words} words | ${bdCount} breakdown items | ${shots} shots` +
      (summary ? `\n   Synopsis: ${summary}` : '')
    );
  });
  if (scenes.length > maxScenes) lines.push(`… and ${scenes.length - maxScenes} more scenes.`);
  lines.push('');

  // ---- BREAKDOWN REPORT (aggregated across scenes) ----
  const bdCategories: (keyof NonNullable<Beat['breakdown']>)[] = ['sound', 'props', 'costume', 'vfx', 'practical', 'cast', 'location'];
  const bdTitles: Record<string, string> = {
    sound: 'SOUND', props: 'PROPS', costume: 'COSTUME', vfx: 'VFX',
    practical: 'PRACTICAL / SFX', cast: 'EXTRAS / NON-SPEAKING CAST', location: 'LOCATION NOTES',
  };
  lines.push('== BREAKDOWN REPORT ==');
  let anyBreakdown = false;
  bdCategories.forEach((cat) => {
    const counts = new Map<string, number>();
    const sceneRefs = new Map<string, string[]>();
    scenes.forEach(({ beat, num }) => {
      const arr = beat.breakdown?.[cat];
      if (!Array.isArray(arr) || arr.length === 0) return;
      arr.forEach((item) => {
        const nm = nameOf(item);
        if (!nm) return;
        counts.set(nm, (counts.get(nm) || 0) + 1);
        const refs = sceneRefs.get(nm) || [];
        if (refs.length < 6 && !refs.includes(num)) refs.push(num);
        sceneRefs.set(nm, refs);
      });
    });
    if (counts.size === 0) return;
    anyBreakdown = true;
    lines.push(`— ${bdTitles[cat]} (${counts.size} unique):`);
    let idx = 0;
    counts.forEach((count, itemName) => {
      if (idx++ >= 40) return;
      const refs = (sceneRefs.get(itemName) || []).join(', ');
      lines.push(`  • ${itemName} ×${count}${refs ? ` (scenes ${refs})` : ''}`);
    });
  });
  if (!anyBreakdown) lines.push('No breakdown data generated yet. Run breakdown analysis in the Breakdown view.');
  lines.push('');

  // ---- SHOT LIST ----
  lines.push('== STORYBOARD / SHOT LIST ==');
  if (shotsAll.length > 0) {
    const byScene = new Map<string, Shot[]>();
    shotsAll.forEach((s) => {
      const key = String(s.scene ?? '?');
      if (!byScene.has(key)) byScene.set(key, []);
      byScene.get(key)!.push(s);
    });
    byScene.forEach((shots, scene) => {
      lines.push(`Scene ${scene} (${shots.length} shots):`);
      shots.slice(0, 8).forEach((s) => {
        lines.push(`  • ${s.shotSize || '?'} / ${s.angle || '?'} — ${truncate(s.description || s.subject || '', 120)}`);
      });
      if (shots.length > 8) lines.push(`  … and ${shots.length - 8} more`);
    });
  } else {
    lines.push('No shot list yet. Generate shots in the Storyboard view.');
  }
  lines.push('');

  // ---- CONTINUITY REPORT ----
  lines.push('== CONTINUITY REPORT ==');
  const looks = readContinuityLooks();
  if (looks.length > 0) {
    const flagged = looks.filter((l) => l.status === 'Mismatched Warning' || l.damageLevel === 'Severe' || l.damageLevel === 'Destroyed');
    if (flagged.length > 0) lines.push(`⚠ ${flagged.length} continuity item(s) need attention.`);
    looks.slice(0, 40).forEach((l) => {
      lines.push(
        `• [${l.dept?.toUpperCase() || '?'}] ${l.targetName || '?'} — ${l.title || l.lookNumber || '?'} | scenes ${l.fromScene ?? '?'}-${l.toScene ?? '?'}${l.status ? ` | ${l.status}` : ''}` +
        (l.damageLevel || l.bloodLevel ? ` | ${[l.damageLevel, l.bloodLevel].filter(Boolean).join(', ')}` : '') +
        (l.notes ? ` | ${truncate(l.notes, 80)}` : '')
      );
    });
    if (looks.length > 40) lines.push(`… and ${looks.length - 40} more continuity items.`);
  } else {
    lines.push('No continuity looks tracked yet. Add looks in the Continuity view.');
  }
  lines.push('');

  // ---- CASTING ROSTER ----
  lines.push('== CASTING ROSTER ==');
  const chars = Object.values(characterData || {});
  if (chars.length > 0) {
    chars.forEach((c) => {
      const artist = c.confirmedArtistId && (c.artists || []).find((a) => a.id === c.confirmedArtistId);
      lines.push(
        `• ${c.name}${c.billingTier ? ` (${c.billingTier})` : ''}${c.archetype ? ` — ${c.archetype}` : ''}` +
        `${artist ? ` | cast: ${artist.name}` : ''}` +
        `${c.aliases?.length ? ` | aka ${c.aliases.join(', ')}` : ''}`
      );
    });
  } else {
    lines.push('No character roster yet. Add characters in the Casting view.');
  }
  lines.push('');

  // ---- NOTES & PROGRESS ----
  const notes = input.globalNotes || [];
  if (notes.length > 0) {
    lines.push('== NOTES ==');
    notes.slice(0, 15).forEach((n) => lines.push(`• ${truncate(n.content || '', 160)}`));
    if (notes.length > 15) lines.push(`… and ${notes.length - 15} more notes.`);
    lines.push('');
  }
  const goal = input.writingGoal;
  const dailyStats = input.dailyStats || {};
  if (goal?.isActive) {
    const days = Object.keys(dailyStats);
    const recent = days.slice(-7).map((d) => `${d}: ${dailyStats[d] || 0}`).join(', ');
    lines.push(`== WRITING GOAL ==`);
    lines.push(`Target: ${goal.targetAmount || goal.dailyTarget || 0} ${goal.type}${goal.deadline ? `, deadline ${new Date(goal.deadline).toLocaleDateString()}` : ''}`);
    if (recent) lines.push(`Recent daily words: ${recent}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function snapshotStats(input: ProjectSnapshotInput): {
  scenes: number; words: number; pages: number; characters: number; shots: number; breakdownItems: number; continuityItems: number;
} {
  const beats = input.beats || [];
  const words = beats.reduce((sum, b) => sum + countWords(b.content), 0);
  let breakdownItems = 0;
  beats.forEach((b) => {
    if (b.breakdown) Object.values(b.breakdown).forEach((arr) => { if (Array.isArray(arr)) breakdownItems += arr.length; });
  });
  return {
    scenes: beats.length,
    words,
    pages: Math.round(words / 55),
    characters: Object.keys(input.characterData || {}).length,
    shots: (input.generatedShots || []).length,
    breakdownItems,
    continuityItems: readContinuityLooks().length,
  };
}
