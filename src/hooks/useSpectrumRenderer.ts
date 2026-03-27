import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { useAudioStore } from "@/store/useAudioStore";
import { AnalyserBridge } from "@/engine/AnalyserBridge";
import { applyEMA } from "@/utils/smoothing";
import { feedPeak } from "@/hooks/usePeakDetector";
import { useAnimationFrame } from "./useAnimationFrame";
import {
  binToHz,
  createLogFrequencyArray,
  dbToY,
  hzToLogX,
} from "@/utils/frequency";

// ── 시각화 상수 ──

const MIN_DB = -30;
const MAX_DB = 30;
const MIN_HZ = 20;
const MAX_HZ = 20000;
const SPECTRUM_DB_OFFSET = 30;
const SMOOTHING_ALPHA = 0.3;

const PRE_COLOR = "rgba(100, 140, 180, 0.35)";
const PRE_FILL = "rgba(100, 140, 180, 0.06)";
const POST_COLOR = "rgba(0, 229, 255, 0.9)";
const POST_FILL = "rgba(0, 229, 255, 0.1)";
const FILTER_CURVE_COLOR = "rgba(255, 140, 0, 0.8)";
const FILTER_CURVE_FILL = "rgba(255, 140, 0, 0.05)";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.25)";
const ZERO_DB_COLOR = "rgba(255, 255, 255, 0.12)";

const FREQ_ARRAY = createLogFrequencyArray(MIN_HZ, MAX_HZ, 256);
const GRID_FREQUENCIES = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GRID_DB_VALUES = [-24, -12, 0, 12, 24];

