/**
 * 媒体库后端 API 客户端，供媒体面板使用。
 */

export type MediaType = "video" | "image" | "audio";

export interface MediaRecord {
  id: string;
  name: string;
  type: MediaType;
  addedAt: number;
  url: string;
  filename: string;
  duration?: number;
  /** 音频波形图等封面，上传时后端自动生成 */
  coverUrl?: string;
}

export interface MediaListParams {
  type?: "video" | "image" | "audio";
  search?: string;
  page?: number;
  limit?: number;
  addedAtSince?: number;
  addedAtUntil?: number;
}

export interface MediaListResponse {
  items: MediaRecord[];
  total: number;
}

export async function fetchMediaList(
  params?: MediaListParams
): Promise<MediaListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set("type", params.type);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.addedAtSince != null)
    searchParams.set("addedAtSince", String(params.addedAtSince));
  if (params?.addedAtUntil != null)
    searchParams.set("addedAtUntil", String(params.addedAtUntil));

  const url = `/api/media${searchParams.toString() ? `?${searchParams}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `删除失败: ${res.status}`);
  }
}

/** 添加第三方资源到媒体库（仅入库，不拉取文件；用于 Pexels/Freesound 等） */
export async function uploadMediaFromUrl(params: {
  url: string;
  name?: string;
  type?: "video" | "image" | "audio";
  duration?: number;
  coverUrl?: string;
}): Promise<MediaRecord> {
  const res = await fetch("/api/media/from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `添加失败: ${res.status}`);
  }
  return res.json();
}

export async function updateMedia(
  id: string,
  updates: { duration?: number; name?: string }
): Promise<MediaRecord> {
  const res = await fetch(`/api/media/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `更新失败: ${res.status}`);
  }
  return res.json();
}
