const PEAK_THRESHOLD = 1.0; // linear amplitude (= 0 dBFS)

// ── 외부 스토어: 클리핑 여부 (sticky — 클릭으로만 해제) ──
let isClipping = false;
const clipListeners = new Set<() => void>();

function emitClip() {
  for (const l of clipListeners) l();
}

export function subscribe(listener: () => void) {
  clipListeners.add(listener);
  return () => {
    clipListeners.delete(listener);
  };
}

export function getSnapshot() {
  return isClipping;
}

// ── 외부 스토어: 실시간 볼륨 레벨 (dBFS) ──
let currentLevelDb = -Infinity;
const levelListeners = new Set<() => void>();

function emitLevel() {
  for (const l of levelListeners) l();
}

export function subscribeLevel(listener: () => void) {
  levelListeners.add(listener);
  return () => {
    levelListeners.delete(listener);
  };
}

export function getLevelSnapshot() {
  return currentLevelDb;
}

/** 외부에서 매 프레임 호출 — 피크 linear 값을 받아 클리핑 감지 + 레벨 업데이트 */
export function feedPeak(peak: number): void {
  // 실시간 레벨 업데이트 — 1dB 이상 변화 시에만 emit (60fps DOM 업데이트 절약)
  const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const changed =
    Math.abs(db - currentLevelDb) >= 0.5 ||
    !isFinite(db) !== !isFinite(currentLevelDb);
  if (changed) {
    currentLevelDb = db;
    emitLevel();
  }

  // 클리핑: sticky (한 번 켜지면 유지)
  if (peak >= PEAK_THRESHOLD && !isClipping) {
    isClipping = true;
    emitClip();
  }
}

/** 사용자가 Peak LED 클릭 시 호출 */
export function resetPeakState(): void {
  isClipping = false;
  emitClip();
}
