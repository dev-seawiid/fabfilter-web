import type { AnalyserData } from "./types";

/**
 * AnalyserBridge — Pre/Post AnalyserNode에서 주파수 데이터를 추출한다.
 *
 * useSpectrumData 훅에서 매 프레임 호출되어
 * SpectrumCanvas의 Layer 1(Pre) + Layer 3(Post) 데이터를 제공한다.
 */
export class AnalyserBridge {
  private analyserPre: AnalyserNode;
  private analyserPost: AnalyserNode;
  private preBuffer: Float32Array<ArrayBuffer>;
  private postBuffer: Float32Array<ArrayBuffer>;

  constructor(analyserPre: AnalyserNode, analyserPost: AnalyserNode) {
    this.analyserPre = analyserPre;
    this.analyserPost = analyserPost;

    // frequencyBinCount = fftSize / 2
    this.preBuffer = new Float32Array(analyserPre.frequencyBinCount);
    this.postBuffer = new Float32Array(analyserPost.frequencyBinCount);
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

  /** Pre/Post 데이터를 한번에 가져온다 */
  getData(): AnalyserData {
    return {
      pre: this.getPreFrequencyData(),
      post: this.getPostFrequencyData(),
    };
  }

  /** Post-EQ 시간 도메인 데이터에서 피크 검출 (PeakLED용) */
  getPostPeak(): number {
    const timeData: Float32Array<ArrayBuffer> = new Float32Array(this.analyserPost.fftSize);
    this.analyserPost.getFloatTimeDomainData(timeData);

    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const abs = Math.abs(timeData[i]);
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
