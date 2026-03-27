import type { AnalyserData } from "./types";

/**
 * AnalyserBridge — Pre/Post AnalyserNode에서 주파수 데이터를 추출한다.
 *
 * useSpectrumRenderer 훅에서 매 프레임 호출되어
 * SpectrumCanvas의 Layer 1(Pre) + Layer 3(Post) 데이터를 제공한다.
 */
export class AnalyserBridge {
  private analyserPre: AnalyserNode;
  private analyserPost: AnalyserNode;
  private preBuffer: Float32Array<ArrayBuffer>;
  private postBuffer: Float32Array<ArrayBuffer>;
  private timeDomainBuffer: Float32Array<ArrayBuffer>;

  // Zero-Allocation: getData() 반환 객체를 사전 할당하여 매 프레임 재사용
  private dataResult: AnalyserData;

  constructor(analyserPre: AnalyserNode, analyserPost: AnalyserNode) {
    this.analyserPre = analyserPre;
    this.analyserPost = analyserPost;

    // frequencyBinCount = fftSize / 2
    this.preBuffer = new Float32Array(analyserPre.frequencyBinCount);
    this.postBuffer = new Float32Array(analyserPost.frequencyBinCount);
    // 피크 검출용 — fftSize 크기 (매 프레임 할당 방지)
    this.timeDomainBuffer = new Float32Array(analyserPost.fftSize);
    // 반환 객체 사전 할당
    this.dataResult = { pre: this.preBuffer, post: this.postBuffer };
  }

  /** Pre-EQ 주파수 데이터 (dB 단위) */
  getPreFrequencyData(): Float32Array {
    this.analyserPre.getFloatFrequencyData(this.preBuffer);
    return this.preBuffer;
  }

  /** Post-EQ 주파수 데이터 (dB 단위) */
  getPostFrequencyData(): Float32Array {
    this.analyserPost.getFloatFrequencyData(this.postBuffer);
    return this.postBuffer;
  }

  /** Pre/Post 데이터를 한번에 가져온다 — 사전 할당된 객체를 반환 */
  getData(): AnalyserData {
    this.getPreFrequencyData();
    this.getPostFrequencyData();
    return this.dataResult;
  }

  /** Post-EQ 시간 도메인 데이터에서 피크 검출 (PeakLED용) */
  getPostPeak(): number {
    this.analyserPost.getFloatTimeDomainData(this.timeDomainBuffer);

    let peak = 0;
    const buf = this.timeDomainBuffer;
    const len = buf.length;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(buf[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  get frequencyBinCount(): number {
    return this.analyserPre.frequencyBinCount;
  }

  get sampleRate(): number {
    // AnalyserNode의 context에서 sampleRate를 가져온다
    return this.analyserPre.context.sampleRate;
  }
}
