/** Hz를 사람이 읽기 쉬운 형태로 포맷 (1000+ → kHz) */
export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}

/** 선형 gain(0~1)을 dB로 변환 */
export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : -Infinity;
}

/** dB를 표시 문자열로 포맷 */
export function formatDb(db: number): string {
  return Number.isFinite(db) ? `${db.toFixed(1)}dB` : "-∞dB";
}

/** mm:ss 형식으로 변환 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
