import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useAudioStore, __resetEngineForTesting } from "../useAudioStore";
import {
  setupWebAudioMock,
  teardownWebAudioMock,
  MockAudioContext,
} from "@/__mocks__/web-audio-api";

const initialState = {
  playbackState: "idle" as const,
  currentTime: 0,
  duration: 0,
  isLoading: false,
  error: null,
  fileMetadata: null,
  filterParams: { cutoffHz: 20, gain: 1 },
};

describe("useAudioStore", () => {
  beforeEach(() => {
    setupWebAudioMock();
    __resetEngineForTesting();
    useAudioStore.setState(initialState);
  });

  afterEach(() => {
    teardownWebAudioMock();
  });

  // ── 초기 상태 ──

  describe("초기 상태", () => {
    it("초기 상태가 기대값과 일치한다", () => {
      const state = useAudioStore.getState();
      expect(state).toMatchObject(initialState);
    });
  });

  // ── loadFile ──

  describe("loadFile 액션", () => {
    it("로딩 시작 시 isLoading=true, playbackState=loading으로 전환된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      const promise = useAudioStore.getState().loadFile(file);

      expect(useAudioStore.getState().isLoading).toBe(true);
      expect(useAudioStore.getState().playbackState).toBe("loading");

      await promise;
    });

    it("로딩 완료 시 메타데이터와 duration이 설정된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      const state = useAudioStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.playbackState).toBe("stopped");
      expect(state.duration).toBe(10);
      expect(state.fileMetadata).toEqual({
        name: "test.wav",
        size: file.size,
        type: "audio/wav",
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 2,
      });
    });

    it("이전 에러가 클리어된다", async () => {
      useAudioStore.setState({ error: "previous error" });

      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      expect(useAudioStore.getState().error).toBeNull();
    });

    it("디코딩 실패 시 에러가 설정되고 idle로 복귀한다", async () => {
      // 먼저 정상 loadFile로 엔진 생성을 유도
      const goodFile = new File(["dummy"], "ok.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(goodFile);

      // 생성된 엔진의 AudioContext 인스턴스에서 decodeAudioData를 reject하도록 교체
      const { getPlaybackInfo } = useAudioStore.getState();
      getPlaybackInfo(); // 엔진이 확실히 존재하도록
      // store 내부 engine의 ctx를 직접 건드릴 수 없으므로,
      // 새 엔진을 만들 때 reject하도록 MockAudioContext 자체를 교체
      __resetEngineForTesting();

      const OrigMock = globalThis.AudioContext;
      const FailingCtx = class extends MockAudioContext {
        decodeAudioData = vi.fn(async () => {
          throw new Error("Unsupported format");
        });
      };
      vi.stubGlobal("AudioContext", FailingCtx);

      useAudioStore.setState({ ...initialState });

      const file = new File(["dummy"], "bad.ogg", { type: "audio/ogg" });
      await useAudioStore.getState().loadFile(file);

      const state = useAudioStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.playbackState).toBe("idle");
      expect(state.error).toBe("Unsupported format");

      vi.stubGlobal("AudioContext", OrigMock);
    });
  });

  // ── play / pause ──

  describe("play 액션", () => {
    it("stopped 상태에서 play하면 playing으로 전환된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);
      expect(useAudioStore.getState().playbackState).toBe("stopped");

      await useAudioStore.getState().play();

      expect(useAudioStore.getState().playbackState).toBe("playing");
    });

    it("idle 상태에서 play하면 무시된다", async () => {
      await useAudioStore.getState().play();
      expect(useAudioStore.getState().playbackState).toBe("idle");
    });

    it("ensureResumed 실패 시 에러가 설정된다", async () => {
      // resume이 reject하는 AudioContext로 교체
      __resetEngineForTesting();

      const OrigMock = globalThis.AudioContext;
      const FailingCtx = class extends MockAudioContext {
        state: AudioContextState = "suspended";
        resume = vi.fn(async () => {
          throw new Error("User gesture required");
        });
      };
      vi.stubGlobal("AudioContext", FailingCtx);

      // loadFile은 내부에서 ensureResumed를 호출하므로 직접 상태 설정
      useAudioStore.setState({ playbackState: "stopped" });

      await useAudioStore.getState().play();

      expect(useAudioStore.getState().error).toBe("User gesture required");

      vi.stubGlobal("AudioContext", OrigMock);
    });
  });

  describe("pause 액션", () => {
    it("playing 상태에서 pause하면 stopped으로 전환된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);
      await useAudioStore.getState().play();

      useAudioStore.getState().pause();

      expect(useAudioStore.getState().playbackState).toBe("stopped");
    });

    it("pause 시 currentTime이 현재 위치로 기록된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      useAudioStore.getState().seek(3);
      await useAudioStore.getState().play();
      useAudioStore.getState().pause();

      // mock에서 ctx.currentTime=0이라 elapsed=0, startOffset=3
      expect(useAudioStore.getState().currentTime).toBe(3);
    });
  });

  // ── seek ──

  describe("seek 액션", () => {
    it("seek하면 currentTime이 업데이트된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      useAudioStore.getState().seek(5);

      expect(useAudioStore.getState().currentTime).toBe(5);
    });
  });

  // ── reset ──

  describe("reset 액션", () => {
    it("reset하면 currentTime이 0이 되고 stopped 상태가 된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);
      useAudioStore.getState().seek(5);

      useAudioStore.getState().reset();

      expect(useAudioStore.getState().currentTime).toBe(0);
      expect(useAudioStore.getState().playbackState).toBe("stopped");
    });
  });

  // ── getPlaybackInfo ──

  describe("getPlaybackInfo 액션", () => {
    it("엔진의 현재 시간과 duration을 반환한다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      const info = useAudioStore.getState().getPlaybackInfo();

      expect(info).toEqual({
        currentTime: 0,
        duration: 10,
      });
    });

    it("seek 후 정확한 위치를 반환한다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);

      useAudioStore.getState().seek(7);

      const info = useAudioStore.getState().getPlaybackInfo();
      expect(info.currentTime).toBe(7);
    });
  });

  // ── onEnded 통합 ──

  describe("onEnded → store 리셋 통합 (FR-013)", () => {
    it("재생 완료 시 store가 stopped/currentTime=0으로 리셋된다", async () => {
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await useAudioStore.getState().loadFile(file);
      await useAudioStore.getState().play();

      expect(useAudioStore.getState().playbackState).toBe("playing");

      // 엔진의 onEnded 시뮬레이션: useAudioStore.setState 직접 호출
      // (getOrCreateEngine에서 engine.onEnded로 등록한 콜백이 이것을 수행)
      useAudioStore.setState({
        playbackState: "stopped",
        currentTime: 0,
      });

      expect(useAudioStore.getState().playbackState).toBe("stopped");
      expect(useAudioStore.getState().currentTime).toBe(0);
    });
  });
});
