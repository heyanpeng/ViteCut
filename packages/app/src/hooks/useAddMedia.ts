import { useRef, useCallback } from "react";
import { useProjectStore } from "@/stores";

const VIDEO_ACCEPT = "video/*,video/x-matroska,video/mp2t,.ts";
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp";
const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${IMAGE_ACCEPT}`;

/**
 * 复用添加媒体（视频、图片）逻辑：触发文件选择器并调用 loadVideoFile/loadImageFile。
 * 可用于 SidebarNav 添加按钮、MediaPanel 上传区域等。
 */
export function useAddMedia() {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const loadVideoFile = useProjectStore((s) => s.loadVideoFile);
	const loadImageFile = useProjectStore((s) => s.loadImageFile);

	const trigger = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const loadFile = useCallback(
		async (file: File) => {
			try {
				if (file.type.startsWith("video/")) {
					await loadVideoFile(file);
				} else if (file.type.startsWith("image/")) {
					await loadImageFile(file);
				} else {
					console.warn(`不支持的文件类型: ${file.type}`);
				}
			} catch (err) {
				console.error("媒体加载失败:", err);
			}
		},
		[loadVideoFile, loadImageFile],
	);

	const handleFileChange: React.ChangeEventHandler<HTMLInputElement> =
		useCallback(
			async (event) => {
				const file = event.target.files?.[0];
				if (!file) return;
				try {
					await loadFile(file);
				} finally {
					event.target.value = "";
				}
			},
			[loadFile],
		);

	return {
		trigger,
		loadFile,
		fileInputRef,
		fileInputProps: {
			type: "file" as const,
			accept: MEDIA_ACCEPT,
			style: { display: "none" },
			onChange: handleFileChange,
		},
	};
}
