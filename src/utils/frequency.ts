/**
 * 주파수 유틸리티 — 로그 스케일 변환 + dB 매핑.
 *
 * SpectrumCanvas의 X축(Hz→px)과 Y축(dB→px) 변환을 담당한다.
 * X축은 사람의 청각 인지에 맞춰 로그 스케일(20Hz~20kHz)을 사용한다.
 */

/** Hz를 Canvas X좌표로 변환 (로그 스케일) */
export function hzToLogX(
  hz: number,
  width: number,
  minHz = 20,
  maxHz = 20000,
): number {
  const logMin = Math.log10(minHz);
  const logMax = Math.log10(maxHz);
  const logHz = Math.log10(Math.max(minHz, Math.min(maxHz, hz)));
  return ((logHz - logMin) / (logMax - logMin)) * width;
}

/** dB를 Canvas Y좌표로 변환 (위가 0dB, 아래가 minDb) */
export function dbToY(
  db: number,
  height: number,
  minDb = -100,
  maxDb = 0,
): number {
  const clamped = Math.max(minDb, Math.min(maxDb, db));
  // 0dB → y=0 (상단), minDb → y=height (하단)
  return (1 - (clamped - minDb) / (maxDb - minDb)) * height;
}

/**
 * 로그 분포 주파수 배열 생성 (20Hz~20kHz).
 * getFrequencyResponse()에 전달하거나 X축 눈금에 사용한다.
 */
export function createLogFrequencyArray(
  startHz = 20,
  endHz = 20000,
  count = 512,
): Float32Array<ArrayBuffer> {
  const arr = new Float32Array(count);
  const logStart = Math.log10(startHz);
  const logEnd = Math.log10(endHz);
  const step = (logEnd - logStart) / (count - 1);

  for (let i = 0; i < count; i++) {
    arr[i] = Math.pow(10, logStart + i * step);
  }
  return arr;
}

/**
 * FFT bin 인덱스를 Hz로 변환.
 * bin frequency = index * (sampleRate / fftSize)
 */
export function binToHz(
  index: number,
  sampleRate: number,
  fftSize: number,
): number {
  return index * (sampleRate / fftSize);
}
