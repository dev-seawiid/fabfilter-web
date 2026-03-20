"use client";

import { useRef, useEffect } from "react";
import { useSpectrumData } from "@/hooks/useSpectrumData";
import { useAudioStore } from "@/store/useAudioStore";
import {
  hzToLogX,
  dbToY,
  binToHz,
  createLogFrequencyArray,
} from "@/utils/frequency";

// 시각화 상수 — Fabfilter 스타일: 0dB가 Canvas 수직 중앙
const MIN_DB = -30;
const MAX_DB = 30;
const MIN_HZ = 20;
const MAX_HZ = 20000;

// 스펙트럼 데이터 오프셋 — FFT dB(-60~0)를 디스플레이 범위 중앙으로 끌어올림
// 일반 음원의 RMS가 약 -20~-30dB이므로, 이 오프셋으로 스펙트럼이 중앙 부근에 표시됨
const SPECTRUM_DB_OFFSET = 30;

// 색상
const PRE_COLOR = "rgba(100, 140, 180, 0.35)";
const PRE_FILL = "rgba(100, 140, 180, 0.06)";
const POST_COLOR = "rgba(0, 229, 255, 0.9)";
const POST_FILL = "rgba(0, 229, 255, 0.1)";
const FILTER_CURVE_COLOR = "rgba(255, 140, 0, 0.8)";
const FILTER_CURVE_FILL = "rgba(255, 140, 0, 0.05)";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.25)";
const ZERO_DB_COLOR = "rgba(255, 255, 255, 0.12)";

// 로그 주파수 배열 — getFrequencyResponse용 (모듈 레벨에서 1회 생성)
const FREQ_ARRAY = createLogFrequencyArray(MIN_HZ, MAX_HZ, 256);

// 눈금 주파수
const GRID_FREQUENCIES = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GRID_DB_VALUES = [-24, -12, 0, 12, 24];

// ── 모듈 레벨 드로잉 헬퍼 (외부 의존성 없음) ──

/** 스펙트럼 곡선 드로잉 */
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
    // FFT dB값에 오프셋을 더해 디스플레이 범위 중앙 부근으로 이동
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

/** 배경 그리드 드로잉 */
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
    // 0dB 라인 강조 — Fabfilter 스타일 중앙 기준선
    ctx.strokeStyle = db === 0 ? ZERO_DB_COLOR : GRID_COLOR;
    ctx.lineWidth = db === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillText(`${db}dB`, 3, y - 3);
  }
}

export default function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logicalSizeRef = useRef({ width: 0, height: 0 });
  // 그리드 offscreen 캐시 — 리사이즈 시에만 재생성 (js-cache-function-results)
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null);
  const gridSizeRef = useRef({ width: 0, height: 0 });
  // FREQ_ARRAY X좌표 캐시 — width가 변할 때만 재계산
  const freqXCacheRef = useRef<Float32Array | null>(null);
  const freqXWidthRef = useRef(0);
  const spectrumData = useSpectrumData();
  const getEngine = useAudioStore((s) => s.getEngine);
  const playbackState = useAudioStore((s) => s.playbackState);

  const isActive = playbackState === "playing";

  // Canvas 렌더 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrumData || !isActive) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // CSS 논리 크기를 사용 (ctx.scale(dpr)이 이미 적용되어 있으므로)
    const { width, height } = logicalSizeRef.current;
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    // 배경 그리드 — offscreen 캐시에서 복사 (리사이즈 시에만 재그리기)
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

    // Layer 1: Pre-EQ spectrum (ghost)
    ctx.save();
    drawSpectrum(
      ctx,
      spectrumData.preData,
      spectrumData.binCount,
      spectrumData.sampleRate,
      width,
      height,
      PRE_COLOR,
      PRE_FILL,
    );
    ctx.restore();

    // FREQ_ARRAY X좌표 캐시 갱신 (리사이즈 시에만)
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

    // Layer 3: Post-EQ spectrum (primary)
    ctx.save();
    drawSpectrum(
      ctx,
      spectrumData.postData,
      spectrumData.binCount,
      spectrumData.sampleRate,
      width,
      height,
      POST_COLOR,
      POST_FILL,
    );
    ctx.restore();
  }, [spectrumData, isActive, getEngine]);

  // Canvas 리사이즈 핸들링
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        // CSS 논리 크기 저장 — 렌더 루프에서 사용
        logicalSizeRef.current = { width, height };
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* 재생 중이 아닐 때 오버레이 */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-text-muted text-xs">
            {playbackState === "idle"
              ? "Upload a file to begin"
              : "Press play to visualize"}
          </p>
        </div>
      )}
    </div>
  );
}
