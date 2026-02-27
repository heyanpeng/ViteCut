/**
 * 上传文件到媒体库服务，返回可被后端 FFmpeg 访问的 HTTP URL。
 */
export async function uploadFileToMedia(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch("/api/media", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `上传失败: ${res.status}`);
  }

  const record = await res.json();
  return { url: record.url };
}
