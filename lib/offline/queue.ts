// lib/offline/queue.ts
// PHASE 7: Offline queue using IndexedDB for agent forms.

const DB_NAME = "propflow-offline-v1";
const DB_VERSION = 1;

export interface QueuedMeterReading {
  id?: number;
  type: "meter-reading";
  buildingId: string;
  unitId: string;
  utility: "WATER" | "ELECTRICITY";
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
  billingMonth: string;
  agentClerkId: string;
  timestamp: number;
  synced: boolean;
  error?: string;
}

export interface QueuedReceipt {
  id?: number;
  type: "receipt";
  buildingId: string;
  tenantId: string;
  amount: number;
  method: "CASH" | "BANK_RECEIPT";
  referenceCode: string | null;
  billingMonth: string;
  description: string;
  agentClerkId: string;
  receiptPhotoBase64?: string | null;
  timestamp: number;
  synced: boolean;
  error?: string;
}

export type QueuedItem = QueuedMeterReading | QueuedReceipt;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

export async function queueMeterReading(
  item: Omit<QueuedMeterReading, "id" | "timestamp" | "synced">
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.add({ ...item, timestamp: Date.now(), synced: false });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function queueReceipt(
  item: Omit<QueuedReceipt, "id" | "timestamp" | "synced">
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.add({ ...item, timestamp: Date.now(), synced: false });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getUnsyncedItems(): Promise<QueuedItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const store = tx.objectStore("queue");
    const index = store.index("synced");
    const results: QueuedItem[] = [];
    const req = index.openCursor();
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        const val = cursor.value as QueuedItem;
        if (!val.synced) results.push(val);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markSynced(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markError(id: number, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.error = error;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueStats(): Promise<{ total: number; unsynced: number; errors: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const store = tx.objectStore("queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedItem[];
      resolve({
        total: all.length,
        unsynced: all.filter((i) => !i.synced).length,
        errors: all.filter((i) => i.error).length,
      });
    };
    req.onerror = () => reject(req.error);
  });
}