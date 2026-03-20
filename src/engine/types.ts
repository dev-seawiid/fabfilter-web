/** 오디오 그래프 노드 참조 — Constitution I의 고정 토폴로지 */
export interface AudioGraphNodes {
  source: AudioBufferSourceNode | null;
  analyserPre: AnalyserNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  analyserPost: AnalyserNode;
  destination: AudioDestinationNode;
}

/** AudioEngine 초기화 설정 */
export interface EngineConfig {
  /** FFT 크기 (AnalyserNode). 기본값: 2048 */
  fftSize: number;
  /** Smoothing time constant for setTargetAtTime (seconds). 기본값: 0.015 */
  smoothingTimeConstant: number;
}

/** Pre/Post AnalyserNode에서 추출한 주파수 데이터 */
export interface AnalyserData {
  /** Pre-EQ 주파수 데이터 (dB) */
  pre: Float32Array;
  /** Post-EQ 주파수 데이터 (dB) */
  post: Float32Array;
}
