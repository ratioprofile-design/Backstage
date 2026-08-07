export interface RecentFile {
  path: string;
  name: string;
  lastModified: number;
}

const STORAGE_KEY = 'recent_bst_files';

export function getRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentFile(path: string, name?: string): RecentFile[] {
  const cleanName = name || path.split('/').pop()?.replace(/\.(bst|json)$/i, '') || path;
  const entry: RecentFile = { path, name: cleanName, lastModified: Date.now() };
  const next = [entry, ...getRecentFiles().filter(f => f.path !== path)].slice(0, 8);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
