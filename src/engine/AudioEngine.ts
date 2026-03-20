import type { AudioFileMetadata } from "@/types/audio";
import { FilterEngine } from "./FilterEngine";
import type { AudioGraphNodes, EngineConfig } from "./types";

const DEFAULT_CONFIG: EngineConfig = {
  fftSize: 2048,
  smoothingTimeConstant: 0.015,
};

/**
 * AudioEngine — Web Audio API를 캡슐화한 순수 TypeScript 클래스.
 *
 * Constitution I: 고정 오디오 그래프 토폴로지
 * Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination
 *
 * React에 의존하지 않으며, Zustand 스토어를 통해 UI와 소통한다.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private nodes: AudioGraphNodes;
  private buffer: AudioBuffer | null = null;
  private startOffset = 0;
  private startTime = 0;
  private isPlaying = false;
  private onEndedCallback: (() => void) | null = null;
  private config: EngineConfig;
  private _filterEngine: FilterEngine | null = null;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ctx = new AudioContext();

    // 고정 노드 생성 — Source 제외 (재생 시마다 새로 생성)
    const analyserPre = this.ctx.createAnalyser();
    analyserPre.fftSize = this.config.fftSize;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 0;
    filter.Q.value = Math.SQRT1_2; // 0.707 — Butterworth (maximally flat)

    const gain = this.ctx.createGain();
    gain.gain.value = 1;

    const analyserPost = this.ctx.createAnalyser();
    analyserPost.fftSize = this.config.fftSize;

    // 정적 노드 연결: Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination
    analyserPre.connect(filter);
    filter.connect(gain);
    gain.connect(analyserPost);
    analyserPost.connect(this.ctx.destination);

    this.nodes = {
      source: null,
      analyserPre,
      filter,
      gain,
      analyserPost,
      destination: this.ctx.destination,
    };
  }

  // ── AudioContext 정책 (T019) ──

  /** 브라우저 자동재생 정책으로 suspended된 AudioContext를 resume */
  async ensureResumed(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  get context(): AudioContext {
    return this.ctx;
  }

  get graphNodes(): AudioGraphNodes {
    return this.nodes;
  }

  // ── 파일 디코딩 ──

  /** ArrayBuffer → AudioBuffer 디코딩 + 메타데이터 추출 */
  async decodeFile(file: File): Promise<{
    buffer: AudioBuffer;
    metadata: AudioFileMetadata;
  }> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    // 이전 버퍼 교체 시 기존 재생 중지
    if (this.isPlaying) {
      this.stop();
    }
    this.buffer = audioBuffer;
    this.startOffset = 0;

    return {
      buffer: audioBuffer,
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
      },
    };
  }

  // ── 재생 제어 ──

  /** 현재 오프셋부터 재생 시작 */
  play(): void {
    if (!this.buffer || this.isPlaying) return;

    // AudioBufferSourceNode는 1회성 — 매번 새로 생성
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.nodes.analyserPre);

    // T025: onended 핸들링
    source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.nodes.source = null;
        this.startOffset = 0;
        this.onEndedCallback?.();
      }
    };

    this.nodes.source = source;
    this.startTime = this.ctx.currentTime;
    source.start(0, this.startOffset);
    this.isPlaying = true;
  }

  /** 재생 정지 (현재 위치 기억) */
  stop(): void {
    if (!this.isPlaying || !this.nodes.source) return;

    // getCurrentTime()은 isPlaying=true일 때만 경과 시간을 계산하므로
    // 반드시 isPlaying을 false로 바꾸기 전에 호출해야 한다
    this.startOffset = this.getCurrentTime();
    this.isPlaying = false;

    // onended가 stop에 의해 트리거되지 않도록 콜백 제거 후 stop
    this.nodes.source.onended = null;
    this.nodes.source.stop();
    this.nodes.source.disconnect();
    this.nodes.source = null;
  }

  /** 특정 시간으로 seek (seconds) */
  seek(time: number): void {
    if (!this.buffer) return;

    const clampedTime = Math.max(0, Math.min(time, this.buffer.duration));

    if (this.isPlaying) {
      // 재생 중이면 정지 후 새 위치에서 재시작
      this.stop();
      this.startOffset = clampedTime;
      this.play();
    } else {
      this.startOffset = clampedTime;
    }
  }

  /** 현재 재생 위치 (seconds) — AudioContext.currentTime 기반 */
  getCurrentTime(): number {
    if (!this.buffer) return 0;

    if (this.isPlaying) {
      const elapsed = this.ctx.currentTime - this.startTime;
      return Math.min(this.startOffset + elapsed, this.buffer.duration);
    }
    return this.startOffset;
  }

  /** 총 재생 길이 (seconds) */
  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  // ── 콜백 ──

  /** 재생 완료 시 호출될 콜백 등록 */
  onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  // ── Filter / Gain 제어 (T035, T036) ──

  /** FilterEngine 인스턴스 — lazy init */
  get filterEngine(): FilterEngine {
    if (!this._filterEngine) {
      this._filterEngine = new FilterEngine(
        this.nodes.filter,
        this.ctx,
        this.config.smoothingTimeConstant,
      );
    }
    return this._filterEngine;
  }

  /** Gain 값 설정 (0~1). setTargetAtTime으로 스무딩 적용 */
  setGain(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.nodes.gain.gain.setTargetAtTime(
      clamped,
      this.ctx.currentTime,
      this.config.smoothingTimeConstant,
    );
  }

  // ── 리소스 해제 ──

  /** 모든 노드 연결 해제 + AudioContext 종료 */
  async dispose(): Promise<void> {
    this.stop();

    this.nodes.analyserPre.disconnect();
    this.nodes.filter.disconnect();
    this.nodes.gain.disconnect();
    this.nodes.analyserPost.disconnect();

    this.buffer = null;
    this.onEndedCallback = null;
    this._filterEngine = null;

    await this.ctx.close();
  }
}
