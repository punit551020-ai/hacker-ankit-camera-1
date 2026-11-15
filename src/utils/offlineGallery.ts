import type { MediaItemRecord } from '../types/camera';

const DB_NAME = 'hacker-ankit-camera-db';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB failed to open'));
  });
}

export async function saveMediaToOfflineDb(item: MediaItemRecord): Promise<void> {
  const db = await openGalleryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to write capture to offline storage'));
  });
}

export async function getAllOfflineMedia(): Promise<MediaItemRecord[]> {
  const db = await openGalleryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const list = (req.result as MediaItemRecord[]) || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error || new Error('Failed to read gallery items'));
  });
}

export async function deleteOfflineMedia(id: string): Promise<void> {
  const db = await openGalleryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete capture'));
  });
}

export async function clearAllOfflineMedia(): Promise<void> {
  const db = await openGalleryDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to clear gallery'));
  });
}

export function triggerDeviceDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 4000);
}

export interface DirectoryHandleLike {
  name: string;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickDevicePicturesFolder(): Promise<DirectoryHandleLike | null> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirectoryHandleLike>;
    }
  ).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker({ mode: 'readwrite', startIn: 'pictures' });
  } catch {
    return null;
  }
}

export async function writeBlobToFolder(
  dirHandle: DirectoryHandleLike | null,
  blob: Blob,
  filename: string
): Promise<boolean> {
  if (!dirHandle) return false;
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function canNativeShareFiles(blob: Blob, filename: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return true;
  try {
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareMediaFile(
  blob: Blob,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: 'Captured with Hacker Ankit Camera',
        });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }
  triggerDeviceDownload(blob, filename);
  return 'downloaded';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDurationClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
