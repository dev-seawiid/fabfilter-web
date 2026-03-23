"use client";

import { useAudioStore } from "@/store/useAudioStore";
import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T051: Gain 노드 — gain 값과 dB 변환 실시간 표시 */
export default function GainNodeDisplay() {
  const gain = useAudioStore((s) => s.filterParams.gain);

  // gain 0→-∞dB, gain 1→0dB
  const db = gain > 0 ? 20 * Math.log10(gain) : -Infinity;
  const dbDisplay = Number.isFinite(db) ? `${db.toFixed(1)}dB` : "-∞dB";

  return (
    <NodeShell label="Gain" icon="🔊" accentColor="#facc15">
      <ParamRow label="Level" value={`${Math.round(gain * 100)}%`} />
      <ParamRow label="dB" value={dbDisplay} />
    </NodeShell>
  );
}
