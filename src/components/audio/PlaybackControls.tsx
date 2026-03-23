"use client";

import { useAudioStore } from "@/store/useAudioStore";
import { motion } from "framer-motion";

const pauseIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="text-accent-cyan"
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const playIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="text-text-secondary group-hover:text-accent-cyan ml-0.5 transition-colors"
  >
    <polygon points="6,4 20,12 6,20" />
  </svg>
);

export default function PlaybackControls() {
  const playbackState = useAudioStore((s) => s.playbackState);
  const play = useAudioStore((s) => s.play);
  const pause = useAudioStore((s) => s.pause);

  const isPlaying = playbackState === "playing";
  const isDisabled = playbackState === "idle" || playbackState === "loading";

  const handleToggle = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 재생/정지 버튼 */}
      <motion.button
        onClick={handleToggle}
        disabled={isDisabled}
        whileTap={{ scale: 0.92 }}
        className="group border-surface-600 bg-surface-800 hover:border-accent-cyan/50 hover:bg-surface-700 disabled:hover:border-surface-600 disabled:hover:bg-surface-800 relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {/* 글로우 이펙트 */}
        {isPlaying && (
          <motion.div
            layoutId="play-glow"
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: "0 0 12px 2px rgba(0, 229, 255, 0.15)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}

        {isPlaying ? pauseIcon : playIcon}
      </motion.button>
    </div>
  );
}
