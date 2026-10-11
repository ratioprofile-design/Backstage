import * as XLSX from 'xlsx';
import { ArtistOption } from '../types';

export interface ParsedTalentItem extends ArtistOption {
  isDuplicate?: boolean;
  duplicateReason?: string;
  selected?: boolean;
}

export interface TalentImportResult {
  items: ParsedTalentItem[];
  totalParsed: number;
  newCount: number;
  duplicateCount: number;
}

/**
 * Normalizes an Instagram string (URL, @handle, or plain username)
 * into a clean username (without @) and a valid profile URL.
 */
export function normalizeInstagram(raw?: string): { handle: string; url: string } {
  if (!raw) return { handle: '', url: '' };

  let clean = raw.trim();

  // Strip query params & fragments (e.g. ?igsh=xyz or /reels/...)
  clean = clean.split('?')[0].split('#')[0];

  // Match instagram.com/(username) or instagram.com/reel/code or instagram.com/p/code
  const urlMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?instagr(?:\.am|am\.com)\/(?:[a-zA-Z0-9_.]+\/)?([a-zA-Z0-9_.]+)/i);
  if (urlMatch && urlMatch[1]) {
    const handle = urlMatch[1].replace(/\/+$/, '').toLowerCase();
    // Exclude reserved instagram paths like p, reel, stories, explore, direct
    if (!['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'tv'].includes(handle)) {
      return {
        handle: `@${handle}`,
        url: `https://www.instagram.com/${handle}/`,
      };
    }
  }

  // Match direct handle @username or username
  const atMatch = clean.match(/^@?([a-zA-Z0-9_.]+)$/);
  if (atMatch && atMatch[1]) {
    const handle = atMatch[1].toLowerCase();
    return {
      handle: `@${handle}`,
      url: `https://www.instagram.com/${handle}/`,
    };
  }

  return { handle: raw.trim(), url: raw.trim().startsWith('http') ? raw.trim() : '' };
}

/**
 * Normalizes a phone number to standard digits (stripping spaces, dashes, parentheses).
 */
