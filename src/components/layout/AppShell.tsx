"use client";

import { useAudioStore } from "@/store/useAudioStore";
import FileUploader from "@/components/audio/FileUploader";
import PlaybackControls from "@/components/audio/PlaybackControls";
import Timeline from "@/components/audio/Timeline";
import FilterControls from "@/components/audio/FilterControls";
import SpectrumCanvas from "@/components/audio/SpectrumCanvas";
import PeakLED from "@/components/ui/PeakLED";
import { motion } from "framer-motion";

export default function AppShell() {
  const playbackState = useAudioStore((s) => s.playbackState);
  const hasFile = playbackState !== "idle" && playbackState !== "loading";

  return (
    <div className="bg-surface-950 relative flex h-screen flex-col overflow-hidden">
      {/* 배경 그래디언트 효과 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 229, 255, 0.03) 0%, transparent 60%)",
        }}
      />

      {/* ── 상단: Spectrum 영역 ── */}
      <section
        className={`relative flex min-h-0 flex-1 p-4 ${
          hasFile
            ? "items-stretch justify-center"
            : "items-center justify-center"
        }`}
      >
        {!hasFile ? (
          <div className="w-full max-w-md">
            <FileUploader />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 w-full max-w-5xl flex-col gap-2"
          >
            {/* SpectrumCanvas — 3-layer 합성 */}
            <div className="border-surface-700/30 bg-surface-900/30 min-h-0 flex-1 overflow-hidden rounded-lg border">
              <SpectrumCanvas />
            </div>
          </motion.div>
        )}
      </section>

      {/* ── 하단: 컨트롤 패널 ── */}
      <section className="border-surface-700/50 bg-surface-900/80 relative shrink-0 border-t backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          {hasFile && <FileUploader />}
          <PlaybackControls />
          <div className="min-w-[120px] flex-1">
            <Timeline />
          </div>
          {/* Filter 컨트롤 */}
          <div className="bg-surface-700/50 hidden h-8 w-px sm:block" />
          <FilterControls />
          {/* Peak LED */}
          <div className="bg-surface-700/50 hidden h-8 w-px sm:block" />
          <PeakLED />
        </div>
      </section>
    </div>
  );
}
