"use client";

import { useAudioStore } from "@/store/useAudioStore";
import { formatHz } from "@/utils/formatting";
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