export function normalizePhone(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Converts a username into Title Case Name (e.g. "vikram_prabhu" -> "Vikram Prabhu")
 */
export function handleToDisplayName(handle: string): string {
  const clean = handle.replace(/^@/, '').replace(/[._]+/g, ' ').trim();
  if (!clean) return 'Unknown Actor';
  return clean
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Split a delimited table line by Tab, Comma, or Semicolon
 */
function splitDelimitedLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, ''));
  }
  if (line.includes(';')) {
    return line.split(';').map((c) => c.trim().replace(/^["']|["']$/g, ''));
  }
  // Standard CSV split handling basic quotes
  return line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
}

/**
 * Universal Talent Importer:
 * Seamlessly auto-detects and extracts talent profiles from:
 * 1. CSV / TSV spreadsheets (with or without headers)
 * 2. WhatsApp chat exports (iOS, Android, Forwarded messages)
 * 3. Mixed pasted text containing both spreadsheets and chat messages
 */
export function parseUniversalTalentInput(
  rawText: string,
  existingTalentPool: ArtistOption[] = []
): TalentImportResult {
  if (!rawText || !rawText.trim()) {
    return { items: [], totalParsed: 0, newCount: 0, duplicateCount: 0 };
  }

  const existingHandles = new Set(
    existingTalentPool
      .map((t) => (t.instagramHandle || '').trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean)
  );
  const existingPhones = new Set(
    existingTalentPool
      .map((t) => normalizePhone(t.phone || t.contact?.phone))
      .filter((p) => p.length >= 7)
  );

  const seenInBatchHandles = new Set<string>();
  const seenInBatchPhones = new Set<string>();
  const parsedItems: ParsedTalentItem[] = [];

  const lines = rawText.split(/\r?\n/);

  // WhatsApp message header regex
  // iOS: [10/7/26, 4:57:34 PM] Vasanth PRO: ...
  // Android: 10/7/26, 16:57 - Vasanth PRO: ...
  const whatsAppHeaderRegex = /^(\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?\]?)\s*[-:]?\s*([^:]+):\s*(.*)$/;

  let currentSender = '';
  let currentBuffer: string[] = [];
  let inWhatsApp = false;

  function processWhatsAppBuffer(sender: string, bufferLines: string[]) {
    const text = bufferLines.join('\n').trim();
    if (!text) return;
    if (
      text.includes('end-to-end encrypted') ||
      text.includes('created group') ||
      text.includes('added You') ||
      text.includes('<message_history_notice') ||
      text.includes('Spreadsheet Access Needed') ||
      text.includes('<voice message omitted>')
    ) {
      return;
    }

    // Extract Instagram link
    const igMatches = Array.from(
      text.matchAll(/(?:https?:\/\/)?(?:www\.)?instagr(?:\.am|am\.com)\/(?:[a-zA-Z0-9_.]+\/)?([a-zA-Z0-9_.]+)/gi)
    );
    const igHandleMatches = Array.from(text.matchAll(/(?:^|\s)@([a-zA-Z0-9_.]+)/g));

    let detectedIgUrl = '';
    let detectedIgHandle = '';

    if (igMatches.length > 0) {
      const norm = normalizeInstagram(igMatches[0][0]);
      detectedIgUrl = norm.url;
      detectedIgHandle = norm.handle;
    } else if (igHandleMatches.length > 0) {
      const norm = normalizeInstagram(igHandleMatches[0][1]);
      detectedIgUrl = norm.url;
      detectedIgHandle = norm.handle;
    }

    // Phone extraction
    const phoneRegex = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0].trim().replace(/[\s-]/g, '') : '';

    if (!detectedIgHandle && !phone) return;

    // Name Extraction from WhatsApp message
    let name = '';
    const bLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Look for lines that look like a person's name
    for (const bLine of bLines) {
      if (
        bLine.includes('http') ||
        bLine.includes('[Forwarded]') ||
        bLine.includes('<image') ||
        bLine.includes('budget') ||
        bLine.includes('profile') ||
        bLine.includes('Video') ||
        bLine.includes('https://') ||
        bLine.includes('Singers:') ||
        bLine.includes('Directed by:') ||
        bLine.startsWith('+') ||
        bLine.length < 2 ||
        bLine.length > 45
      ) {
        continue;
      }
      name = bLine.replace(/^[•\-*]+\s*/, '').trim();
      break;
    }

    if (!name && detectedIgHandle) {
      name = handleToDisplayName(detectedIgHandle);
    }

    if (!name) name = 'WhatsApp Actor';

    addParsedItem({
      name,
      handle: detectedIgHandle,
      url: detectedIgUrl,
      phone,
      source: `WhatsApp (${sender || 'Group'})`,
      notes: text.length > 150 ? `${text.slice(0, 300)}...` : text,
      sourceRawText: text,
    });
  }

  function addParsedItem(data: {
    name: string;
    handle: string;
    url: string;
    phone?: string;
    location?: string;
    source: string;
    notes?: string;
    sourceRawText?: string;
  }) {
    const normHandle = (data.handle || '').toLowerCase().replace(/^@/, '');
    const normPhone = normalizePhone(data.phone);

    let isDuplicate = false;
    let duplicateReason = '';

    if (normHandle && existingHandles.has(normHandle)) {
      isDuplicate = true;
      duplicateReason = `Already in Talent Pool (@${normHandle})`;
    } else if (normPhone && normPhone.length >= 7 && existingPhones.has(normPhone)) {
      isDuplicate = true;
      duplicateReason = `Phone number matches existing talent (${data.phone})`;
    } else if (normHandle && seenInBatchHandles.has(normHandle)) {
      isDuplicate = true;
      duplicateReason = `Duplicate in import (@${normHandle})`;
    } else if (normPhone && normPhone.length >= 7 && seenInBatchPhones.has(normPhone)) {
      isDuplicate = true;
      duplicateReason = `Duplicate phone in import (${data.phone})`;
    }

    if (normHandle) seenInBatchHandles.add(normHandle);
    if (normPhone && normPhone.length >= 7) seenInBatchPhones.add(normPhone);

    const tags: string[] = [];
    if (data.location) tags.push(data.location);

    parsedItems.push({
      id: `talent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      rank: 1,
      status: 'idea',
      instagramHandle: data.handle,
      instagramUrl: data.url,
      phone: data.phone,
      contact: {
        phone: data.phone,
        agency: data.source,
      },
      tags: tags.length > 0 ? tags : undefined,
      notes: [data.notes, data.location ? `Location: ${data.location}` : ''].filter(Boolean).join(' | '),
      source: data.source.toLowerCase().includes('whatsapp') ? 'whatsapp' : 'spreadsheet',
      sourceRawText: data.sourceRawText || data.notes,
      isDuplicate,
      duplicateReason,
      selected: !isDuplicate,
    });
  }

  // Iterate line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if line is a WhatsApp header
    const wm = line.match(whatsAppHeaderRegex);
    if (wm) {
      if (currentBuffer.length > 0) {
        processWhatsAppBuffer(currentSender, currentBuffer);
      }
      currentSender = wm[2].trim();
      currentBuffer = [wm[3]];
      inWhatsApp = true;
      continue;
    }

    if (inWhatsApp) {
      currentBuffer.push(line);
      continue;
    }

    // Otherwise, check if this line is part of a CSV / spreadsheet table
    // (e.g. "Reksha nirosha ,Hyderabad ,https://www.instagram.com/rekha.nirosha...")
    if ((line.includes(',') || line.includes('\t') || line.includes(';')) && !line.startsWith('[')) {
      const parts = splitDelimitedLine(line);
      const firstCol = (parts[0] || '').toLowerCase();

      // Skip header rows like "Name ,Location ,Instagram id link"
      if (firstCol === 'name' || firstCol === 'actor' || firstCol.includes('location')) {
        continue;
      }

      // Find which column has the Instagram link or handle
      const igPart = parts.find((p) => p.includes('instagram.com') || p.startsWith('@'));
      if (igPart) {
        const norm = normalizeInstagram(igPart);
        const namePart = parts[0] || handleToDisplayName(norm.handle);
        const locPart = parts[1] && !parts[1].includes('instagram') && !parts[1].startsWith('http') ? parts[1] : '';

        if (norm.handle || namePart) {
          addParsedItem({
            name: namePart,
            handle: norm.handle,
            url: norm.url,
            location: locPart,
            source: locPart ? `Spreadsheet (${locPart})` : 'Spreadsheet',
            notes: line,
            sourceRawText: line,
          });
        }
        continue;
      }
    }

    // Direct standalone Instagram URL or handle
    const directIgMatch = line.match(/(?:https?:\/\/)?(?:www\.)?instagr(?:\.am|am\.com)\/(?:[a-zA-Z0-9_.]+\/)?([a-zA-Z0-9_.]+)/i);
    if (directIgMatch) {
      const norm = normalizeInstagram(directIgMatch[0]);
      if (norm.handle) {
        addParsedItem({
          name: handleToDisplayName(norm.handle),
          handle: norm.handle,
          url: norm.url,
          source: 'Pasted Link',
          notes: line,
          sourceRawText: line,
        });
      }
    }
  }

  if (currentBuffer.length > 0) {
    processWhatsAppBuffer(currentSender, currentBuffer);
  }

  const duplicateCount = parsedItems.filter((i) => i.isDuplicate).length;
  const newCount = parsedItems.length - duplicateCount;

  return {
    items: parsedItems,
    totalParsed: parsedItems.length,
    newCount,
    duplicateCount,
  };
}

/**
 * Parses raw WhatsApp chat export (.txt) or bulk pasted WhatsApp group messages.
 */
export function parseWhatsAppChat(
  rawText: string,
  existingTalentPool: ArtistOption[] = []
): TalentImportResult {
  return parseUniversalTalentInput(rawText, existingTalentPool);
}

/**
 * Parses tab-separated or comma-separated table rows pasted directly from Google Sheets or Excel.
 */
export function parsePastedTalentTable(
  tsvOrCsvText: string,
  existingTalentPool: ArtistOption[] = []
): TalentImportResult {
  return parseUniversalTalentInput(tsvOrCsvText, existingTalentPool);
}

/**
 * Parses an Excel file (.xlsx, .xls) or CSV or Google Sheets export for talent profiles.
 */
export async function parseTalentSpreadsheet(
  fileOrBuffer: File | ArrayBuffer,
  existingTalentPool: ArtistOption[] = []
): Promise<TalentImportResult> {
  if (fileOrBuffer instanceof File && fileOrBuffer.name.toLowerCase().endsWith('.csv')) {
    const text = await fileOrBuffer.text();
    return parseUniversalTalentInput(text, existingTalentPool);
  }

  const buffer =
    fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  return parseUniversalTalentInput(csv, existingTalentPool);
}
