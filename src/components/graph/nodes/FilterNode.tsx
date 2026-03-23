"use client";

import { useAudioStore } from "@/store/useAudioStore";
import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T050: Filter 노드 — cutoffHz, Q 실시간 표시 */
export default function FilterNode() {
  const cutoffHz = useAudioStore((s) => s.filterParams.cutoffHz);
  const q = useAudioStore((s) => s.filterParams.q);

  return (
    <NodeShell label="Filter" icon="⚡" accentColor="#ff8c00">
      <ParamRow label="Type" value="Highpass" />
      <ParamRow label="Cutoff" value={formatHz(cutoffHz)} />
      <ParamRow label="Q" value={q.toFixed(2)} />
    </NodeShell>
  );
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}
