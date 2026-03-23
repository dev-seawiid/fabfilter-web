"use client";

import { useAudioStore } from "@/store/useAudioStore";
import { formatDb, gainToDb } from "@/utils/formatting";
import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T051: Gain 노드 — gain 값과 dB 변환 실시간 표시 */
export default function GainNodeDisplay() {
  const gain = useAudioStore((s) => s.filterParams.gain);
  const dbDisplay = formatDb(gainToDb(gain));

  return (
    <NodeShell label="Gain" icon="🔊" accentColor="#facc15">
      <ParamRow label="Level" value={`${Math.round(gain * 100)}%`} />
      <ParamRow label="dB" value={dbDisplay} />
    </NodeShell>
  );
}
