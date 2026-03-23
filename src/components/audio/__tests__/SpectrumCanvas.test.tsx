import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SpectrumCanvas from "../SpectrumCanvas";
import { useAudioStore } from "@/store/useAudioStore";

// ── Mocks ──

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

// useSpectrumData mock — 기본적으로 null 반환, 테스트별로 오버라이드
const mockSpectrumData = vi.fn().mockReturnValue(null);
vi.mock("@/hooks/useSpectrumData", () => ({
  useSpectrumData: () => mockSpectrumData(),
}));

// ResizeObserver mock (jsdom에 없음)
const observeMock = vi.fn();
const disconnectMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn().mockImplementation(() => ({
      observe: observeMock,
      disconnect: disconnectMock,
      unobserve: vi.fn(),
    })),
  );

  // HTMLCanvasElement.getContext mock (jsdom에서 canvas 미지원)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mockSpectrumData.mockReturnValue(null);
});

describe("SpectrumCanvas", () => {
  // ── Canvas 요소 ──

  describe("Canvas 렌더링", () => {
    it("canvas 요소가 렌더링된다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      const { container } = render(<SpectrumCanvas />);

      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("컨테이너 div가 렌더링된다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      const { container } = render(<SpectrumCanvas />);

      const wrapper = container.firstElementChild;
      expect(wrapper).toBeInTheDocument();
      expect(wrapper?.tagName).toBe("DIV");
    });
  });

  // ── 오버레이 상태 표시 ──

  describe("오버레이 메시지", () => {
    it("idle 상태에서 'Upload a file to begin' 메시지가 표시된다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      render(<SpectrumCanvas />);

      expect(screen.getByText("Upload a file to begin")).toBeInTheDocument();
    });

    it("stopped 상태에서 'Press play to visualize' 메시지가 표시된다", () => {
      useAudioStore.setState({ playbackState: "stopped" });
      render(<SpectrumCanvas />);

      expect(screen.getByText("Press play to visualize")).toBeInTheDocument();
    });

    it("loading 상태에서 'Press play to visualize' 메시지가 표시된다", () => {
      useAudioStore.setState({ playbackState: "loading" });
      render(<SpectrumCanvas />);

      expect(screen.getByText("Press play to visualize")).toBeInTheDocument();
    });

    it("playing 상태에서 오버레이가 표시되지 않는다", () => {
      useAudioStore.setState({ playbackState: "playing" });
      mockSpectrumData.mockReturnValue({
        preData: new Float32Array(1024),
        postData: new Float32Array(1024),
        postPeak: 0,
        binCount: 1024,
        sampleRate: 44100,
      });

      render(<SpectrumCanvas />);

      expect(screen.queryByText("Upload a file to begin")).not.toBeInTheDocument();
      expect(screen.queryByText("Press play to visualize")).not.toBeInTheDocument();
    });
  });

  // ── ResizeObserver ──

  describe("ResizeObserver", () => {
    it("마운트 시 ResizeObserver가 컨테이너를 관찰한다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      render(<SpectrumCanvas />);

      expect(observeMock).toHaveBeenCalledOnce();
    });

    it("언마운트 시 ResizeObserver가 disconnect된다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      const callsBefore = disconnectMock.mock.calls.length;
      const { unmount } = render(<SpectrumCanvas />);

      unmount();

      // 이전 테스트에서의 호출을 제외하고 현재 테스트에서 1회 호출 검증
      expect(disconnectMock.mock.calls.length - callsBefore).toBe(1);
    });
  });

  // ── Canvas getContext ──

  describe("Canvas 컨텍스트", () => {
    it("canvas에 getContext('2d')가 호출 가능하다", () => {
      useAudioStore.setState({ playbackState: "idle" });
      const { container } = render(<SpectrumCanvas />);

      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      expect(ctx).not.toBeNull();
    });
  });
});
