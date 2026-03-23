"use client";

import type { NodeProps } from "@xyflow/react";
import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T052: Analyser 노드 — Pre/Post 라벨, FFT 사이즈 표시 */
export default function AnalyserNodeDisplay(
  props: NodeProps & { data: { variant: "pre" | "post" } },
) {
  const isPre = props.data.variant === "pre";

  return (
    <NodeShell
      label={isPre ? "Analyser (Pre)" : "Analyser (Post)"}
      icon="📊"
      accentColor={isPre ? "#94a3b8" : "#a78bfa"}
    >
      <ParamRow label="FFT" value="2048" />
      <ParamRow label="Position" value={isPre ? "Pre-EQ" : "Post-EQ"} />
    </NodeShell>
  );
}
