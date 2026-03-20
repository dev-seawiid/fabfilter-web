/**
 * EMA (Exponential Moving Average) 스무딩.
 *
 * 각 프레임의 FFT 데이터에 적용하여 시각적 떨림을 줄인다.
 * alpha가 클수록 새 값을 빠르게 반영하고, 작을수록 부드럽게 변화한다.
 *
 * @param current - 현재 프레임의 FFT 데이터
 * @param previous - 이전 프레임의 스무딩된 데이터
 * @param alpha - 스무딩 계수 (0~1). 기본값 0.3
 * @returns 스무딩된 Float32Array (previous를 재사용하여 할당 최소화)
 */
export function applyEMA(
  current: Float32Array,
  previous: Float32Array,
  alpha = 0.3,
): Float32Array {
  const len = Math.min(current.length, previous.length);

  for (let i = 0; i < len; i++) {
    const curr = current[i];
    // NaN/Infinity 방어 — 비정상 값은 이전 값 유지
    if (!Number.isFinite(curr)) continue;
    previous[i] = previous[i] + alpha * (curr - previous[i]);
  }

  return previous;
}
