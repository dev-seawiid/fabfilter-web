"use client";

import {
  getLevelSnapshot,
  getSnapshot as peakGetSnapshot,
  subscribe as peakSubscribe,
  resetPeakState,
  subscribeLevel,
} from "@/hooks/usePeakDetector";
import { useEffect, useRef, useSyncExternalStore } from "react";

// ── 순수 계산 함수 (렌더 바깥에서 재사용) ──
const MIN_DB = -60;
const MAX_DB = 0;

function dbToPercent(db: number): number {
  if (!isFinite(db)) return 0;
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
}

function getLevelColor(db: number): string {
  if (db >= -3) return "#ef4444";
  if (db >= -12) return "#eab308";
  return "#22c55e";
}

function formatDb(db: number): string {
  if (!isFinite(db)) return "-∞";
  return db.toFixed(1);
}

// 마크선 위치는 불변이므로 상수로 미리 계산
const MARK_12DB_PCT = `${dbToPercent(-12)}%`;
const MARK_3DB_PCT = `${dbToPercent(-3)}%`;

// LED 스타일 — 매 render 객체 생성 방지 (rerender-memo-with-default-value)
const LED_STYLE_CLIPPING = {
  backgroundColor: "#ef4444",
  borderColor: "rgba(239,68,68,0.5)",
  boxShadow: "0 0 6px 2px rgba(239,68,68,0.6)",
} as const;

const LED_STYLE_NORMAL = {
  backgroundColor: "var(--color-surface-700, #374151)",
  borderColor: "var(--color-surface-600, #4b5563)",
} as const;

export default function PeakLED() {
  // ── isClipping만 useSyncExternalStore로 구독 (이벤트성, 매우 드뭄) ──
  const isClipping = useSyncExternalStore(
    peakSubscribe,
    peakGetSnapshot,
    peakGetSnapshot,
  );

  const handleClick = () => resetPeakState();

  // ── 볼륨 미터: React 렌더링 없이 DOM 직접 뮤테이션 ──
  const barRef = useRef<HTMLDivElement>(null);
  const dbTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onLevel() {
      const db = getLevelSnapshot();
      const pct = dbToPercent(db);
      const color = getLevelColor(db);

      if (barRef.current) {
        const shadow = pct > 0 ? `box-shadow:0 0 4px 1px ${color}40;` : "";
        barRef.current.style.cssText = `height:${pct}%;background:${color};opacity:0.85;${shadow}`;
      }

      if (dbTextRef.current) {
        dbTextRef.current.textContent = formatDb(db);
        dbTextRef.current.style.color = isFinite(db)
          ? color
          : "rgba(255,255,255,0.3)";
      }
    }

    // 마운트 시 현재 값으로 초기화
    onLevel();

    // 구독 — React 렌더 없이 콜백으로만 업데이트
    return subscribeLevel(onLevel);
  }, []); // deps 없음 — 구독은 마운트/언마운트에만 설정

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: 32 }}>
      {/* ── Peak LED 버튼 (isClipping 변경 시에만 리렌더) ── */}
      <button
        onClick={handleClick}
        title={isClipping ? "Click to reset peak" : "No clipping"}
        aria-label={
          isClipping
            ? "Peak clipping — click to reset"
            : "Peak meter — no clipping"
        }
        className="relative flex h-4 w-4 items-center justify-center"
        style={{ cursor: isClipping ? "pointer" : "default" }}
      >
        <div
          className="h-3 w-3 rounded-full border transition-colors duration-100"
          style={isClipping ? LED_STYLE_CLIPPING : LED_STYLE_NORMAL}
        />
      </button>

      {/* ── 세로 볼륨 미터 컨테이너 ── */}
      <div
        className="relative overflow-hidden rounded-sm"
        style={{
          width: 8,
          height: 56,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* 레벨 바 — ref로 직접 visiblity 제어, React 리렌더 없음 */}
        <div
          ref={barRef}
          className="absolute bottom-0 left-0 w-full"
          style={{ height: "0%", background: "#22c55e", opacity: 0.85 }}
        />
        {/* -12dB 마크 (불변) */}
        <div
          className="absolute left-0 w-full"
          style={{
            bottom: MARK_12DB_PCT,
            height: 1,
            background: "rgba(234,179,8,0.4)",
          }}
        />
        {/* -3dB 마크 (불변) */}
        <div
          className="absolute left-0 w-full"
          style={{
            bottom: MARK_3DB_PCT,
            height: 1,
            background: "rgba(239,68,68,0.4)",
          }}
        />
      </div>

      {/* ── dB 수치 — ref로 직접 textContent 업데이트 ── */}
      <span
        ref={dbTextRef}
        className="font-mono"
        style={{
          fontSize: 7,
          color: "rgba(255,255,255,0.3)",
          lineHeight: 1,
          letterSpacing: "0.02em",
          textAlign: "center",
          display: "block",
          width: "100%",
        }}
      >
        -∞
      </span>

      {/* ── 라벨 (정적) ── */}
      <span
        style={{
          fontSize: 7,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        Peak
      </span>
    </div>
  );
}
