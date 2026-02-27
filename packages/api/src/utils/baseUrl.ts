export function getBaseUrl(
  headers: Record<string, string | string[] | undefined>,
  port: number
): string {
  const hostRaw = headers["x-forwarded-host"] ?? headers.host ?? `localhost:${port}`;
  const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw;
  const protoRaw = headers["x-forwarded-proto"] ?? "http";
  const proto = Array.isArray(protoRaw) ? protoRaw[0] : protoRaw;
  return `${proto}://${String(host).replace(/\/$/, "")}`;
}
