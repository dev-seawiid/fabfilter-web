import { create } from "zustand";
import type {
  PlaybackState,
  FilterParams,
  AudioFileMetadata,
} from "@/types/audio";
import { AudioEngine } from "@/engine/AudioEngine";

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

/** 오디오 스토어 액션 */
export interface AudioActions {
  // ── Playback Actions ──
  loadFile: (file: File) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  reset: () => void;
  updateCurrentTime: () => void;

  // ── Filter Actions ──
  setCutoff: (hz: number) => void;
  setGain: (value: number) => void;

  // ── Engine Access ──
  getEngine: () => AudioEngine;
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

/** 싱글턴 AudioEngine 인스턴스 — 스토어 외부에서 관리 */
let engine: AudioEngine | null = null;

function getOrCreateEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();

    // T025: 재생 완료 시 스토어 상태 리셋
    engine.onEnded(() => {
      useAudioStore.setState({
        playbackState: "stopped",
        currentTime: 0,
      });
    });
  }
  return engine;
}

export const useAudioStore = create<AudioStore>()((set, get) => ({
  ...initialState,

  getEngine: () => getOrCreateEngine(),

  loadFile: async (file: File) => {
    const eng = getOrCreateEngine();
    set({ isLoading: true, error: null, playbackState: "loading" });

    try {
      await eng.ensureResumed();
      const { metadata } = await eng.decodeFile(file);
      set({
        isLoading: false,
        fileMetadata: metadata,
        duration: metadata.duration,
        currentTime: 0,
        playbackState: "stopped",
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to decode audio file";
      set({
        isLoading: false,
        error: message,
        playbackState: "idle",
      });
    }
  },

  play: () => {
    const eng = getOrCreateEngine();
    const { playbackState } = get();
    if (playbackState !== "stopped") return;

    eng.ensureResumed().then(() => {
      eng.play();
      set({ playbackState: "playing" });
    });
  },

  pause: () => {
    const eng = getOrCreateEngine();
    if (!eng.playing) return;

    eng.stop();
    set({
      playbackState: "stopped",
      currentTime: eng.getCurrentTime(),
    });
  },

  seek: (time: number) => {
    const eng = getOrCreateEngine();
    eng.seek(time);
    set({ currentTime: eng.getCurrentTime() });
  },

  reset: () => {
    const eng = getOrCreateEngine();
    eng.seek(0);
    set({
      playbackState: "stopped",
      currentTime: 0,
    });
  },

  /** useAnimationFrame에서 매 프레임 호출 — currentTime 동기화 */
  updateCurrentTime: () => {
    const eng = getOrCreateEngine();
    if (eng.playing) {
      set({ currentTime: eng.getCurrentTime() });
    }
  },

  // Filter actions — stub (Phase 4에서 구현)
  setCutoff: () => {
    // Phase 4에서 구현
  },
  setGain: () => {
    // Phase 4에서 구현
  },
}));
