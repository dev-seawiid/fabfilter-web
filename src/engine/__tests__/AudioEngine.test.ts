import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "../AudioEngine";
import {
  setupWebAudioMock,
  teardownWebAudioMock,
  connectCalls,
  disconnectCalls,
  MockAudioContext,
} from "@/__mocks__/web-audio-api";

describe("AudioEngine", () => {
  beforeEach(() => {
    setupWebAudioMock();
  });

  afterEach(async () => {
    teardownWebAudioMock();
  });

  // ── 노드 그래프 검증 ──

  describe("노드 연결 순서 (Constitution I)", () => {
    it("정적 노드가 올바른 순서로 연결된다: AnalyserPre → Filter → Gain → AnalyserPost → Destination", () => {
      new AudioEngine();

      expect(connectCalls).toEqual([
        { from: "AnalyserPre", to: "BiquadFilter" },
        { from: "BiquadFilter", to: "Gain" },
        { from: "Gain", to: "AnalyserPost" },
        { from: "AnalyserPost", to: "Destination" },
      ]);
    });

    it("Filter 노드의 기본 타입이 highpass이다", () => {
      const engine = new AudioEngine();
      expect(engine.graphNodes.filter.type).toBe("highpass");
    });

    it("Filter 노드의 기본 주파수가 20Hz이다", () => {
      const engine = new AudioEngine();
      expect(engine.graphNodes.filter.frequency.value).toBe(20);
    });

    it("Gain 노드의 기본 값이 1이다", () => {
      const engine = new AudioEngine();
      expect(engine.graphNodes.gain.gain.value).toBe(1);
    });

    it("AnalyserNode의 fftSize가 설정값과 일치한다", () => {
      const engine = new AudioEngine({ fftSize: 4096 });
      expect(engine.graphNodes.analyserPre.fftSize).toBe(4096);
      expect(engine.graphNodes.analyserPost.fftSize).toBe(4096);
    });
  });

  // ── AudioContext 정책 ──

  describe("AudioContext 정책 처리", () => {
    it("suspended 상태일 때 ensureResumed()가 resume()을 호출한다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      ctx.state = "suspended";

      await engine.ensureResumed();

      expect(ctx.resume).toHaveBeenCalledOnce();
    });

    it("running 상태일 때 ensureResumed()가 resume()을 호출하지 않는다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      ctx.state = "running";

      await engine.ensureResumed();

      expect(ctx.resume).not.toHaveBeenCalled();
    });
  });

  // ── 파일 디코딩 ──

  describe("파일 디코딩", () => {
    it("File을 디코딩하고 메타데이터를 반환한다", async () => {
      const engine = new AudioEngine();
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });

      const result = await engine.decodeFile(file);

      expect(result.metadata).toEqual({
        name: "test.wav",
        size: file.size,
        type: "audio/wav",
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 2,
      });
    });

    it("디코딩 후 duration이 올바르다", async () => {
      const engine = new AudioEngine();
      const file = new File(["dummy"], "test.mp3", { type: "audio/mpeg" });

      await engine.decodeFile(file);

      expect(engine.getDuration()).toBe(10);
    });
  });

  // ── 재생 제어 ──

  describe("재생 제어", () => {
    it("play()가 Source 노드를 AnalyserPre에 연결한다", async () => {
      const engine = new AudioEngine();
      const file = new File(["dummy"], "test.wav", { type: "audio/wav" });
      await engine.decodeFile(file);

      connectCalls.length = 0; // 정적 연결 기록 초기화
      engine.play();

      expect(connectCalls).toContainEqual({
        from: "BufferSource",
        to: "AnalyserPre",
      });
    });

    it("play() 후 playing이 true이다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.play();

      expect(engine.playing).toBe(true);
    });

    it("stop() 후 playing이 false이다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.play();
      engine.stop();

      expect(engine.playing).toBe(false);
    });

    it("버퍼 없이 play()를 호출하면 무시된다", () => {
      const engine = new AudioEngine();
      engine.play();
      expect(engine.playing).toBe(false);
    });

    it("이미 재생 중일 때 play()를 호출하면 무시된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.play();
      const ctx = engine.context as unknown as MockAudioContext;
      const callCount = ctx.createBufferSource.mock.calls.length;

      engine.play(); // 두 번째 호출
      expect(ctx.createBufferSource.mock.calls.length).toBe(callCount); // 새 Source 생성 안 됨
    });
  });

  // ── getCurrentTime ──

  describe("getCurrentTime 계산 (SC-002)", () => {
    it("재생 중 currentTime = startOffset + elapsed", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      // ctx.currentTime = 100 시점에서 재생 시작
      ctx.currentTime = 100;
      engine.play();

      // 3초 경과 시뮬레이션
      ctx.currentTime = 103;
      expect(engine.getCurrentTime()).toBe(3);
    });

    it("offset 5초에서 재생 시작 후 2초 경과 → 7초", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.seek(5);
      ctx.currentTime = 200;
      engine.play();

      ctx.currentTime = 202;
      expect(engine.getCurrentTime()).toBe(7);
    });

    it("currentTime이 duration을 초과하지 않는다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      ctx.currentTime = 0;
      engine.play();

      // duration(10) 초과 시뮬레이션
      ctx.currentTime = 999;
      expect(engine.getCurrentTime()).toBe(10);
    });

    it("정지 상태에서는 startOffset을 반환한다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      ctx.currentTime = 50;
      engine.play();
      ctx.currentTime = 53; // 3초 경과
      engine.stop();

      // stop 후 ctx.currentTime이 변해도 반환값은 stop 시점의 offset
      ctx.currentTime = 999;
      expect(engine.getCurrentTime()).toBe(3);
    });

    it("버퍼 없으면 0을 반환한다", () => {
      const engine = new AudioEngine();
      expect(engine.getCurrentTime()).toBe(0);
    });
  });

  // ── Seek ──

  describe("seek", () => {
    it("정지 상태에서 seek하면 위치만 변경된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.seek(5);

      expect(engine.getCurrentTime()).toBe(5);
      expect(engine.playing).toBe(false);
    });

    it("재생 중 seek하면 새 위치에서 재생이 계속된다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      ctx.currentTime = 0;
      engine.play();
      expect(engine.playing).toBe(true);

      // 재생 중 seek — 내부적으로 stop → offset 설정 → play
      ctx.currentTime = 5;
      engine.seek(7);

      expect(engine.playing).toBe(true);
      // seek 직후 elapsed=0이므로 getCurrentTime=7
      expect(engine.getCurrentTime()).toBe(7);
    });

    it("재생 중 seek 후 새 SourceNode가 생성된다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.play();
      const callsBefore = ctx.createBufferSource.mock.calls.length;

      engine.seek(3);

      // seek 중 stop+play가 일어나므로 새 SourceNode 생성
      expect(ctx.createBufferSource.mock.calls.length).toBe(callsBefore + 1);
    });

    it("seek 값이 0 미만이면 0으로 클램핑된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.seek(-10);

      expect(engine.getCurrentTime()).toBe(0);
    });

    it("seek 값이 duration을 초과하면 duration으로 클램핑된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      engine.seek(999);

      expect(engine.getCurrentTime()).toBe(10); // duration = 10
    });

    it("버퍼 없이 seek하면 무시된다", () => {
      const engine = new AudioEngine();
      engine.seek(5);
      expect(engine.getCurrentTime()).toBe(0);
    });
  });

  // ── decodeFile 중 재생 ──

  describe("decodeFile 중 재생 상태", () => {
    it("재생 중 새 파일 디코딩 시 기존 재생이 정지된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "first.wav", { type: "audio/wav" }),
      );

      engine.play();
      expect(engine.playing).toBe(true);

      await engine.decodeFile(
        new File(["dummy"], "second.wav", { type: "audio/wav" }),
      );

      expect(engine.playing).toBe(false);
    });
  });

  // ── onEnded ──

  describe("onEnded 콜백", () => {
    it("재생 완료 시 콜백이 호출된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      const onEnded = vi.fn();
      engine.onEnded(onEnded);

      engine.play();

      // Source의 onended 직접 호출하여 재생 완료 시뮬레이션
      const source = engine.graphNodes.source;
      expect(source).not.toBeNull();
      (source as unknown as { onended: (() => void) | null }).onended?.();

      expect(onEnded).toHaveBeenCalledOnce();
      expect(engine.playing).toBe(false);
    });

    it("stop()으로 정지하면 onEnded 콜백이 호출되지 않는다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );

      const onEnded = vi.fn();
      engine.onEnded(onEnded);

      engine.play();
      engine.stop();

      expect(onEnded).not.toHaveBeenCalled();
    });
  });

  // ── 리소스 해제 ──

  describe("dispose", () => {
    it("dispose() 호출 시 모든 정적 노드가 disconnect된다", async () => {
      const engine = new AudioEngine();
      disconnectCalls.length = 0;

      await engine.dispose();

      expect(disconnectCalls).toContain("AnalyserPre");
      expect(disconnectCalls).toContain("BiquadFilter");
      expect(disconnectCalls).toContain("Gain");
      expect(disconnectCalls).toContain("AnalyserPost");
      expect(disconnectCalls).toHaveLength(4);
    });

    it("dispose() 호출 시 AudioContext가 close된다", async () => {
      const engine = new AudioEngine();
      const ctx = engine.context as unknown as MockAudioContext;

      await engine.dispose();

      expect(ctx.close).toHaveBeenCalledOnce();
    });

    it("재생 중 dispose()하면 재생이 먼저 정지된다", async () => {
      const engine = new AudioEngine();
      await engine.decodeFile(
        new File(["dummy"], "test.wav", { type: "audio/wav" }),
      );
      engine.play();

      await engine.dispose();

      expect(engine.playing).toBe(false);
    });
  });
});
