import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FilterEngine } from "../FilterEngine";
import {
  setupWebAudioMock,
  teardownWebAudioMock,
  MockAudioContext,
} from "@/__mocks__/web-audio-api";

describe("FilterEngine", () => {
  let ctx: MockAudioContext;
  let filterNode: BiquadFilterNode;
  let engine: FilterEngine;

  beforeEach(() => {
    setupWebAudioMock();
    ctx = new MockAudioContext() as unknown as MockAudioContext;
    filterNode = (ctx as unknown as AudioContext).createBiquadFilter();
    engine = new FilterEngine(
      filterNode as unknown as BiquadFilterNode,
      ctx as unknown as AudioContext,
    );
  });

  afterEach(() => {
    teardownWebAudioMock();
  });

  // ── setCutoff: smoothing 검증 (SC-005) ──

  describe("setCutoff", () => {
    it("setTargetAtTime을 올바른 인자로 호출한다", () => {
      engine.setCutoff(1000);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        1000,
        ctx.currentTime,
        0.015, // default timeConstant
      );
    });

    it("0Hz 미만 값은 0으로 클램핑된다", () => {
      engine.setCutoff(-100);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("20000Hz 초과 값은 20000으로 클램핑된다", () => {
      engine.setCutoff(25000);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        20000,
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("경계값 0Hz를 정확히 설정할 수 있다", () => {
      engine.setCutoff(0);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("경계값 20000Hz를 정확히 설정할 수 있다", () => {
      engine.setCutoff(20000);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        20000,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  // ── setQ: smoothing 검증 ──

  describe("setQ", () => {
    it("setTargetAtTime을 올바른 인자로 호출한다", () => {
      engine.setQ(2.5);

      expect(filterNode.Q.setTargetAtTime).toHaveBeenCalledWith(
        2.5,
        ctx.currentTime,
        0.015,
      );
    });

    it("0.0001 미만 값은 0.0001로 클램핑된다", () => {
      engine.setQ(0);

      expect(filterNode.Q.setTargetAtTime).toHaveBeenCalledWith(
        0.0001,
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("1000 초과 값은 1000으로 클램핑된다", () => {
      engine.setQ(9999);

      expect(filterNode.Q.setTargetAtTime).toHaveBeenCalledWith(
        1000,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  // ── getCutoff / getQ ──

  describe("getCutoff / getQ", () => {
    it("getCutoff가 frequency.value를 반환한다", () => {
      filterNode.frequency.value = 500;
      expect(engine.getCutoff()).toBe(500);
    });

    it("getQ가 Q.value를 반환한다", () => {
      filterNode.Q.value = 1.41;
      expect(engine.getQ()).toBe(1.41);
    });
  });

  // ── getFrequencyResponse (SC-006) ──

  describe("getFrequencyResponse", () => {
    it("BiquadFilterNode.getFrequencyResponse를 올바른 버퍼로 호출한다", () => {
      const frequencies = new Float32Array([100, 1000, 10000]);

      engine.getFrequencyResponse(frequencies);

      expect(filterNode.getFrequencyResponse).toHaveBeenCalledWith(
        frequencies,
        expect.any(Float32Array),
        expect.any(Float32Array),
      );
    });

    it("반환된 magResponse와 phaseResponse의 길이가 입력 배열과 같다", () => {
      const frequencies = new Float32Array([20, 100, 500, 1000, 5000, 20000]);

      const { magResponse, phaseResponse } =
        engine.getFrequencyResponse(frequencies);

      expect(magResponse.length).toBe(frequencies.length);
      expect(phaseResponse.length).toBe(frequencies.length);
    });

    it("빈 배열을 전달해도 에러 없이 동작한다", () => {
      const frequencies = new Float32Array(0);

      const { magResponse, phaseResponse } =
        engine.getFrequencyResponse(frequencies);

      expect(magResponse.length).toBe(0);
      expect(phaseResponse.length).toBe(0);
    });
  });

  // ── Highpass 이론적 감쇄율 검증 (SC-006) ──
  //
  // 2차 Butterworth highpass (Q=0.707)의 이론적 감쇄율:
  //   - cutoff 주파수에서: -3dB
  //   - cutoff의 1/2 주파수에서: 약 -10dB ~ -11dB
  //   - cutoff의 2배 주파수에서: 약 0dB (통과)
  //
  // 이 테스트는 mock의 getFrequencyResponse에 이론치를 주입하여
  // FilterEngine이 BiquadFilterNode의 응답을 정확히 전달하는지 검증한다.

  describe("Highpass 감쇄율 이론치 전달 (SC-006)", () => {
    it("getFrequencyResponse가 BiquadFilterNode의 응답 데이터를 그대로 전달한다", () => {
      // 이론적 highpass 응답 시뮬레이션:
      // cutoff=1000Hz, Q=0.707 일 때
      // 500Hz → ~0.25 (-12dB), 1000Hz → ~0.707 (-3dB), 2000Hz → ~1.0 (0dB)
      const theoreticalMag = new Float32Array([0.25, 0.707, 1.0]);

      // Mock이 이론 응답을 채우도록 설정
      (filterNode.getFrequencyResponse as ReturnType<typeof vi.fn>).mockImplementation(
        (
          freq: Float32Array,
          mag: Float32Array,
          phase: Float32Array,
        ) => {
          for (let i = 0; i < freq.length; i++) {
            mag[i] = theoreticalMag[i] ?? 0;
            phase[i] = 0;
          }
        },
      );

      const frequencies = new Float32Array([500, 1000, 2000]);
      const { magResponse } = engine.getFrequencyResponse(frequencies);

      // Cutoff(1000Hz)에서 -3dB (magnitude ≈ 0.707)
      const dbAtCutoff = 20 * Math.log10(magResponse[1]);
      expect(dbAtCutoff).toBeCloseTo(-3, 0); // ±1dB

      // Cutoff 아래(500Hz)에서 감쇄 (magnitude < 1.0)
      const dbBelow = 20 * Math.log10(magResponse[0]);
      expect(dbBelow).toBeLessThan(-6);

      // Cutoff 위(2000Hz)에서 통과 (magnitude ≈ 1.0)
      const dbAbove = 20 * Math.log10(magResponse[2]);
      expect(dbAbove).toBeCloseTo(0, 0); // ±1dB
    });
  });

  // ── 커스텀 timeConstant ──

  describe("커스텀 timeConstant", () => {
    it("생성자에서 지정한 timeConstant가 setCutoff에 적용된다", () => {
      const customEngine = new FilterEngine(
        filterNode as unknown as BiquadFilterNode,
        ctx as unknown as AudioContext,
        0.05,
      );

      customEngine.setCutoff(440);

      expect(filterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(
        440,
        expect.any(Number),
        0.05,
      );
    });

    it("생성자에서 지정한 timeConstant가 setQ에 적용된다", () => {
      const customEngine = new FilterEngine(
        filterNode as unknown as BiquadFilterNode,
        ctx as unknown as AudioContext,
        0.1,
      );

      customEngine.setQ(5);

      expect(filterNode.Q.setTargetAtTime).toHaveBeenCalledWith(
        5,
        expect.any(Number),
        0.1,
      );
    });
  });
});