// ── 드로잉 헬퍼 ──

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  binCount: number,
  sampleRate: number,
  width: number,
  height: number,
  strokeColor: string,
  fillColor: string,
) {
  ctx.beginPath();
  let started = false;

  for (let i = 1; i < binCount; i++) {
    const hz = binToHz(i, sampleRate, binCount * 2);
    if (hz < MIN_HZ || hz > MAX_HZ) continue;

    const x = hzToLogX(hz, width, MIN_HZ, MAX_HZ);
    const y = dbToY(data[i] + SPECTRUM_DB_OFFSET, height, MIN_DB, MAX_DB);

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  ctx.font = "9px monospace";
  ctx.fillStyle = LABEL_COLOR;

  for (const hz of GRID_FREQUENCIES) {
    const x = hzToLogX(hz, width, MIN_HZ, MAX_HZ);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    const label = hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
    ctx.fillText(label, x + 3, height - 4);
  }

  for (const db of GRID_DB_VALUES) {
    const y = dbToY(db, height, MIN_DB, MAX_DB);
    ctx.strokeStyle = db === 0 ? ZERO_DB_COLOR : GRID_COLOR;
    ctx.lineWidth = db === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillText(`${db}dB`, 3, y - 3);
  }
}

// ── 훅 ──

/**
 * Canvas 스펙트럼 렌더러 훅.
 *
 * rAF 루프 안에서 FFT 수집 → EMA 스무딩 → 3-Layer Canvas 드로잉을 모두 처리한다.
 * React 렌더 사이클을 거치지 않으므로 재생 중 리렌더링 0회.
 *
 * 이전에는 useSpectrumData(useSyncExternalStore) → useEffect → Canvas 드로잉 구조였으나,
 * 매 프레임 React 리렌더링이 발생하여 Heap 증가와 DOM 노드 누적을 유발했다.
 * rAF 콜백에서 직접 Canvas에 그리면 React를 완전히 우회한다.
 */
export function useSpectrumRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  logicalSizeRef: RefObject<{ width: number; height: number }>,
  isActive: boolean,
) {
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null);
  const gridSizeRef = useRef({ width: 0, height: 0 });
  const freqXCacheRef = useRef<Float32Array | null>(null);
  const freqXWidthRef = useRef(0);

  // FFT 데이터 관련 ref — React 상태가 아닌 ref로 관리
  const bridgeRef = useRef<AnalyserBridge | null>(null);
  const smoothedPreRef = useRef<Float32Array | null>(null);
  const smoothedPostRef = useRef<Float32Array | null>(null);

  const playbackState = useAudioStore((s) => s.playbackState);
  const getEngine = useAudioStore((s) => s.getEngine);

  // AnalyserBridge 초기화 — playbackState 변경 시에만 실행 (이산 이벤트)
  useEffect(() => {
    if (playbackState === "idle") {
      bridgeRef.current = null;
      smoothedPreRef.current = null;
      smoothedPostRef.current = null;
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

  // rAF 루프 — FFT 수집 + 스무딩 + Canvas 드로잉을 한 번에 처리
  // React 리렌더링 없이 직접 Canvas에 그린다
  useAnimationFrame(
    () => {
      const canvas = canvasRef.current;
      const bridge = bridgeRef.current;
      const smoothedPre = smoothedPreRef.current;
      const smoothedPost = smoothedPostRef.current;
      if (!canvas || !bridge || !smoothedPre || !smoothedPost) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = logicalSizeRef.current;
      if (width === 0 || height === 0) return;

      // ── 1. FFT 수집 + 스무딩 ──
      const raw = bridge.getData();
      applyEMA(raw.pre, smoothedPre, SMOOTHING_ALPHA);
      applyEMA(raw.post, smoothedPost, SMOOTHING_ALPHA);

      const postPeak = bridge.getPostPeak();
      feedPeak(postPeak);

      // ── 2. Canvas 드로잉 ──
      ctx.clearRect(0, 0, width, height);

      // 배경 그리드 — offscreen 캐시
      if (
        !gridCacheRef.current ||
        gridSizeRef.current.width !== width ||
        gridSizeRef.current.height !== height
      ) {
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) drawGrid(offCtx, width, height);
        gridCacheRef.current = offscreen;
        gridSizeRef.current = { width, height };
      }
      ctx.drawImage(gridCacheRef.current, 0, 0);

      // Layer 1: Pre-EQ spectrum
      ctx.save();
      drawSpectrum(
        ctx,
        smoothedPre,
        bridge.frequencyBinCount,
        bridge.sampleRate,
        width,
        height,
        PRE_COLOR,
        PRE_FILL,
      );
      ctx.restore();

      // 주파수 X좌표 캐시
      if (!freqXCacheRef.current || freqXWidthRef.current !== width) {
        const cache = new Float32Array(FREQ_ARRAY.length);
        for (let i = 0; i < FREQ_ARRAY.length; i++) {
          cache[i] = hzToLogX(FREQ_ARRAY[i], width, MIN_HZ, MAX_HZ);
        }
        freqXCacheRef.current = cache;
        freqXWidthRef.current = width;
      }
      const freqX = freqXCacheRef.current;

      // Layer 2: Filter response curve
      ctx.save();
      const engine = getEngine();
      const { magResponse } =
        engine.filterEngine.getFrequencyResponse(FREQ_ARRAY);

      ctx.beginPath();
      for (let i = 0; i < FREQ_ARRAY.length; i++) {
        const db = 20 * Math.log10(Math.max(1e-10, magResponse[i]));
        const y = dbToY(db, height, MIN_DB, MAX_DB);

        if (i === 0) ctx.moveTo(freqX[i], y);
        else ctx.lineTo(freqX[i], y);
      }

      ctx.strokeStyle = FILTER_CURVE_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = FILTER_CURVE_FILL;
      ctx.fill();
      ctx.restore();

      // Layer 3: Post-EQ spectrum
      ctx.save();
      drawSpectrum(
        ctx,
        smoothedPost,
        bridge.frequencyBinCount,
        bridge.sampleRate,
        width,
        height,
        POST_COLOR,
        POST_FILL,
      );
      ctx.restore();
    },
    isActive && playbackState === "playing",
  );
}
