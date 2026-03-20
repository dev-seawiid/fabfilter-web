/** 재생 상태 머신 — idle → loading → playing ⇄ stopped */
export type PlaybackState = "idle" | "loading" | "playing" | "stopped";

/** Low-cut 필터 파라미터 */
export interface FilterParams {
  /** Cutoff 주파수 (Hz). 범위: 20–20,000 */
  cutoffHz: number;
  /** 출력 게인. 범위: 0–1 */
  gain: number;
}

/** 업로드된 오디오 파일 메타데이터 */
export interface AudioFileMetadata {
  /** 원본 파일명 */
  name: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** MIME 타입 (e.g. audio/wav, audio/mpeg) */
  type: string;
  /** 디코딩된 오디오 길이 (seconds) */
  duration: number;
  /** 샘플레이트 (Hz) */
  sampleRate: number;
  /** 채널 수 */
  numberOfChannels: number;
}
