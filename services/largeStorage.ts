// Unlimited Local Storage using IndexedDB
// Prevents QuotaExceededError when project contains 100+ actors with Base64 photos or Vault documents with large PDFs.

const DB_NAME = 'backstage_large_store';
const STORE_NAME = 'projects';
const DOCS_STORE_NAME = 'documents';
const DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains(DOCS_STORE_NAME)) {
        db.createObjectStore(DOCS_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      console.warn('[LargeStorage] IndexedDB upgrade blocked by another tab');
    };
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

export async function saveLargeDocuments(projectId: string, docs: any[]): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const useDocsStore = db.objectStoreNames.contains(DOCS_STORE_NAME);
      const storeName = useDocsStore ? DOCS_STORE_NAME : STORE_NAME;
      const key = useDocsStore ? projectId : `docs_${projectId}`;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(docs, key);
      store.put(docs, useDocsStore ? 'backstage_last_docs' : 'docs_backstage_last_docs');
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn('[LargeStorage] IndexedDB write failed for documents:', e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[LargeStorage] Failed to access IndexedDB for documents:', err);
    return false;
  }
}

export async function loadLargeDocuments(projectId: string): Promise<any[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const useDocsStore = db.objectStoreNames.contains(DOCS_STORE_NAME);
      const storeName = useDocsStore ? DOCS_STORE_NAME : STORE_NAME;
      const key = useDocsStore ? projectId : `docs_${projectId}`;
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result)) {
          resolve(req.result);
        } else if (useDocsStore && db.objectStoreNames.contains(STORE_NAME)) {
          // Fallback to check STORE_NAME if store was recently upgraded
          try {
            const fallbackTx = db.transaction(STORE_NAME, 'readonly');
            const fallbackStore = fallbackTx.objectStore(STORE_NAME);
            const fallbackReq = fallbackStore.get(`docs_${projectId}`);
            fallbackReq.onsuccess = () => {
              if (fallbackReq.result && Array.isArray(fallbackReq.result)) {
                resolve(fallbackReq.result);
              } else {
                resolve(null);
              }
            };
            fallbackReq.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

