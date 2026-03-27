import { AudioEngine } from "@/engine/AudioEngine";
import type {
  AudioFileMetadata,
  FilterParams,
  PlaybackState,
} from "@/types/audio";
import { create } from "zustand";

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
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  reset: () => void;

  // ── Filter Actions ──
  setCutoff: (hz: number) => void;
  setQ: (value: number) => void;
  setGain: (value: number) => void;

  // ── Engine Access (읽기 전용) ──
  getPlaybackInfo: () => { currentTime: number; duration: number };
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
    cutoffHz: 0,
    q: Math.SQRT1_2, // 0.707 — Butterworth (maximally flat)
    gain: 1,
  },
};

/**
 * 싱글턴 AudioEngine — globalThis에 저장하여 HMR 시에도 인스턴스 유지.
 *
 * Next.js 개발 환경에서 HMR이 발생하면 모듈 스코프 변수(`let engine`)가
 * 초기화되어 이전 AudioContext가 해제되지 않은 채 새 인스턴스가 생길 수 있다.
 * globalThis에 저장하면 모듈 재평가와 무관하게 동일 인스턴스를 참조한다.
 */
const GLOBAL_KEY = "__fabfilter_audio_engine__" as const;

function getGlobalEngine(): AudioEngine | null {
  return (
    ((globalThis as Record<string, unknown>)[
      GLOBAL_KEY
    ] as AudioEngine | null) ?? null
  );
}

function setGlobalEngine(eng: AudioEngine | null): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = eng;
}

/** 테스트 전용 — 엔진 싱글턴 리셋 */
export function __resetEngineForTesting(): void {
  setGlobalEngine(null);
}

function getOrCreateEngine(): AudioEngine {
  let engine = getGlobalEngine();
  if (!engine) {
    engine = new AudioEngine();
    setGlobalEngine(engine);

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

  /** 읽기 전용 — 엔진의 현재 재생 정보만 노출 (Constitution II 준수) */
  getPlaybackInfo: () => {
    const eng = getOrCreateEngine();
    return {
      currentTime: eng.getCurrentTime(),
      duration: eng.getDuration(),
    };
  },

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

  play: async () => {
    const eng = getOrCreateEngine();
    const { playbackState } = get();
    if (playbackState !== "stopped") return;

    try {
      await eng.ensureResumed();
      eng.play();
      set({ playbackState: "playing" });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to resume audio context";
      set({ error: message });
    }
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

  setCutoff: (hz: number) => {
    const eng = getOrCreateEngine();
    const clamped = Math.max(0, Math.min(20000, hz));
    eng.filterEngine.setCutoff(clamped);
    set((state) => ({
      filterParams: { ...state.filterParams, cutoffHz: clamped },
    }));
  },

  setQ: (value: number) => {
    const eng = getOrCreateEngine();
    const clamped = Math.max(0.1, Math.min(18, value));
    eng.filterEngine.setQ(clamped);
    set((state) => ({
      filterParams: { ...state.filterParams, q: clamped },
    }));
  },

  setGain: (value: number) => {
    const eng = getOrCreateEngine();
    const clamped = Math.max(0, Math.min(1, value));
    eng.setGain(clamped);
    set((state) => ({
      filterParams: { ...state.filterParams, gain: clamped },
    }));
  },
}));
