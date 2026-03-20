import { useEffect, useSyncExternalStore } from "react";
import type { SpectrumData } from "./useSpectrumData";

const PEAK_THRESHOLD = 1.0;
const RESET_DELAY_MS = 2000;

// ── 외부 스토어: 클리핑 상태 ──
let isClipping = false;
let resetTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return isClipping;
}

/** 외부에서 호출 — 피크 값을 받아 클리핑 감지 */
export function feedPeak(peak: number): void {
  if (peak >= PEAK_THRESHOLD && !isClipping) {
    isClipping = true;
    emit();

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      isClipping = false;
      emit();
    }, RESET_DELAY_MS);
  }
}

/**
 * usePeakDetector — spectrumData를 받아 피크 감지.
 * PeakLED 컴포넌트에서 사용한다.
 */
export function usePeakDetector(spectrumData: SpectrumData | null): boolean {
  // spectrumData가 변할 때마다 피크 체크 — effect에서 외부 스토어 업데이트
  useEffect(() => {
    if (spectrumData) {
      feedPeak(spectrumData.postPeak);
    }
  }, [spectrumData]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
