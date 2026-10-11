// Unlimited Local Storage using IndexedDB
// Prevents QuotaExceededError when project contains 100+ actors with Base64 photos.

const DB_NAME = 'backstage_large_store';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLargeProject(projectId: string, projectData: any): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(projectData, projectId);
      store.put(projectData, 'backstage_last_session');
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn('[LargeStorage] IndexedDB write failed:', e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[LargeStorage] Failed to access IndexedDB:', err);
    return false;
  }
}

export async function loadLargeProject(projectId: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(projectId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}
