/**
 * 媒体面板本地存储：使用 IndexedDB 存储媒体列表，配额远大于 localStorage。
 * 单条结构：id, name, type, addedAt；远程资源用 url，本地上传用 blob（直接存文件，不转 base64）。
 */

const DB_NAME = "ViteCutMediaDB";
const DB_VERSION = 1;
const STORE_NAME = "records";

export type MediaRecord = {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  addedAt: number;
  /** 远程资源（如 Pexels / Freesound）的 HTTP URL */
  url?: string;
  /** 本地上传的文件，直接存 Blob，省空间且无需 base64 */
  blob?: Blob;
  /** 媒体封面或波形图 URL，音频可用于展示波形图 */
  coverUrl?: string;
  duration?: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/** 通知媒体库变更：传入新增记录时仅追加，不传则由面板自行全量刷新（如删除、更新） */
function notifyUpdated(added?: MediaRecord): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vitecut-media-storage-updated", { detail: added })
    );
  }
}

export function getAll(): Promise<MediaRecord[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () =>
          resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      })
  );
}

export function add(record: MediaRecord): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => {
          notifyUpdated(record);
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function deleteRecord(id: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => {
          notifyUpdated();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function updateRecord(
  id: string,
  updates: Partial<Omit<MediaRecord, "id">>
): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const existing = getReq.result as MediaRecord | undefined;
          if (existing) {
            store.put({ ...existing, ...updates });
          }
        };
        tx.oncomplete = () => {
          notifyUpdated();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

export type TimeTag = "all" | "today" | "yesterday" | "thisWeek" | "thisMonth";

/**
 * 返回时间标签对应的 [startMs, endMs]（闭区间），用于过滤 addedAt。
 * 返回 null 表示「全部」，不做时间过滤。
 */
export function getRangeForTag(tag: TimeTag): [number, number] | null {
  if (tag === "all") {
    return null;
  }
  const now = Date.now();
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();

  const todayStart = new Date(y, m, day).getTime();
  const yesterdayStart = new Date(y, m, day - 1).getTime();

  switch (tag) {
    case "today":
      return [todayStart, now];
    case "yesterday":
      return [yesterdayStart, todayStart - 1];
    case "thisWeek": {
      const weekday = d.getDay();
      const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
      const mondayStart = new Date(y, m, day + mondayOffset).getTime();
      return [mondayStart, now];
    }
    case "thisMonth": {
      const monthStart = new Date(y, m, 1).getTime();
      return [monthStart, now];
    }
    default:
      return null;
  }
}
