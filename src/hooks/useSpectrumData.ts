import { useEffect, useRef, useSyncExternalStore } from "react";
import { AnalyserBridge } from "@/engine/AnalyserBridge";
import { applyEMA } from "@/utils/smoothing";
import { useAudioStore } from "@/store/useAudioStore";
import { useAnimationFrame } from "./useAnimationFrame";

export interface SpectrumData {
  preData: Float32Array;
  postData: Float32Array;
  postPeak: number;
  binCount: number;
  sampleRate: number;
}

const SMOOTHING_ALPHA = 0.3;

// ── 외부 스토어 패턴 ──
// React 19의 set-state-in-effect 규칙을 준수하면서
// rAF에서 고빈도 업데이트를 전달하기 위한 패턴
let spectrumSnapshot: SpectrumData | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return spectrumSnapshot;
}

/**
 * useSpectrumData — 매 프레임 AnalyserBridge에서 FFT 데이터를 가져와
 * EMA 스무딩을 적용한 뒤 반환한다.
 */
export function useSpectrumData(): SpectrumData | null {
  const playbackState = useAudioStore((s) => s.playbackState);
  const getEngine = useAudioStore((s) => s.getEngine);

  const bridgeRef = useRef<AnalyserBridge | null>(null);
  const smoothedPreRef = useRef<Float32Array | null>(null);
  const smoothedPostRef = useRef<Float32Array | null>(null);

  // AnalyserBridge 초기화
  useEffect(() => {
    if (playbackState === "idle") {
      bridgeRef.current = null;
      smoothedPreRef.current = null;
      smoothedPostRef.current = null;
      spectrumSnapshot = null;
      emitChange();
      return;
    }

    const engine = getEngine();
    const nodes = engine.graphNodes;
    bridgeRef.current = new AnalyserBridge(
      nodes.analyserPre,
      nodes.analyserPost,
    );

    const binCount = bridgeRef.current.frequencyBinCount;
    smoothedPreRef.current = new Float32Array(binCount).fill(-100);
    smoothedPostRef.current = new Float32Array(binCount).fill(-100);
  }, [playbackState, getEngine]);

  // 매 프레임 FFT 데이터 수집 + 스무딩
  useAnimationFrame(() => {
    const bridge = bridgeRef.current;
    const smoothedPre = smoothedPreRef.current;
    const smoothedPost = smoothedPostRef.current;
    if (!bridge || !smoothedPre || !smoothedPost) return;

    const raw = bridge.getData();
    applyEMA(raw.pre, smoothedPre, SMOOTHING_ALPHA);
    applyEMA(raw.post, smoothedPost, SMOOTHING_ALPHA);

    spectrumSnapshot = {
      preData: smoothedPre,
      postData: smoothedPost,
      postPeak: bridge.getPostPeak(),
      binCount: bridge.frequencyBinCount,
      sampleRate: bridge.sampleRate,
    };
    emitChange();
  }, playbackState === "playing");

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
