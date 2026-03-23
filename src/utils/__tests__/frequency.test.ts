import { describe, it, expect } from "vitest";
import {
  hzToLogX,
  dbToY,
  createLogFrequencyArray,
  binToHz,
} from "../frequency";

describe("hzToLogX", () => {
  const width = 1000;

  it("20Hz가 X=0에 매핑된다 (최소 주파수)", () => {
    expect(hzToLogX(20, width)).toBe(0);
  });

  it("20000Hz가 X=width에 매핑된다 (최대 주파수)", () => {
    expect(hzToLogX(20000, width)).toBeCloseTo(width, 5);
  });

  it("로그 중간값(~632Hz)이 X=width/2에 매핑된다", () => {
    // log10(20)=1.301, log10(20000)=4.301 → 중간=2.801 → 10^2.801 ≈ 632Hz
    const midHz = Math.pow(10, (Math.log10(20) + Math.log10(20000)) / 2);
    expect(hzToLogX(midHz, width)).toBeCloseTo(width / 2, 0);
  });

  it("1000Hz가 올바른 로그 위치에 매핑된다", () => {
    // log10(1000)=3, range=(4.301-1.301)=3 → (3-1.301)/3 ≈ 0.566
    const expected =
      ((Math.log10(1000) - Math.log10(20)) /
        (Math.log10(20000) - Math.log10(20))) *
      width;
    expect(hzToLogX(1000, width)).toBeCloseTo(expected, 5);
  });

  it("20Hz 미만 값은 20Hz로 클램핑된다 (X=0)", () => {
    expect(hzToLogX(1, width)).toBe(0);
    expect(hzToLogX(0.001, width)).toBe(0);
  });

  it("20000Hz 초과 값은 20000Hz로 클램핑된다 (X=width)", () => {
    expect(hzToLogX(30000, width)).toBeCloseTo(width, 5);
  });

  it("커스텀 minHz/maxHz를 지원한다", () => {
    expect(hzToLogX(100, 500, 100, 10000)).toBe(0);
    expect(hzToLogX(10000, 500, 100, 10000)).toBeCloseTo(500, 5);
  });

  it("width=0이면 항상 0을 반환한다", () => {
    expect(hzToLogX(1000, 0)).toBe(0);
  });
});

describe("dbToY", () => {
  const height = 600;

  it("0dB이 Y=0에 매핑된다 (상단, maxDb 기본값)", () => {
    expect(dbToY(0, height)).toBe(0);
  });

  it("-100dB이 Y=height에 매핑된다 (하단, minDb 기본값)", () => {
    expect(dbToY(-100, height)).toBeCloseTo(height, 5);
  });

  it("-50dB이 Y=height/2에 매핑된다 (기본 범위 중간)", () => {
    expect(dbToY(-50, height)).toBeCloseTo(height / 2, 5);
  });

  it("minDb 미만 값은 minDb로 클램핑된다", () => {
    expect(dbToY(-200, height)).toBeCloseTo(height, 5);
  });

  it("maxDb 초과 값은 maxDb로 클램핑된다", () => {
    expect(dbToY(10, height)).toBe(0);
  });

  it("커스텀 minDb/maxDb를 지원한다", () => {
    // -30dB~+30dB 범위 (SpectrumCanvas에서 사용)
    expect(dbToY(30, height, -30, 30)).toBe(0);
    expect(dbToY(-30, height, -30, 30)).toBeCloseTo(height, 5);
    expect(dbToY(0, height, -30, 30)).toBeCloseTo(height / 2, 5);
  });

  it("height=0이면 항상 0을 반환한다", () => {
    expect(dbToY(-50, 0)).toBe(0);
  });
});

describe("createLogFrequencyArray", () => {
  it("기본값으로 512개 요소를 생성한다", () => {
    const arr = createLogFrequencyArray();
    expect(arr.length).toBe(512);
  });

  it("첫 번째 요소가 startHz(20)이다", () => {
    const arr = createLogFrequencyArray();
    expect(arr[0]).toBeCloseTo(20, 1);
  });

  it("마지막 요소가 endHz(20000)이다", () => {
    const arr = createLogFrequencyArray();
    expect(arr[arr.length - 1]).toBeCloseTo(20000, 0);
  });

  it("배열이 단조 증가한다", () => {
    const arr = createLogFrequencyArray();
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThan(arr[i - 1]);
    }
  });

  it("로그 분포를 따른다 (저주파 구간이 더 밀집)", () => {
    const arr = createLogFrequencyArray(20, 20000, 100);

    // 처음 절반의 주파수 범위가 뒤 절반보다 좁아야 한다 (로그 스케일)
    const midIdx = Math.floor(arr.length / 2);
    const firstHalfRange = arr[midIdx] - arr[0];
    const secondHalfRange = arr[arr.length - 1] - arr[midIdx];

    expect(firstHalfRange).toBeLessThan(secondHalfRange);
  });

  it("커스텀 범위와 개수를 지원한다", () => {
    const arr = createLogFrequencyArray(100, 10000, 256);
    expect(arr.length).toBe(256);
    expect(arr[0]).toBeCloseTo(100, 1);
    expect(arr[arr.length - 1]).toBeCloseTo(10000, 0);
  });

  it("Float32Array를 반환한다", () => {
    const arr = createLogFrequencyArray();
    expect(arr).toBeInstanceOf(Float32Array);
  });

  it("count=1이면 startHz를 반환한다", () => {
    const arr = createLogFrequencyArray(20, 20000, 1);
    expect(arr.length).toBe(1);
    expect(arr[0]).toBeCloseTo(20, 1);
  });
});

describe("binToHz", () => {
  it("bin 0이 0Hz이다", () => {
    expect(binToHz(0, 44100, 2048)).toBe(0);
  });

  it("bin 1이 sampleRate/fftSize Hz이다", () => {
    expect(binToHz(1, 44100, 2048)).toBeCloseTo(44100 / 2048, 5);
  });

  it("Nyquist bin이 sampleRate/2이다", () => {
    // Nyquist bin = fftSize / 2
    const nyquistBin = 2048 / 2;
    expect(binToHz(nyquistBin, 44100, 2048)).toBeCloseTo(44100 / 2, 5);
  });

  it("48kHz 샘플레이트에서 올바르게 계산된다", () => {
    expect(binToHz(10, 48000, 4096)).toBeCloseTo(10 * (48000 / 4096), 5);
  });

  it("정수가 아닌 결과도 정확히 반환한다", () => {
    const result = binToHz(3, 44100, 2048);
    expect(result).toBeCloseTo((3 * 44100) / 2048, 5);
  });
});
