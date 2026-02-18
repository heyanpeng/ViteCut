import { useState, useCallback, useMemo, useRef } from "react";
import { Search, Maximize2, Plus, Trash2 } from "lucide-react";
import { Dialog, Select } from "radix-ui";
import { useProjectStore } from "@/stores/projectStore";
import {
	getAll,
	updateRecord,
	deleteRecord,
	getRangeForTag,
	type MediaRecord,
	type TimeTag,
} from "@/utils/mediaStorage";
import "./MediaPanel.css";

const TYPE_OPTIONS: { value: "all" | "video" | "image"; label: string }[] = [
	{ value: "all", label: "全部" },
	{ value: "video", label: "仅视频" },
	{ value: "image", label: "仅图片" },
];

const TIME_TAGS: { value: TimeTag; label: string }[] = [
	{ value: "all", label: "全部" },
	{ value: "today", label: "今天" },
	{ value: "yesterday", label: "昨天" },
	{ value: "thisWeek", label: "本周" },
	{ value: "thisMonth", label: "本月" },
];

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MediaPanel() {
	const [list, setList] = useState<MediaRecord[]>(() => getAll());
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<"all" | "video" | "image">("all");
	const [timeTag, setTimeTag] = useState<TimeTag>("all");
	const [previewRecord, setPreviewRecord] = useState<MediaRecord | null>(null);
	const [addingId, setAddingId] = useState<string | null>(null);
	const [addError, setAddError] = useState<string | null>(null);
	const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
	const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
	const previewVideoRef = useRef<HTMLVideoElement | null>(null);

	const loadVideoFile = useProjectStore((s) => s.loadVideoFile);
	const loadImageFile = useProjectStore((s) => s.loadImageFile);

	const refreshList = useCallback(() => {
		setList(getAll());
	}, []);

	const filteredList = useMemo(() => {
		let result = list;
		const range = getRangeForTag(timeTag);
		if (range) {
			const [start, end] = range;
			result = result.filter((r) => r.addedAt >= start && r.addedAt <= end);
		}
		if (typeFilter !== "all") {
			result = result.filter((r) => r.type === typeFilter);
		}
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			result = result.filter((r) => r.name.toLowerCase().includes(q));
		}
		return result;
	}, [list, timeTag, typeFilter, searchQuery]);

	// 媒体库内容区也使用两列布局，避免不同高度的缩略图出现空洞
	const columns = useMemo(
		() => {
			const cols: MediaRecord[][] = [[], []];
			filteredList.forEach((record, index) => {
				const colIndex = index % 2;
				cols[colIndex].push(record);
			});
			return cols;
		},
		[filteredList],
	);

	const addRecordToCanvas = useCallback(
		async (record: MediaRecord) => {
			setAddingId(record.id);
			setAddError(null);
			try {
				const res = await fetch(record.url);
				if (!res.ok) {
					throw new Error("资源加载失败，链接可能已失效");
				}
				const blob = await res.blob();
				const mime =
					record.type === "video"
						? blob.type || "video/mp4"
						: blob.type || "image/jpeg";
				const file = new File([blob], record.name, { type: mime });
				if (record.type === "video") {
					await loadVideoFile(file);
				} else {
					await loadImageFile(file);
				}
				setPreviewRecord(null);
			} catch (err) {
				setAddError(err instanceof Error ? err.message : "添加失败");
			} finally {
				setAddingId(null);
			}
		},
		[loadVideoFile, loadImageFile],
	);

	const handleAddToTimeline = useCallback(
		async (record: MediaRecord) => {
			await addRecordToCanvas(record);
		},
		[addRecordToCanvas],
	);

	return (
		<div className="media-panel">
			<div className="media-panel__content">
				<div className="media-panel__header">
					<div className="media-panel__search">
						<Search
							size={16}
							className="media-panel__search-icon"
							aria-hidden
						/>
						<input
							type="text"
							placeholder="搜索媒体..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									(e.target as HTMLInputElement).blur();
								}
							}}
							className="media-panel__search-input"
						/>
					</div>
					<Select.Root
						value={typeFilter}
						onValueChange={(v) =>
							setTypeFilter(v as "all" | "video" | "image")
						}
					>
						<Select.Trigger
							className="media-panel__type-trigger"
							aria-label="类型筛选"
						>
							<Select.Value />
							<Select.Icon className="media-panel__type-icon">
								<span aria-hidden>▼</span>
							</Select.Icon>
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								className="media-panel__type-content"
								position="popper"
								sideOffset={4}
							>
								<Select.Viewport>
									{TYPE_OPTIONS.map((opt) => (
										<Select.Item
											key={opt.value}
											value={opt.value}
											textValue={opt.label}
											className="media-panel__type-item"
										>
											<Select.ItemText>{opt.label}</Select.ItemText>
										</Select.Item>
									))}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
				</div>

				<div className="media-panel__tags">
					{TIME_TAGS.map((tag) => (
						<button
							key={tag.value}
							type="button"
							className={`media-panel__tag ${
								timeTag === tag.value ? "media-panel__tag--active" : ""
							}`}
							onClick={() => setTimeTag(tag.value)}
						>
							{tag.label}
						</button>
					))}
				</div>

				<div className="media-panel__scrollable">
					{addError && (
						<div className="media-panel__error">
							{addError}
							<button
								type="button"
								className="media-panel__retry"
								onClick={() => setAddError(null)}
							>
								关闭
							</button>
						</div>
					)}

					<div className="media-panel__grid">
						{columns.map((colRecords, colIndex) => (
							<div key={colIndex} className="media-panel__column">
								{colRecords.map((record) =>
									record.type === "video" ? (
										<div
											key={record.id}
											className="media-panel__video-item"
											onClick={() => {
												if (addingId === record.id) {
													return;
												}
												void addRecordToCanvas(record);
											}}
											onMouseEnter={() => {
												setHoveredVideoId(record.id);
												const el = videoRefs.current[record.id];
												if (el) {
													el.currentTime = 0;
													void el.play();
												}
											}}
											onMouseLeave={() => {
												const el = videoRefs.current[record.id];
												if (el) {
													el.pause();
												}
												setHoveredVideoId(null);
											}}
										>
											<div className="media-panel__video-thumbnail">
												<video
													ref={(el) => {
														videoRefs.current[record.id] = el;
													}}
													src={record.url}
													className={`media-panel__video-preview ${
														hoveredVideoId === record.id
															? "media-panel__video-preview--visible"
															: ""
													}`}
													muted
													loop
													playsInline
													preload="metadata"
													onLoadedMetadata={(e) => {
														if (
															record.duration != null ||
															Number.isNaN(
																(e.target as HTMLVideoElement)
																	.duration,
															)
														) {
															return;
														}
														const d = (
															e.target as HTMLVideoElement
														).duration;
														if (d >= 0) {
															updateRecord(record.id, {
																duration: d,
															});
															refreshList();
														}
													}}
												/>
												<button
													type="button"
													className="media-panel__zoom-btn"
													aria-label="查看详情"
													onClick={(e) => {
														e.stopPropagation();
														setPreviewRecord(record);
													}}
												>
													<Maximize2 size={18} />
												</button>
												{addingId === record.id && (
													<div className="media-panel__adding-mask">
														<span className="media-panel__adding-text">
															添加中…
														</span>
													</div>
												)}
												<div className="media-panel__video-duration">
													{record.duration != null
														? formatDuration(record.duration)
														: "0:00"}
												</div>
												<button
													type="button"
													className="media-panel__delete-btn"
													aria-label="删除"
													onClick={(e) => {
														e.stopPropagation();
														deleteRecord(record.id);
														refreshList();
													}}
												>
													<Trash2 size={18} />
												</button>
											</div>
										</div>
									) : (
										<div
											key={record.id}
											className="media-panel__image-item"
											onClick={() => {
												if (addingId === record.id) {
													return;
												}
												void addRecordToCanvas(record);
											}}
										>
											<div className="media-panel__image-thumbnail">
												<img
													src={record.url}
													alt={record.name}
													className="media-panel__image-thumbnail-image"
												/>
												<button
													type="button"
													className="media-panel__zoom-btn"
													aria-label="查看详情"
													onClick={(e) => {
														e.stopPropagation();
														setPreviewRecord(record);
													}}
												>
													<Maximize2 size={18} />
												</button>
												<button
													type="button"
													className="media-panel__delete-btn"
													aria-label="删除"
													onClick={(e) => {
														e.stopPropagation();
														deleteRecord(record.id);
														refreshList();
													}}
												>
													<Trash2 size={18} />
												</button>
												{addingId === record.id && (
													<div className="media-panel__adding-mask">
														<span className="media-panel__adding-text">
															添加中…
														</span>
													</div>
												)}
											</div>
										</div>
									),
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			<Dialog.Root
				open={previewRecord !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPreviewRecord(null);
						previewVideoRef.current?.pause();
					}
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="media-panel__dialog-overlay" />
					{previewRecord && (
						<Dialog.Content className="media-panel__dialog-content">
							<button
								type="button"
								className="media-panel__dialog-close"
								aria-label="关闭"
								onClick={() => {
									setPreviewRecord(null);
									previewVideoRef.current?.pause();
								}}
							>
								×
							</button>
							<div className="media-panel__dialog-media">
								{previewRecord.type === "video" ? (
									<video
										ref={previewVideoRef}
										src={previewRecord.url}
										className="media-panel__dialog-video"
										controls
										playsInline
										preload="metadata"
									/>
								) : (
									<img
										src={previewRecord.url}
										alt={previewRecord.name}
										className="media-panel__dialog-image"
									/>
								)}
								<div className="media-panel__dialog-info">
									<div className="media-panel__dialog-meta">
										<span>{previewRecord.name}</span>
										{previewRecord.duration != null && (
											<span>
												时长{" "}
												{formatDuration(previewRecord.duration)}
											</span>
										)}
									</div>
									<div className="media-panel__dialog-actions">
										<button
											type="button"
											className="media-panel__dialog-btn media-panel__dialog-btn--primary"
											onClick={async () => {
												const rec = previewRecord;
												if (!rec) {
													return;
												}
												setPreviewRecord(null);
												previewVideoRef.current?.pause();
												await handleAddToTimeline(rec);
											}}
										>
											<Plus size={16} />
											添加到时间轴
										</button>
									</div>
								</div>
							</div>
						</Dialog.Content>
					)}
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	);
}
