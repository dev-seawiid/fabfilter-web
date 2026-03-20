import { useEffect, useSyncExternalStore } from "react";

const PEAK_THRESHOLD = 1.0;
const RESET_DELAY_MS = 2000;

// ── 외부 스토어: 클리핑 상태 ──
let isClipping = false;
let resetTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
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

/** 재생 중지 시 클리핑 상태 리셋 */
export function resetPeakState(): void {
  isClipping = false;
  clearTimeout(resetTimer);
  emit();
}

/**
 * usePeakDetector — postPeak 값을 직접 받아 클리핑을 감지한다.
 * useSpectrumData를 직접 호출하지 않아 리스너 중복 방지.
 */
export function usePeakDetector(postPeak: number | undefined): boolean {
  useEffect(() => {
    if (postPeak !== undefined) {
      feedPeak(postPeak);
    }
  }, [postPeak]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
