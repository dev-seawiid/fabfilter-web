"use client";

import { useSpectrumRenderer } from "@/hooks/useSpectrumRenderer";
import { useAudioStore } from "@/store/useAudioStore";
import { useEffect, useRef } from "react";

export default function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logicalSizeRef = useRef({ width: 0, height: 0 });

  const playbackState = useAudioStore((s) => s.playbackState);
  const isActive = playbackState === "playing";

  // Canvas 드로잉은 훅에 위임
  useSpectrumRenderer(canvasRef, logicalSizeRef, isActive);

  // Canvas 리사이즈 핸들링
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
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Spectrum visualization — Pre/Post EQ frequency analysis"
        className="absolute inset-0 h-full w-full"
      />
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
