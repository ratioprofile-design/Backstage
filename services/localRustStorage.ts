import { isTauri } from '../utils/desktop';

export interface LocalProjectMeta {
  id: string;
  file_path: string;
  file_size_bytes: number;
  updated_at: number;
}

export interface StorageStats {
  projects_dir: string;
  total_projects: number;
  total_size_bytes: number;
}

export interface SaveProjectResult {
  success: boolean;
  filePath?: string;
  fileSizeBytes?: number;
  error?: string;
}

/**
 * Save project data directly to local disk via Rust backend in microseconds.
 * Atomic write prevents corruption. Unlimited payload size.
 */
export async function saveProjectToRustDisk(projectId: string, projectData: any): Promise<SaveProjectResult> {
  if (!isTauri()) {
    return { success: false, error: 'Not running in native Tauri desktop environment' };
  }

  const startTime = performance.now();
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonString = JSON.stringify(projectData);

    const result = await invoke<LocalProjectMeta>('save_project_local', {
      projectId,
      data: jsonString,
    });

    const elapsed = Math.round(performance.now() - startTime);
    console.log(
      `[RustStorage] ✓ Atomically saved project "${projectId}" to disk in ${elapsed}ms (${(result.file_size_bytes / 1024).toFixed(1)} KB)`
    );

    return {
      success: true,
      filePath: result.file_path,
      fileSizeBytes: result.file_size_bytes,
    };
  } catch (err: any) {
    console.error(`[RustStorage] ✗ Failed to save project "${projectId}" to disk:`, err);
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Load project data directly from local disk via Rust backend.
 */
export async function loadProjectFromRustDisk(projectId: string): Promise<any | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonString = await invoke<string>('load_project_local', { projectId });
    if (!jsonString) return null;
    return JSON.parse(jsonString);
  } catch (err: any) {
    console.warn(`[RustStorage] Could not load project "${projectId}" from disk:`, err?.message || err);
    return null;
  }
}

/**
 * List all projects saved locally on disk.
 */
export async function listRustLocalProjects(): Promise<LocalProjectMeta[]> {
  if (!isTauri()) return [];

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<LocalProjectMeta[]>('list_local_projects');
  } catch (err) {
    console.error('[RustStorage] Failed to list local projects:', err);
    return [];
  }
}

/**
 * Delete a local project from disk.
 */
export async function deleteRustLocalProject(projectId: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('delete_project_local', { projectId });
  } catch (err) {
    console.error(`[RustStorage] Failed to delete local project "${projectId}":`, err);
    return false;
  }
}

/**
 * Get disk usage stats for local Backstage projects.
 */
export async function getRustStorageStats(): Promise<StorageStats | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<StorageStats>('get_storage_stats');
  } catch (err) {
    console.error('[RustStorage] Failed to get storage stats:', err);
    return null;
  }
}

/**
 * Save project documents directly to local disk via Rust backend without any 5MB localStorage limits.
 */
export async function saveDocumentsToRustDisk(projectId: string, documents: any[]): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonString = JSON.stringify(documents);
    await invoke('save_documents_local', {
      projectId,
      docsJson: jsonString,
    });
    return true;
  } catch (err) {
    console.warn(`[RustStorage] Notice: Failed to save documents to disk for "${projectId}":`, err);
    return false;
  }
}

/**
 * Load project documents directly from local disk via Rust backend.
 */
export async function loadDocumentsFromRustDisk(projectId: string): Promise<any[] | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const jsonString = await invoke<string>('load_documents_local', { projectId });
    if (!jsonString || jsonString === '[]') return null;
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.warn(`[RustStorage] Notice: Failed to load documents from disk for "${projectId}":`, err);
    return null;
  }
}
