"use client";

import FileUploader from "@/components/audio/FileUploader";
import FilterControls from "@/components/audio/FilterControls";
import PlaybackControls from "@/components/audio/PlaybackControls";
import SpectrumCanvas from "@/components/audio/SpectrumCanvas";
import Timeline from "@/components/audio/Timeline";
import PeakLED from "@/components/ui/PeakLED";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import { useAudioStore } from "@/store/useAudioStore";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState } from "react";

/** bundle-dynamic-imports: @xyflow/react는 무거운 라이브러리 — 토글 뒤에서만 사용되므로 lazy load */
const AudioNodeGraph = dynamic(
  () => import("@/components/graph/AudioNodeGraph"),
  { ssr: false },
);

export default function AppShell() {
  const playbackState = useAudioStore((s) => s.playbackState);
  const hasFile = playbackState !== "idle" && playbackState !== "loading";
  const [graphOpen, setGraphOpen] = useState(true);
  useGlobalKeyboard();

  return (
    <div className="bg-surface-950 relative flex h-screen flex-col overflow-hidden">
      {/* 배경 그래디언트 효과 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.03)_0%,transparent_60%)]" />

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

      {/* ── 중단: 노드 그래프 패널 (접이식) ── */}
      <AnimatePresence>
        {graphOpen && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-surface-700/30 bg-surface-900/50 relative shrink-0 overflow-hidden border-t backdrop-blur-sm"
          >
            {/* 모바일: 140px, sm 이상: 180px — React Flow는 부모에 명시적 크기 필요 */}
            <div className="h-[140px] w-full sm:h-[180px]">
              <AudioNodeGraph />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

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
          {/* Node Graph 토글 */}
          <div className="bg-surface-700/50 hidden h-8 w-px sm:block" />
          <button
            type="button"
            onClick={() => setGraphOpen((prev) => !prev)}
            className={`text-[9px] tracking-wider uppercase transition-colors ${
              graphOpen
                ? "text-accent-cyan"
                : "text-text-muted hover:text-text-secondary"
            }`}
            aria-label="Toggle node graph"
            aria-expanded={graphOpen}
          >
            ⬡ Graph
          </button>
        </div>
      </section>
    </div>
  );
}
