"use client";

import { useAudioStore } from "@/store/useAudioStore";
import FileUploader from "@/components/audio/FileUploader";
import PlaybackControls from "@/components/audio/PlaybackControls";
import Timeline from "@/components/audio/Timeline";
import { motion } from "framer-motion";

export default function AppShell() {
  const playbackState = useAudioStore((s) => s.playbackState);
  const hasFile = playbackState !== "idle" && playbackState !== "loading";

  return (
    <div className="bg-surface-950 relative flex min-h-screen flex-col overflow-hidden">
      {/* 배경 그래디언트 효과 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 229, 255, 0.03) 0%, transparent 60%)",
        }}
      />

      {/* ── 상단: Spectrum 영역 (Phase 4에서 Canvas 추가) ── */}
      <section className="relative flex flex-1 items-center justify-center p-8">
        {!hasFile ? (
          <div className="w-full max-w-md">
            <FileUploader />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            {/* Phase 4에서 SpectrumCanvas가 여기에 들어감 */}
            <div className="border-surface-700/50 bg-surface-900/50 flex h-64 w-full max-w-3xl items-center justify-center rounded-lg border">
              <p className="text-text-muted text-xs">
                Spectrum visualization — Phase 4
              </p>
            </div>
          </motion.div>
        )}
      </section>

      {/* ── 하단: 컨트롤 패널 ── */}
      <section className="border-surface-700/50 bg-surface-900/80 relative border-t backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4">
          {/* 파일 정보 + 컨트롤 */}
          <div className="flex items-center gap-4">
            {hasFile && <FileUploader />}
            <PlaybackControls />
            <div className="flex-1">
              <Timeline />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
