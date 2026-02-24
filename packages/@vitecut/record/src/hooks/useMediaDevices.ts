import { useState, useEffect, useCallback, useRef } from 'react';
import type { MediaDeviceEntry } from '../devices';
import { enumerateDevices } from '../devices';

export type UseMediaDevicesOptions = {
  /** 初始枚举是否请求权限（会触发弹窗），默认 false 避免打开面板即弹窗 */
  requestPermissionOnLoad?: boolean;
};

export type UseMediaDevicesReturn = {
  devices: MediaDeviceEntry[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  /** 重新枚举设备，传入 requestPermission: true 可在已授权后获取完整设备标签 */
  refresh: (options?: { requestPermission?: boolean }) => Promise<void>;
};

/**
 * 枚举和管理媒体设备（麦克风或摄像头）的 React Hook。
 *
 * @param kind - 设备类型：'audioinput' 为麦克风，'videoinput' 为摄像头
 * @param options - requestPermissionOnLoad: 初始枚举是否请求权限，默认 false 避免打开即弹窗
 * @returns 设备列表、当前选中设备 ID、设置选中设备的方法、刷新设备列表的方法
 *
 * 示例：
 * ```ts
 * const mic = useMediaDevices('audioinput');
 * mic.refresh({ requestPermission: true }); // 用户授权后调用以获取完整设备标签
 * ```
 */
export function useMediaDevices(
  kind: 'audioinput' | 'videoinput',
  options: UseMediaDevicesOptions = {},
): UseMediaDevicesReturn {
  const { requestPermissionOnLoad = false } = options;
  const [devices, setDevices] = useState<MediaDeviceEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const loadDevices = useCallback(
    async (requestPermission?: boolean) => {
      try {
        const list = await enumerateDevices(kind, {
          requestPermission: requestPermission ?? requestPermissionOnLoad,
        });
        setDevices(list);

        if (!selectedIdRef.current && list.length > 0) {
          const defaultDevice = list.find((d) => d.isDefault) || list[0];
          if (defaultDevice) {
            setSelectedId(defaultDevice.deviceId);
          }
        }
      } catch (err) {
        console.error(`枚举 ${kind} 设备失败:`, err);
        setDevices([]);
      }
    },
    [kind, requestPermissionOnLoad],
  );

  const refresh = useCallback(
    async (opts?: { requestPermission?: boolean }) => {
      await loadDevices(opts?.requestPermission);
    },
    [loadDevices],
  );

  useEffect(() => {
    loadDevices();

    const handleDeviceChange = () => {
      loadDevices();
    };

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener(
          'devicechange',
          handleDeviceChange,
        );
      };
    }
  }, [loadDevices]);

  return {
    devices,
    selectedId,
    setSelectedId,
    refresh,
  };
}
