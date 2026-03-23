import { describe, it, expect } from "vitest";
import { applyEMA } from "../smoothing";

describe("applyEMA", () => {
  // ── 기본 동작 ──

  describe("기본 EMA 계산", () => {
    it("alpha=1이면 현재 값을 그대로 반영한다", () => {
      const current = new Float32Array([10, 20, 30]);
      const previous = new Float32Array([0, 0, 0]);

      const result = applyEMA(current, previous, 1.0);

      expect(result[0]).toBeCloseTo(10);
      expect(result[1]).toBeCloseTo(20);
      expect(result[2]).toBeCloseTo(30);
    });

    it("alpha=0이면 이전 값을 유지한다", () => {
      const current = new Float32Array([10, 20, 30]);
      const previous = new Float32Array([1, 2, 3]);

      const result = applyEMA(current, previous, 0);

      expect(result[0]).toBeCloseTo(1);
      expect(result[1]).toBeCloseTo(2);
      expect(result[2]).toBeCloseTo(3);
    });

    it("alpha=0.5이면 현재와 이전의 중간값이다", () => {
      const current = new Float32Array([10, 20, 30]);
      const previous = new Float32Array([0, 0, 0]);

      const result = applyEMA(current, previous, 0.5);

      // prev + 0.5 * (curr - prev) = 0 + 0.5 * 10 = 5
      expect(result[0]).toBeCloseTo(5);
      expect(result[1]).toBeCloseTo(10);
      expect(result[2]).toBeCloseTo(15);
    });

    it("기본 alpha=0.3을 사용한다", () => {
      const current = new Float32Array([100]);
      const previous = new Float32Array([0]);

      const result = applyEMA(current, previous);

      // 0 + 0.3 * (100 - 0) = 30
      expect(result[0]).toBeCloseTo(30);
    });
  });

  // ── 수렴 속도 검증 ──

  describe("수렴 속도", () => {
    it("alpha=0.1 (느린 수렴): 10회 반복 후 원본의 ~65%에 도달", () => {
      const target = new Float32Array([100]);
      const smoothed = new Float32Array([0]);

      for (let i = 0; i < 10; i++) {
        applyEMA(target, smoothed, 0.1);
      }

      // 이론값: 1 - (1-0.1)^10 = 1 - 0.9^10 ≈ 0.6513
      expect(smoothed[0]).toBeCloseTo(100 * (1 - Math.pow(0.9, 10)), 1);
    });

    it("alpha=0.3 (기본): 10회 반복 후 원본의 ~97%에 도달", () => {
      const target = new Float32Array([100]);
      const smoothed = new Float32Array([0]);

      for (let i = 0; i < 10; i++) {
        applyEMA(target, smoothed, 0.3);
      }

      // 이론값: 1 - (1-0.3)^10 = 1 - 0.7^10 ≈ 0.9718
      expect(smoothed[0]).toBeCloseTo(100 * (1 - Math.pow(0.7, 10)), 1);
    });

    it("alpha=0.9 (빠른 수렴): 3회 반복 후 원본의 ~99.9%에 도달", () => {
      const target = new Float32Array([100]);
      const smoothed = new Float32Array([0]);

      for (let i = 0; i < 3; i++) {
        applyEMA(target, smoothed, 0.9);
      }

      // 이론값: 1 - (1-0.9)^3 = 1 - 0.001 = 0.999
      expect(smoothed[0]).toBeCloseTo(100 * (1 - Math.pow(0.1, 3)), 1);
    });
  });

  // ── 버퍼 재사용 (zero-allocation) ──

  describe("버퍼 재사용", () => {
    it("previous 배열을 직접 수정하여 반환한다 (zero-allocation)", () => {
      const current = new Float32Array([10, 20]);
      const previous = new Float32Array([0, 0]);

      const result = applyEMA(current, previous, 0.5);

      // 반환값이 previous와 동일한 참조
      expect(result).toBe(previous);
    });
  });

  // ── NaN / Infinity 안전성 ──

  describe("NaN/Infinity 방어", () => {
    it("current에 NaN이 있으면 해당 bin의 이전 값을 유지한다", () => {
      const current = new Float32Array([NaN, 20, NaN]);
      const previous = new Float32Array([5, 10, 15]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBe(5); // NaN → 이전 값 유지
      expect(previous[1]).toBeCloseTo(15); // 정상 계산
      expect(previous[2]).toBe(15); // NaN → 이전 값 유지
    });

    it("current에 Infinity가 있으면 해당 bin의 이전 값을 유지한다", () => {
      const current = new Float32Array([Infinity, 20]);
      const previous = new Float32Array([5, 10]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBe(5); // Infinity → 이전 값 유지
      expect(previous[1]).toBeCloseTo(15);
    });

    it("current에 -Infinity가 있으면 해당 bin의 이전 값을 유지한다", () => {
      const current = new Float32Array([-Infinity, 20]);
      const previous = new Float32Array([5, 10]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBe(5);
      expect(previous[1]).toBeCloseTo(15);
    });

    it("모든 값이 NaN이면 previous가 변경되지 않는다", () => {
      const current = new Float32Array([NaN, NaN, NaN]);
      const previous = new Float32Array([1, 2, 3]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBe(1);
      expect(previous[1]).toBe(2);
      expect(previous[2]).toBe(3);
    });
  });

  // ── 길이 불일치 ──

  describe("길이 불일치 처리", () => {
    it("current가 previous보다 짧으면 current 길이만큼만 처리한다", () => {
      const current = new Float32Array([10]);
      const previous = new Float32Array([0, 0, 0]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBeCloseTo(5);
      expect(previous[1]).toBe(0); // 처리 안 됨
      expect(previous[2]).toBe(0); // 처리 안 됨
    });

    it("previous가 current보다 짧으면 previous 길이만큼만 처리한다", () => {
      const current = new Float32Array([10, 20, 30]);
      const previous = new Float32Array([0]);

      applyEMA(current, previous, 0.5);

      expect(previous[0]).toBeCloseTo(5);
      // current[1], [2]는 무시됨
    });

    it("빈 배열을 처리해도 에러가 발생하지 않는다", () => {
      const current = new Float32Array(0);
      const previous = new Float32Array(0);

      expect(() => applyEMA(current, previous, 0.5)).not.toThrow();
    });
  });
});
