import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import GainNodeDisplay from "../nodes/GainNodeDisplay";
import { useAudioStore } from "@/store/useAudioStore";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => (
    <div data-testid={`handle-${type}`} />
  ),
  Position: { Left: "left", Right: "right" },
}));

beforeEach(() => {
  useAudioStore.setState({
    filterParams: { cutoffHz: 0, q: Math.SQRT1_2, gain: 1 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GainNodeDisplay", () => {
  // ── 기본 렌더링 ──

  it("Gain 라벨이 표시된다", () => {
    render(<GainNodeDisplay />);
    expect(screen.getByText("Gain")).toBeInTheDocument();
  });

  it("기본 gain=1일 때 100%가 표시된다", () => {
    render(<GainNodeDisplay />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("기본 gain=1일 때 0.0dB가 표시된다", () => {
    render(<GainNodeDisplay />);
    expect(screen.getByText("0.0dB")).toBeInTheDocument();
  });

  // ── gain 변경 시 실시간 업데이트 ──

  it("gain=0.5일 때 50%와 -6.0dB가 표시된다", () => {
    render(<GainNodeDisplay />);

    act(() => {
      useAudioStore.setState({
        filterParams: { cutoffHz: 0, q: Math.SQRT1_2, gain: 0.5 },
      });
    });

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("-6.0dB")).toBeInTheDocument();
  });

  it("gain=0일 때 0%와 -∞dB가 표시된다", () => {
    render(<GainNodeDisplay />);

    act(() => {
      useAudioStore.setState({
        filterParams: { cutoffHz: 0, q: Math.SQRT1_2, gain: 0 },
      });
    });

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("-∞dB")).toBeInTheDocument();
  });
});
