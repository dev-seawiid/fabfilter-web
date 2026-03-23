"use client";

import { useAudioStore } from "@/store/useAudioStore";
import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T049: Source 노드 — 파일명 표시, playbackState 구독 */
export default function SourceNode() {
  const playbackState = useAudioStore((s) => s.playbackState);
  const fileName = useAudioStore((s) => s.fileMetadata?.name ?? "—");

  const stateIcon =
    playbackState === "playing" ? "▶" : playbackState === "stopped" ? "■" : "○";

  return (
    <NodeShell label="Source" icon="🎵" accentColor="#4ade80" hasInput={false}>
      <ParamRow label="File" value={truncate(fileName, 14)} />
      <ParamRow label="State" value={`${stateIcon} ${playbackState}`} />
    </NodeShell>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
