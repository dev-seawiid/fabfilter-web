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

// 시각화 상수
const MIN_DB = -90;
const MAX_DB = 0;
const MIN_HZ = 20;
const MAX_HZ = 20000;

// 색상
const PRE_COLOR = "rgba(100, 140, 180, 0.3)";
const PRE_FILL = "rgba(100, 140, 180, 0.08)";
const POST_COLOR = "rgba(0, 229, 255, 1)";
const POST_FILL = "rgba(0, 229, 255, 0.12)";
const FILTER_CURVE_COLOR = "rgba(255, 140, 0, 0.7)";
const FILTER_CURVE_FILL = "rgba(255, 140, 0, 0.06)";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const LABEL_COLOR = "rgba(255, 255, 255, 0.25)";

// 로그 주파수 배열 — getFrequencyResponse용 (모듈 레벨에서 1회 생성)
const FREQ_ARRAY = createLogFrequencyArray(MIN_HZ, MAX_HZ, 256);

// 눈금 주파수
const GRID_FREQUENCIES = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GRID_DB_VALUES = [-80, -60, -40, -20];

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
    const y = dbToY(data[i], height, MIN_DB, MAX_DB);

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
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillText(`${db}dB`, 3, y - 3);
  }
}

export default function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    // 배경 그리드
    drawGrid(ctx, width, height);

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

    // Layer 2: Filter response curve (getEngine 의존 — effect 내부에서 호출)
    ctx.save();
    const engine = getEngine();
    const { magResponse } =
      engine.filterEngine.getFrequencyResponse(FREQ_ARRAY);

    ctx.beginPath();
    for (let i = 0; i < FREQ_ARRAY.length; i++) {
      const x = hzToLogX(FREQ_ARRAY[i], width, MIN_HZ, MAX_HZ);
      const db = 20 * Math.log10(Math.max(1e-10, magResponse[i]));
      const y = dbToY(db, height, MIN_DB, MAX_DB);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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
