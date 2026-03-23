"use client";

import { useRef, useCallback, useEffect } from "react";
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
  const progressRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLSpanElement>(null);

  const playbackState = useAudioStore((s) => s.playbackState);
  const duration = useAudioStore((s) => s.duration);
  const currentTime = useAudioStore((s) => s.currentTime);
  const seek = useAudioStore((s) => s.seek);
  const getPlaybackInfo = useAudioStore((s) => s.getPlaybackInfo);

  const isActive = playbackState !== "idle" && playbackState !== "loading";
  const isPlaying = playbackState === "playing";

  // 60fps Playhead 동기화 — ref 기반 직접 DOM 업데이트 (re-render 0회)
  useAnimationFrame(() => {
    const { currentTime: time, duration: d } = getPlaybackInfo();
    const pct = d > 0 ? (time / d) * 100 : 0;

    if (progressRef.current) {
      progressRef.current.style.width = `${pct}%`;
    }
    if (playheadRef.current) {
      playheadRef.current.style.left = `calc(${pct}% - 6px)`;
    }
    if (currentTimeRef.current) {
      currentTimeRef.current.textContent = formatTime(time);
    }
  }, isPlaying);

  // seek 시 즉시 DOM 반영
  const syncDOM = useCallback(
    (time: number) => {
      const pct = duration > 0 ? (time / duration) * 100 : 0;
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
      if (playheadRef.current)
        playheadRef.current.style.left = `calc(${pct}% - 6px)`;
      if (currentTimeRef.current)
        currentTimeRef.current.textContent = formatTime(time);
    },
    [duration],
  );

  // store의 currentTime이 변경될 때 (seek, pause, loadFile) DOM 동기화
  useEffect(() => {
    syncDOM(currentTime);
  }, [currentTime, syncDOM]);

  // 클릭으로 seek
  const handleSeek = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current || !isActive) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      const time = ratio * duration;
      seek(time);
      syncDOM(time);
    },
    [isActive, duration, seek, syncDOM],
  );

  return (
    <div className="flex items-center gap-3">
      {/* 현재 시간 */}
      <span
        ref={currentTimeRef}
        className="text-text-secondary w-12 text-right text-xs tabular-nums"
      >
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
        <div
          ref={progressRef}
          className="bg-accent-cyan absolute inset-y-0 left-0 rounded-full"
          style={{ width: "0%" }}
        />

        {/* Playhead 핸들 */}
        {isActive && (
          <div
            ref={playheadRef}
            className="border-accent-cyan bg-surface-900 absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2"
            style={{ left: "calc(0% - 6px)" }}
          >
            {/* 재생 중 글로우 */}
            <div
              ref={glowRef}
              className="absolute inset-0 rounded-full transition-opacity"
              style={{
                boxShadow: "0 0 8px 2px rgba(0, 229, 255, 0.3)",
                opacity: isPlaying ? 1 : 0,
              }}
            />
          </div>
        )}
      </div>

      {/* 총 길이 */}
      <span className="text-text-muted w-12 text-xs tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
}
