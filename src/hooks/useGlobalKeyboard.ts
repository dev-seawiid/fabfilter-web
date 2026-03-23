import { SEEK_STEP, SEEK_STEP_SHIFT } from "@/components/audio/Timeline";
import { useAudioStore } from "@/store/useAudioStore";
import { useEffect } from "react";

/**
 * 전역 키보드 단축키 훅.
 *
 * - Space: 재생/정지 토글
 * - ArrowRight / ArrowLeft: ±5초 seek
 * - Shift + Arrow: ±15초 seek
 *
 * input/textarea/slider 포커스 시에는 무시하여 사용자 입력을 방해하지 않는다.
 */
export function useGlobalKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.getAttribute("role") === "slider") return;

      const state = useAudioStore.getState();

      // Space → 재생/정지 토글
      if (e.key === " ") {
        e.preventDefault();
        if (state.playbackState === "playing") {
          state.pause();
        } else if (state.playbackState === "stopped") {
          state.play();
        }
        return;
      }

      // Arrow → Seek (파일 로드 상태에서만)
      if (
        state.playbackState === "stopped" ||
        state.playbackState === "playing"
      ) {
        const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;
        const info = state.getPlaybackInfo();

        if (e.key === "ArrowRight") {
          e.preventDefault();
          state.seek(Math.min(info.duration, info.currentTime + step));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          state.seek(Math.max(0, info.currentTime - step));
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
