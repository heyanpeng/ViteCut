/**
 * 从图片二进制中提取宽高信息（不依赖第三方库）。
 * 支持 PNG / JPEG / GIF / WebP；解析失败时返回 undefined。
 */
export function extractImageDimensionsFromBuffer(
  buffer: Buffer
): { width: number; height: number } | undefined {
  if (!buffer || buffer.length < 10) {
    return undefined;
  }

  const png = parsePng(buffer);
  if (png) return png;

  const jpeg = parseJpeg(buffer);
  if (jpeg) return jpeg;

  const gif = parseGif(buffer);
  if (gif) return gif;

  const webp = parseWebp(buffer);
  if (webp) return webp;

  return undefined;
}

function parsePng(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 24) return undefined;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (!isPng) return undefined;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function parseGif(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 10) return undefined;
  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return undefined;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function parseJpeg(
  buffer: Buffer
): { width: number; height: number } | undefined {
  if (buffer.length < 4) return undefined;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset + 3 < buffer.length) {
    // 跳过填充 FF
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset + 3 >= buffer.length) return undefined;

    const marker = buffer[offset];
    offset += 1;

    // 无长度段（如 EOI/SOS 等）特殊处理
    if (marker === 0xd9 || marker === 0xda) {
      return undefined;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return undefined;
    }

    // SOF0/SOF1/SOF2/...（排除 DHT/DAC/JPG 等）
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSof) {
      if (segmentLength < 7) return undefined;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width <= 0 || height <= 0) return undefined;
      return { width, height };
    }

    offset += segmentLength;
  }

  return undefined;
}

function parseWebp(
  buffer: Buffer
): { width: number; height: number } | undefined {
  if (buffer.length < 30) return undefined;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return undefined;

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    // VP8X: 宽高以 24-bit little-endian 的 (值-1) 存储
    const widthMinusOne = buffer[24] | (buffer[25] << 8) | (buffer[26] << 16);
    const heightMinusOne = buffer[27] | (buffer[28] << 8) | (buffer[29] << 16);
    const width = widthMinusOne + 1;
    const height = heightMinusOne + 1;
    if (width <= 0 || height <= 0) return undefined;
    return { width, height };
  }

  if (chunk === "VP8L") {
    // VP8L: 有损压缩头中打包的宽高（值+1）
    if (buffer.length < 25 || buffer[20] !== 0x2f) return undefined;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (b0 | ((b1 & 0x3f) << 8));
    const height = 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
    if (width <= 0 || height <= 0) return undefined;
    return { width, height };
  }

  return undefined;
}
