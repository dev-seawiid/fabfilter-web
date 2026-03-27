/**
 * FilterEngine — BiquadFilterNode(highpass) 제어 래퍼.
 *
 * 모든 파라미터 변경에 setTargetAtTime smoothing을 적용하여
 * 급격한 변경 시 팝/클릭 노이즈를 방지한다 (SC-005).
 */
export class FilterEngine {
  private filter: BiquadFilterNode;
  private ctx: AudioContext;
  private timeConstant: number;

  // Zero-Allocation: 주파수 응답 버퍼를 사전 할당하여 매 프레임 재사용
  private magBuffer = new Float32Array(0);
  private phaseBuffer = new Float32Array(0);

  constructor(
    filter: BiquadFilterNode,
    ctx: AudioContext,
    timeConstant = 0.015,
  ) {
    this.filter = filter;
    this.ctx = ctx;
    this.timeConstant = timeConstant;
  }

  /** Cutoff 주파수 설정 (Hz). setTargetAtTime으로 스무딩 적용 */
  setCutoff(hz: number): void {
    const clamped = Math.max(0, Math.min(20000, hz));
    this.filter.frequency.setTargetAtTime(
      clamped,
      this.ctx.currentTime,
      this.timeConstant,
    );
  }

  /** Q 팩터 설정. 기본값 0.707 (Butterworth) */
  setQ(value: number): void {
    const clamped = Math.max(0.0001, Math.min(1000, value));
    this.filter.Q.setTargetAtTime(
      clamped,
      this.ctx.currentTime,
      this.timeConstant,
    );
  }

  /** 현재 cutoff 주파수 (Hz) */
  getCutoff(): number {
    return this.filter.frequency.value;
  }

  /** 현재 Q 값 */
  getQ(): number {
    return this.filter.Q.value;
  }

  /**
   * 주파수 응답 곡선 계산 — SpectrumCanvas Layer 2에서 사용.
   * BiquadFilterNode.getFrequencyResponse()를 래핑한다.
   *
   * @param frequencies - 측정할 주파수 배열 (Hz)
   * @returns { magResponse: Float32Array, phaseResponse: Float32Array }
   */
  getFrequencyResponse(frequencies: Float32Array<ArrayBuffer>): {
    magResponse: Float32Array<ArrayBuffer>;
    phaseResponse: Float32Array<ArrayBuffer>;
  } {
    const len = frequencies.length;

    // 버퍼 크기가 다를 때만 재할당 (리사이즈 시)
    if (this.magBuffer.length !== len) {
      this.magBuffer = new Float32Array(len);
      this.phaseBuffer = new Float32Array(len);
    }

    this.filter.getFrequencyResponse(
      frequencies,
      this.magBuffer,
      this.phaseBuffer,
    );
    return { magResponse: this.magBuffer, phaseResponse: this.phaseBuffer };
  }
}
