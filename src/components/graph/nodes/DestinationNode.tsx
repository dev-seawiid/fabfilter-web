"use client";

import NodeShell from "./NodeShell";
import ParamRow from "./ParamRow";

/** T053: Destination 노드 — 스피커 아이콘, 출력 정보 */
export default function DestinationNode() {
  return (
    <NodeShell
      label="Destination"
      icon="🔈"
      accentColor="#f472b6"
      hasOutput={false}
    >
      <ParamRow label="Output" value="Speakers" />
      <ParamRow label="Channels" value="Stereo" />
    </NodeShell>
  );
}
