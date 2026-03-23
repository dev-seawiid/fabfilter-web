"use client";

import type { CSSProperties } from "react";
import { Handle, Position } from "@xyflow/react";

interface NodeShellProps {
  label: string;
  icon: React.ReactNode;
  accentColor?: string;
  children?: React.ReactNode;
  /** 입력 핸들 표시 여부 (Source 노드는 false) */
  hasInput?: boolean;
  /** 출력 핸들 표시 여부 (Destination 노드는 false) */
  hasOutput?: boolean;
}

/**
 * 모든 오디오 노드의 공통 셸.
 * Fabfilter 스타일: 어두운 배경, 미세한 보더, 상단 액센트 바.
 *
 * 동적 accentColor는 CSS custom property `--accent`로 주입하여
 * 자식 요소에서 Tailwind `text-[--accent]` 등으로 참조한다.
 */
export default function NodeShell({
  label,
  icon,
  accentColor = "var(--color-accent-cyan, #00e5ff)",
  children,
  hasInput = true,
  hasOutput = true,
}: NodeShellProps) {
  const cssVars = { "--accent": accentColor } as CSSProperties;

  return (
    <div className="relative min-w-[120px]" style={cssVars}>
      {/* 상단 액센트 바 */}
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-lg bg-[--accent]" />

      <div className="bg-surface-900/95 border-surface-700/40 rounded-lg border px-3 pt-3 pb-2.5 shadow-lg backdrop-blur-sm">
        {/* 헤더: 아이콘 + 라벨 */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-[11px] text-[--accent]">{icon}</span>
          <span className="text-[9px] font-medium tracking-widest text-[--accent] uppercase opacity-80">
            {label}
          </span>
        </div>

        {/* 파라미터 슬롯 */}
        {children && <div className="flex flex-col gap-1">{children}</div>}
      </div>

      {/* React Flow 핸들 */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-surface-600 !border-surface-500 !h-2 !w-2"
        />
      )}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-surface-600 !border-surface-500 !h-2 !w-2"
        />
      )}
    </div>
  );
}
