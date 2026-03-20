"use client";

import { useCallback, useId, useRef } from "react";
import { motion } from "framer-motion";

export interface KnobProps {
  /** 현재 값 */
  value: number;
  /** 최솟값 */
  min: number;
  /** 최댓값 */
  max: number;
  /** 값 변경 콜백 */
  onChange: (value: number) => void;
  /** 라벨 텍스트 */
  label: string;
  /** 값 표시 포맷터 */
  formatValue?: (value: number) => string;
  /** 로그 스케일 여부 (주파수 등) */
  logarithmic?: boolean;
  /** 노브 크기 (px) */
  size?: number;
}

// 노브 회전 범위: -135° ~ 135° (총 270°)
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const TOTAL_ARC_DEG = MAX_ANGLE - MIN_ANGLE; // 270

/** degree → radian */
function deg2rad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** 값을 0~1 정규화 (linear 또는 log) */
function valueToNormalized(
  value: number,
  min: number,
  max: number,
  logarithmic: boolean,
): number {
  if (logarithmic) {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    return (Math.log(value) - logMin) / (logMax - logMin);
  }
  return (value - min) / (max - min);
}

/** 0~1 정규화를 실제 값으로 변환 */
function normalizedToValue(
  normalized: number,
  min: number,
  max: number,
  logarithmic: boolean,
): number {
  if (logarithmic) {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    return Math.exp(logMin + normalized * (logMax - logMin));
  }
  return min + normalized * (max - min);
}

/**
 * 중심 cx, cy, 반지름 r, 각도 angleDeg (12시=0, 시계방향) 기준으로
 * SVG 좌표계에서 x, y를 반환.
 * SVG Y축은 아래가 +이므로 sin 방향 반전에 주의.
 * 우리 0은 12시(위쪽)에서 시작하지 않고, MIN_ANGLE=-135°에서 시작.
 * 실제 SVG 각도: 12시=−90°, 3시=0°, ...
 */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  // angleDeg: 노브 기준 (정중앙 위=0, 시계방향 양수)
  // SVG 기준으로 변환: SVG 0°는 3시 방향, 위쪽은 -90°
  const svgAngle = angleDeg - 90;
  const rad = deg2rad(svgAngle);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * SVG arc path 생성
 * startAngle~endAngle: 노브 기준 각도 (위=0, 시계방향)
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function Knob({
  value,
  min,
  max,
  onChange,
  label,
  formatValue,
  logarithmic = false,
  size = 56,
}: KnobProps) {
  const id = useId();
  const gradId = `knob-grad-${id}`.replace(/:/g, "");
  const innerGlowId = `knob-inner-${id}`.replace(/:/g, "");

  const dragStartY = useRef(0);
  const dragStartNorm = useRef(0);

  const normalized = valueToNormalized(value, min, max, logarithmic);

  // 노브 기준 각도: MIN_ANGLE(−135°) ~ MAX_ANGLE(135°), 0 = 위쪽
  const knobAngle = MIN_ANGLE + normalized * TOTAL_ARC_DEG;

  // SVG 레이아웃
  // 전체 SVG 크기는 size, 아크 링은 노브 바깥 약간 큰 원
  // 노브 원 반지름: (size/2 - strokeWidth/2 - margin)
  const svgSize = size + 14; // 아크 위한 여백
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const knobR = size / 2; // 노브 본체의 시각적 반지름
  const arcR = knobR + 4; // 아크 링 반지름 (노브 바로 바깥)
  const arcStroke = 2;
  const indicatorInnerR = knobR * 0.15;
  const indicatorOuterR = knobR * 0.82;

  // 아크 경로
  const trackPath = describeArc(cx, cy, arcR, MIN_ANGLE, MAX_ANGLE);
  const valuePath =
    normalized > 0 ? describeArc(cx, cy, arcR, MIN_ANGLE, knobAngle) : null;

  // 인디케이터 끝 좌표 (노브 안쪽)
  const indEnd = polarToCartesian(cx, cy, indicatorOuterR, knobAngle);
  const indStart = polarToCartesian(cx, cy, indicatorInnerR, knobAngle);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartNorm.current = normalized;
    },
    [normalized],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!e.buttons) return;
      // 200px 드래그 = 전체 범위
      const delta = (dragStartY.current - e.clientY) / 200;
      const newNorm = Math.max(0, Math.min(1, dragStartNorm.current + delta));
      const newValue = normalizedToValue(newNorm, min, max, logarithmic);
      onChange(newValue);
    },
    [min, max, logarithmic, onChange],
  );

  const displayValue = formatValue
    ? formatValue(value)
    : value.toFixed(logarithmic ? 0 : 2);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* SVG: 아크 + 노브 본체를 하나의 SVG로 통합 → 완벽한 정렬 보장 */}
      <motion.svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        style={{ cursor: "grab", overflow: "visible" }}
        whileHover="hover"
        whileTap={{ cursor: "grabbing" }}
      >
        <defs>
          {/* 노브 본체 3D 그라데이션 */}
          <radialGradient id={gradId} cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="45%" stopColor="#1e2433" />
            <stop offset="100%" stopColor="#0d1017" />
          </radialGradient>
          {/* 내부 글로우 필터 */}
          <filter id={innerGlowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── 트랙 배경 아크 (270°) ── */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={arcStroke}
          strokeLinecap="round"
        />

        {/* ── 값 아크 (cyan glow) ── */}
        {valuePath && (
          <motion.path
            d={valuePath}
            fill="none"
            stroke="var(--color-accent-cyan, #00e5ff)"
            strokeWidth={arcStroke}
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 3px rgba(0, 229, 255, 0.7))",
            }}
            initial={{ opacity: 0.8 }}
            variants={{ hover: { opacity: 1 } }}
          />
        )}

        {/* ── 노브 본체 원 ── */}
        <circle
          cx={cx}
          cy={cy}
          r={knobR - 1}
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* 상단 하이라이트 (광택 느낌) */}
        <ellipse
          cx={cx - knobR * 0.12}
          cy={cy - knobR * 0.3}
          rx={knobR * 0.35}
          ry={knobR * 0.18}
          fill="rgba(255,255,255,0.09)"
        />

        {/* ── 인디케이터 라인 ── */}
        <line
          x1={indStart.x}
          y1={indStart.y}
          x2={indEnd.x}
          y2={indEnd.y}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 2px rgba(0, 229, 255, 1))",
          }}
        />

        {/* 인디케이터 끝 점 (bright white dot) */}
        <circle
          cx={indEnd.x}
          cy={indEnd.y}
          r="1.2"
          fill="white"
          style={{
            filter: "drop-shadow(0 0 2px rgba(0, 229, 255, 1))",
          }}
        />

        {/* hover 시 외곽 링 강조 */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={knobR - 1}
          fill="none"
          stroke="var(--color-accent-cyan, #00e5ff)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          variants={{ hover: { opacity: 0.4 } }}
        />
      </motion.svg>

      {/* 값 표시 */}
      <span className="text-accent-cyan text-[10px] leading-none tabular-nums">
        {displayValue}
      </span>

      {/* 라벨 */}
      <span className="text-text-muted text-[9px] leading-none tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}
