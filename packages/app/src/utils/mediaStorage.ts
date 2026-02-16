/**
 * 媒体面板本地存储：单 key 存整份列表，资源为链接（url）。
 * 单条结构：{ id, name, type, addedAt, url }，可选 duration（视频时长秒数）。
 */

const STORAGE_KEY = "vitecut-media-list";

export type MediaRecord = {
  id: string;
  name: string;
  type: "video" | "image";
  addedAt: number;
  url: string;
  duration?: number;
};

export function getAll(): MediaRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as MediaRecord[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function add(record: MediaRecord): void {
  const list = getAll();
  list.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteRecord(id: string): void {
  const list = getAll().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function updateRecord(
  id: string,
  updates: Partial<Omit<MediaRecord, "id">>,
): void {
  const list = getAll().map((r) => (r.id === id ? { ...r, ...updates } : r));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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

  // 今天 0 点（本地）
  const todayStart = new Date(y, m, day).getTime();
  // 昨天 0 点
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
