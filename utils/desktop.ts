export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Dynamic imports to prevent load-time execution crashes in standard web browsers
export async function getTauriFs() {
  if (!isTauri()) return null;
  return await import('@tauri-apps/plugin-fs');
}

export async function getTauriDialog() {
  if (!isTauri()) return null;
  return await import('@tauri-apps/plugin-dialog');
}

export async function getTauriWindow() {
  if (!isTauri()) return null;
  return await import('@tauri-apps/api/window');
}
