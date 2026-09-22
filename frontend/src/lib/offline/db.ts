import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface MoilOfflineDB extends DBSchema {
  emergency_data: {
    key: string;
    value: {
      id: string;
      data: ArrayBuffer;
      iv: Uint8Array;
      timestamp: number;
    };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      payload: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MoilOfflineDB>> | null = null;

export const getDB = () => {
  if (typeof window === 'undefined') return null; // Avoid running on server
  if (!dbPromise) {
    dbPromise = openDB<MoilOfflineDB>('moil-offline-db', 1, {
      upgrade(db) {
        db.createObjectStore('emergency_data', { keyPath: 'id' });
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
};

export const saveEncryptedData = async (id: string, encryptedBuffer: ArrayBuffer, iv: Uint8Array) => {
  const db = await getDB();
  if (!db) return;
  await db.put('emergency_data', {
    id,
    data: encryptedBuffer,
    iv,
    timestamp: Date.now()
  });
};

export const getEncryptedData = async (id: string) => {
  const db = await getDB();
  if (!db) return null;
  return await db.get('emergency_data', id);
};

export const queueSyncAction = async (id: string, action: 'create' | 'update' | 'delete', payload: any) => {
  const db = await getDB();
  if (!db) return;
  await db.put('sync_queue', {
    id,
    action,
    payload,
    timestamp: Date.now()
  });
};

export const getSyncQueue = async () => {
  const db = await getDB();
  if (!db) return [];
  return await db.getAll('sync_queue');
};

export const removeFromSyncQueue = async (id: string) => {
    const db = await getDB();
    if (!db) return;
    await db.delete('sync_queue', id);
};

export const clearSyncQueue = async () => {
    const db = await getDB();
    if (!db) return;
    await db.clear('sync_queue');
}

export const exportOfflineData = async () => {
    const db = await getDB();
    if (!db) return null;
    const emergencyData = await db.getAll('emergency_data');
    const syncQueue = await db.getAll('sync_queue');
    return JSON.stringify({ emergencyData, syncQueue });
};
