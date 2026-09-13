import * as XLSX from 'xlsx';
import { Beat } from '../types';

export interface SpreadsheetParseResult {
  beats: Beat[];
  scriptText: string;
}

export function formatEighths(eighths: number): string {
  if (eighths <= 0) return '1/8';
  const fullPages = Math.floor(eighths / 8);
  const remEighths = eighths % 8;

  if (fullPages === 0) {
    return `${remEighths}/8`;
  }
  if (remEighths === 0) {
    return `${fullPages}`;
  }
  return `${fullPages} ${remEighths}/8`;
}

/**
 * Parses an Excel (.xlsx, .xls, .csv) file or Google Sheets export into structured scenes.
 */
export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  return parseTableRows(rows);
}

/**
 * Parses tab-separated text directly pasted from Google Sheets or Excel.
 */
export function parsePastedTable(tsvText: string): SpreadsheetParseResult {
  if (!tsvText || !tsvText.trim()) {
    return { beats: [], scriptText: '' };
  }

  const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.map((line) => line.split('\t'));
  return parseTableRows(rows);
}

function parseTableRows(rows: any[][]): SpreadsheetParseResult {
  if (!rows || rows.length < 2) {
    return { beats: [], scriptText: '' };
  }

  // Find header row indices
  const headerRow = rows[0].map((h) => String(h).trim().toLowerCase());

  let sceneNumIdx = -1;
  let intExtIdx = -1;
  let locationIdx = -1;
  let timeIdx = -1;
  let descIdx = -1;
  let castIdx = -1;
  let propsIdx = -1;
  let stuntsIdx = -1;
  let pagesIdx = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const col = headerRow[i];
    if (col.includes('scene') || col.includes('காட்சி') || col === 'sc #' || col === 'no') {
      sceneNumIdx = i;
    } else if (col.includes('int') || col.includes('ext') || col.includes('உள்') || col.includes('வெளி') || col.includes('i/e')) {
      intExtIdx = i;
    } else if (col.includes('loc') || col.includes('இடம்') || col.includes('set')) {
      locationIdx = i;
    } else if (col.includes('day') || col.includes('night') || col.includes('நேரம்') || col.includes('time')) {
      timeIdx = i;
    } else if (col.includes('desc') || col.includes('synopsis') || col.includes('action') || col.includes('விவரம்') || col.includes('story')) {
      descIdx = i;
    } else if (col.includes('cast') || col.includes('actor') || col.includes('char') || col.includes('நடிகர்')) {
      castIdx = i;
    } else if (col.includes('prop') || col.includes('பொருள்')) {
      propsIdx = i;
    } else if (col.includes('stunt') || col.includes('action') || col.includes('சண்டை')) {
      stuntsIdx = i;
    } else if (col.includes('page') || col.includes('பக்கம்') || col.includes('eighth')) {
      pagesIdx = i;
    }
  }

  // Fallbacks if not detected by header name
  if (sceneNumIdx === -1) sceneNumIdx = 0;
  if (intExtIdx === -1 && rows[0].length > 1) intExtIdx = 1;
  if (locationIdx === -1 && rows[0].length > 2) locationIdx = 2;
  if (timeIdx === -1 && rows[0].length > 3) timeIdx = 3;
  if (descIdx === -1 && rows[0].length > 4) descIdx = 4;

  const beats: Beat[] = [];
  const scriptLines: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c: any) => String(c).trim() === '')) continue;

    const rawSceneNum = String(row[sceneNumIdx] || r).trim();
    const rawIntExt = String(row[intExtIdx] || 'INT').toUpperCase().trim();
    const rawLoc = String(row[locationIdx] || 'LOCATION').trim();
    const rawTime = String(row[timeIdx] || 'DAY').toUpperCase().trim();
    const rawDesc = String(row[descIdx] || '').trim();
    const rawCast = castIdx !== -1 ? String(row[castIdx] || '').trim() : '';
    const rawProps = propsIdx !== -1 ? String(row[propsIdx] || '').trim() : '';
    const rawStunts = stuntsIdx !== -1 ? String(row[stuntsIdx] || '').trim() : '';
    const rawPages = pagesIdx !== -1 ? String(row[pagesIdx] || '1/8').trim() : '1/8';

    const intExt: any = rawIntExt.includes('EXT') ? 'EXT' : rawIntExt.includes('வெளி') ? 'வெளி' : 'INT';
    const timeOfDay: any = rawTime.includes('NIGHT') || rawTime.includes('இரவு') ? 'NIGHT' : 'DAY';

    let eighths = 1;
    if (rawPages.includes('/8')) {
      const parts = rawPages.split('/');
      eighths = parseInt(parts[0], 10) || 1;
    } else {
      eighths = Math.max(1, Math.round((parseFloat(rawPages) || 0.125) * 8));
    }

    const heading = `${intExt}. ${rawLoc} - ${timeOfDay}`;
    const castNames = rawCast ? rawCast.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean) : [];
    const propNames = rawProps ? rawProps.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean) : [];
    const stuntNames = rawStunts ? rawStunts.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : [];

    const beatId = Date.now() + r;
    const beat: Beat = {
      id: beatId,
      sceneNumber: rawSceneNum,
      title: heading,
      summary: rawDesc,
      slug: {
        prefix: intExt ? `${intExt}.` : 'INT.',
        location: rawLoc || 'LOCATION',
        time: timeOfDay || 'DAY'
      },
      content: `<div class="sc-line sc-action">${rawDesc || '<br>'}</div>${castNames.length ? `<div class="sc-line sc-action"><b>CAST:</b> ${castNames.join(', ')}</div>` : ''}`,
      status: 'not-ready',
      x: 60 + ((r - 1) % 4) * 360,
      y: 60 + Math.floor((r - 1) / 4) * 220,
      breakdown: {
        cast: castNames,
        props: propNames,
        costume: [],
        vfx: [],
        practical: stuntNames,
        sound: [],
        location: [rawLoc],
      },
    };

    beats.push(beat);

    scriptLines.push(heading);
    if (rawDesc) scriptLines.push(rawDesc);
    scriptLines.push('');
  }

  return {
    beats,
    scriptText: scriptLines.join('\n'),
  };
}
