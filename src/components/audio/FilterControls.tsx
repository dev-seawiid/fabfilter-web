"use client";

import { useAudioStore } from "@/store/useAudioStore";
import Knob from "@/components/ui/Knob";

/** Hz를 사람이 읽기 쉬운 형태로 포맷 */
function formatHz(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)}k`;
  }
  return `${Math.round(hz)}`;
}

// 모듈 레벨 상수 — 매 render마다 새 함수 생성 방지 (rerender-memo-with-default-value)
const formatCutoff = (v: number) => `${formatHz(v)}Hz`;
const formatGain = (v: number) => `${Math.round(v * 100)}%`;

export default function FilterControls() {
  const cutoffHz = useAudioStore((s) => s.filterParams.cutoffHz);
  const gain = useAudioStore((s) => s.filterParams.gain);
  const setCutoff = useAudioStore((s) => s.setCutoff);
  const setGain = useAudioStore((s) => s.setGain);

  return (
    <div className="flex items-center gap-6">
      {/* 필터 타입 표시 */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-text-muted text-[9px] tracking-wider uppercase">
          Filter
        </span>
        <span className="text-text-secondary text-[10px]">HP</span>
      </div>

      {/* Cutoff 노브 — 로그 스케일 (20Hz ~ 20kHz) */}
      <Knob
        value={cutoffHz}
        min={20}
        max={20000}
        onChange={setCutoff}
        label="Cutoff"
        formatValue={formatCutoff}
        logarithmic
        size={44}
      />

      {/* Gain 노브 — 선형 (0 ~ 1) */}
      <Knob
        value={gain}
        min={0}
        max={1}
        onChange={setGain}
        label="Gain"
        formatValue={formatGain}
        size={44}
      />
    </div>
  );
}
