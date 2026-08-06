/**
 * Utility functions for handling bilingual (Tamil / English) character names
 * and matching script character names with breakdown character names.
 */

export interface CharacterNameParts {
  full: string;
  primary: string;
  secondary: string;
  tokens: string[];
}

/**
 * Extracts components and tokens from a character name string.
 * Handles formats like:
 * - "அபிராமி (Abhirami)"
 * - "Abhirami (அபிராமி)"
 * - "KAVYA"
 * - "காவ்யா"
 */
export function parseCharacterNameParts(name: string): CharacterNameParts {
  if (!name) {
    return { full: '', primary: '', secondary: '', tokens: [] };
  }

  const trimmed = name.trim();
  const match = trimmed.match(/^(.*?)\s*[\(\u200B]*([^\)]*)[\)]*$/);

  let primary = trimmed;
  let secondary = '';

  if (match && match[2] && match[2].trim()) {
    primary = match[1].trim();
    secondary = match[2].trim();
  }

  // Remove trailing punctuation or extensions like (V.O.) or (O.S.) or (7)
  const cleanStr = (s: string) =>
    s
      .replace(/\s*\(.*?\)$/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .toLowerCase();

  const primaryClean = cleanStr(primary);
  const secondaryClean = cleanStr(secondary);
  const fullClean = cleanStr(trimmed);

  const tokens = new Set<string>();
  if (fullClean) tokens.add(fullClean);
  if (primaryClean) tokens.add(primaryClean);
  if (secondaryClean) tokens.add(secondaryClean);

  return {
    full: trimmed,
    primary,
    secondary,
    tokens: Array.from(tokens).filter((t) => t.length > 0),
  };
}

/**
 * Determines if two character names refer to the same character entity.
 * Example: "காவ்யா (Kavya)" and "KAVYA" -> true
 * Example: "அபிராமி (Abhirami)" and "அபிராமி" -> true
 */
export function isSameCharacterName(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();

  if (n1 === n2) return true;

  const parts1 = parseCharacterNameParts(name1);
  const parts2 = parseCharacterNameParts(name2);

  // Check if any token overlaps
  for (const t1 of parts1.tokens) {
    for (const t2 of parts2.tokens) {
      if (t1 === t2) return true;
      // Handle case where one token is contained in another if length >= 3
      if (t1.length >= 3 && t2.length >= 3) {
        if (t1.includes(t2) || t2.includes(t1)) return true;
      }
    }
  }

  return false;
}

/**
 * Returns the richer/more descriptive name between two matching character names.
 * Prefers bilingual "Tamil (English)" over single name.
 */
export function getPreferredCharacterDisplayName(name1: string, name2: string): string {
  if (!name1) return name2 || '';
  if (!name2) return name1 || '';

  const hasParen1 = /\(.*\)/.test(name1);
  const hasParen2 = /\(.*\)/.test(name2);

  if (hasParen1 && !hasParen2) return name1;
  if (hasParen2 && !hasParen1) return name2;

  return name1.length >= name2.length ? name1 : name2;
}

/**
 * Finds an existing matching character name in a list/set if it represents the same character.
 */
export function findMatchingCharacterInSet(
  name: string,
  existingNames: Iterable<string>
): string | null {
  for (const existing of existingNames) {
    if (isSameCharacterName(name, existing)) {
      return existing;
    }
  }
  return null;
}

/**
 * Returns ordered candidate strings to search for in script text when highlighting or locating a item/character.
 */
export function getHighlightSearchTerms(text: string): string[] {
  if (!text) return [];

  const candidates: string[] = [];
  const trimmed = text.trim();
  candidates.push(trimmed);

  const parts = parseCharacterNameParts(trimmed);
  if (parts.primary && parts.primary !== trimmed) {
    candidates.push(parts.primary);
  }
  if (parts.secondary && parts.secondary !== trimmed) {
    candidates.push(parts.secondary);
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(candidates.filter((c) => c && c.length > 0)));
}

/**
 * Deduplicates an array of character names, combining bilingual and single names into unified entries.
 */
export function deduplicateCharacterNames(names: string[]): string[] {
  const result: string[] = [];

  for (const name of names) {
    if (!name || !name.trim()) continue;
    const existing = findMatchingCharacterInSet(name, result);
    if (existing) {
      // Replace existing with preferred if current is richer
      const preferred = getPreferredCharacterDisplayName(existing, name);
      if (preferred !== existing) {
        const idx = result.indexOf(existing);
        if (idx !== -1) result[idx] = preferred;
      }
    } else {
      result.push(name.trim());
    }
  }

  return result;
}
