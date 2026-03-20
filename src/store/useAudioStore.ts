import { create } from "zustand";
import type {
  PlaybackState,
  FilterParams,
  AudioFileMetadata,
} from "@/types/audio";

/** 오디오 스토어 상태 — Constitution II: Single Source of Truth */
export interface AudioState {
  // ── Playback ──
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  fileMetadata: AudioFileMetadata | null;

  // ── Filter ──
  filterParams: FilterParams;
}

/** 오디오 스토어 액션 — 구현은 Phase 3 이후 */
export interface AudioActions {
  // ── Playback Actions ──
  loadFile: (file: File) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  reset: () => void;

  // ── Filter Actions ──
  setCutoff: (hz: number) => void;
  setGain: (value: number) => void;
}

export type AudioStore = AudioState & AudioActions;

const initialState: AudioState = {
  playbackState: "idle",
  currentTime: 0,
  duration: 0,
  isLoading: false,
  error: null,
  fileMetadata: null,
  filterParams: {
    cutoffHz: 20,
    gain: 1,
  },
};

export const useAudioStore = create<AudioStore>()((set) => ({
  ...initialState,

  // Playback actions — stub (Phase 3에서 구현)
  loadFile: async () => {
    set({ isLoading: true });
  },
  play: () => {
    set({ playbackState: "playing" });
  },
  pause: () => {
    set({ playbackState: "stopped" });
  },
  seek: () => {
    // Phase 3에서 구현
  },
  reset: () => {
    set({
      playbackState: "idle",
      currentTime: 0,
      error: null,
    });
  },

  // Filter actions — stub (Phase 4에서 구현)
  setCutoff: () => {
    // Phase 4에서 구현
  },
  setGain: () => {
    // Phase 4에서 구현
  },
}));
