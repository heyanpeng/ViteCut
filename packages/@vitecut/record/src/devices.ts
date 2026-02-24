export type MediaDeviceEntry = {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'videoinput';
  isDefault: boolean;
};

export type EnumerateDevicesOptions = {
  /**
   * 是否先请求媒体权限。为 true 时先调用 getUserMedia 以便获取设备标签（会触发权限弹窗）。
   * 为 false 时仅枚举，不触发弹窗，但设备 label 可能为空。
   * @default true
   */
  requestPermission?: boolean;
};

/**
 * 枚举指定类型的媒体设备（麦克风或摄像头）。
 *
 * @param kind - 设备类型：'audioinput' 为麦克风，'videoinput' 为摄像头
 * @param options - requestPermission: 是否先请求权限以获取设备标签，默认 true
 * @returns 设备列表，包含设备 ID、标签、是否为默认设备等信息
 *
 * 示例：
 * ```ts
 * const mics = await enumerateDevices('audioinput');
 * const micsNoPopup = await enumerateDevices('audioinput', { requestPermission: false });
 * ```
 */
export async function enumerateDevices(
  kind: 'audioinput' | 'videoinput',
  options: EnumerateDevicesOptions = {},
): Promise<MediaDeviceEntry[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new Error('浏览器不支持 MediaDevices API');
  }

  const { requestPermission = true } = options;

  if (requestPermission) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: kind === 'audioinput',
        video: kind === 'videoinput',
      });
      tempStream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn('无法获取媒体权限，设备标签可能为空:', err);
    }
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const filtered = devices.filter((d) => d.kind === kind);

  // 找出默认设备（通常 deviceId 为 'default' 或 label 包含 'default'）
  const defaultDeviceId = filtered.find(
    (d) =>
      d.deviceId === 'default' ||
      d.label.toLowerCase().includes('default') ||
      d.label.toLowerCase().includes('默认'),
  )?.deviceId;

  return filtered.map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label || `${kind} ${index + 1}`,
    kind: kind,
    isDefault: device.deviceId === defaultDeviceId || index === 0,
  }));
}
