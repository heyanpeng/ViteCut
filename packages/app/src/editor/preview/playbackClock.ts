/**
 * 播放时钟（全局 ref），由视频播放循环每帧更新，
 * Timeline 只读这里的值来驱动播放头，不依赖 store.currentTime。
 */
export const playbackClock = {
  currentTime: 0,
};

