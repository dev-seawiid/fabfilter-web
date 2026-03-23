"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useAudioStore } from "@/store/useAudioStore";

/**
 * T054: 신호 흐름 엣지 — 재생 중에만 애니메이션 활성화.
 *
 * CSS stroke-dasharray + @keyframes로 신호가 왼→오로
 * 흐르는 시각적 피드백을 제공한다.
 */

/** BaseEdge는 style prop만 받으므로 모듈 레벨 상수로 정의 */
const bgEdgeStyle = { stroke: "rgba(255, 255, 255, 0.08)", strokeWidth: 2 };

export default function SignalFlowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } =
    props;

  const isPlaying = useAudioStore((s) => s.playbackState === "playing");

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      {/* 배경 선 (항상 표시) */}
      <BaseEdge path={edgePath} style={bgEdgeStyle} />

      {/* 신호 흐름 선 (재생 시 애니메이션) */}
      <path
        d={edgePath}
        fill="none"
        stroke={isPlaying ? "#00e5ff" : "rgba(255, 255, 255, 0.15)"}
        strokeWidth={isPlaying ? 2 : 1.5}
        strokeDasharray={isPlaying ? "6 4" : "none"}
        strokeLinecap="round"
        className={`signal-edge ${isPlaying ? "signal-edge--active" : ""}`}
      />
    </>
  );
}
