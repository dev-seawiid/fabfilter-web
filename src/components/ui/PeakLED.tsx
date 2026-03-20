"use client";

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── PeakLED 외부 스토어 (usePeakDetector에서 feedPeak으로 업데이트됨) ──
// usePeakDetector의 외부 스토어를 직접 구독하여 useSpectrumData 이중 호출 방지

import {
  subscribe as peakSubscribe,
  getSnapshot as peakGetSnapshot,
} from "@/hooks/usePeakDetector";

/**
 * PeakLED — Post-EQ 신호가 0dB를 초과하면 빨간 LED가 점등된다.
 * useSpectrumData의 rAF 콜백에서 feedPeak()으로 직접 피드되므로
 * 이 컴포넌트는 별도 구독 없이 클리핑 boolean만 감지한다.
 */
export default function PeakLED() {
  const isClipping = useSyncExternalStore(
    peakSubscribe,
    peakGetSnapshot,
    peakGetSnapshot,
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-4 w-4 items-center justify-center">
        <div
          className={`h-2.5 w-2.5 rounded-full border transition-colors ${
            isClipping
              ? "border-red-400/60 bg-red-500"
              : "bg-surface-600 border-surface-500"
          }`}
        />

        <AnimatePresence>
          {isClipping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: "0 0 8px 3px rgba(239, 68, 68, 0.5)",
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <span className="text-text-muted text-[8px] tracking-wider uppercase">
        Peak
      </span>
    </div>
  );
}
