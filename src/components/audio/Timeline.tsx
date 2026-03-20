"use client";

import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";

/** mm:ss 형식으로 변환 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Timeline() {
  const trackRef = useRef<HTMLDivElement>(null);

  const playbackState = useAudioStore((s) => s.playbackState);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const seek = useAudioStore((s) => s.seek);
  const updateCurrentTime = useAudioStore((s) => s.updateCurrentTime);

  const isActive = playbackState !== "idle" && playbackState !== "loading";
  const progress = duration > 0 ? currentTime / duration : 0;

  // 60fps Playhead 동기화 — AudioContext.currentTime 기반
  useAnimationFrame(() => {
    updateCurrentTime();
  }, playbackState === "playing");

  // 클릭/드래그로 seek
  const handleSeek = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current || !isActive) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      seek(ratio * duration);
    },
    [isActive, duration, seek],
  );

  return (
    <div className="flex items-center gap-3">
      {/* 현재 시간 */}
      <span className="text-text-secondary w-12 text-right text-xs tabular-nums">
        {formatTime(currentTime)}
      </span>

      {/* 타임라인 트랙 */}
      <div
        ref={trackRef}
        onClick={handleSeek}
        className={`bg-surface-700 relative h-1.5 flex-1 cursor-pointer rounded-full transition-colors ${
          !isActive ? "cursor-not-allowed opacity-40" : "hover:bg-surface-600"
        }`}
      >
        {/* 진행 바 */}
        <motion.div
          className="bg-accent-cyan absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progress * 100}%` }}
          transition={{ duration: 0, ease: "linear" }}
        />

        {/* Playhead 핸들 */}
        {isActive && (
          <motion.div
            className="border-accent-cyan bg-surface-900 absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
            transition={{ duration: 0, ease: "linear" }}
          >
            {/* 재생 중 글로우 */}
            {playbackState === "playing" && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow: "0 0 8px 2px rgba(0, 229, 255, 0.3)",
                }}
              />
            )}
          </motion.div>
        )}
      </div>

      {/* 총 길이 */}
      <span className="text-text-muted w-12 text-xs tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
}
