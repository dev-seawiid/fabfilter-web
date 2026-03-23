import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import FilterNode from "../nodes/FilterNode";
import { useAudioStore } from "@/store/useAudioStore";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

// React Flow Handle을 mock — ReactFlowProvider 없이 렌더링하기 위함
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

describe("FilterNode", () => {
  // ── 기본 렌더링 ──

  describe("기본 렌더링", () => {
    it("Filter 라벨이 표시된다", () => {
      render(<FilterNode />);
      expect(screen.getByText("Filter")).toBeInTheDocument();
    });

    it("Highpass 타입이 표시된다", () => {
      render(<FilterNode />);
      expect(screen.getByText("Highpass")).toBeInTheDocument();
    });

    it("기본 cutoff 0Hz가 표시된다", () => {
      render(<FilterNode />);
      expect(screen.getByText("0Hz")).toBeInTheDocument();
    });

    it("기본 Q (Butterworth 0.71)이 표시된다", () => {
      render(<FilterNode />);
      expect(screen.getByText("0.71")).toBeInTheDocument();
    });
  });

  // ── 스토어 변경 시 실시간 업데이트 ──

  describe("cutoffHz 변경 시 값 업데이트", () => {
    it("cutoffHz를 500으로 변경하면 '500Hz'가 표시된다", () => {
      render(<FilterNode />);

      act(() => {
        useAudioStore.setState({
          filterParams: { cutoffHz: 500, q: Math.SQRT1_2, gain: 1 },
        });
      });

      expect(screen.getByText("500Hz")).toBeInTheDocument();
    });

    it("cutoffHz를 1500으로 변경하면 '1.5kHz'가 표시된다", () => {
      render(<FilterNode />);

      act(() => {
        useAudioStore.setState({
          filterParams: { cutoffHz: 1500, q: Math.SQRT1_2, gain: 1 },
        });
      });

      expect(screen.getByText("1.5kHz")).toBeInTheDocument();
    });

    it("cutoffHz를 20000으로 변경하면 '20.0kHz'가 표시된다", () => {
      render(<FilterNode />);

      act(() => {
        useAudioStore.setState({
          filterParams: { cutoffHz: 20000, q: Math.SQRT1_2, gain: 1 },
        });
      });

      expect(screen.getByText("20.0kHz")).toBeInTheDocument();
    });
  });

  describe("Q 변경 시 값 업데이트", () => {
    it("Q를 5.00으로 변경하면 '5.00'이 표시된다", () => {
      render(<FilterNode />);

      act(() => {
        useAudioStore.setState({
          filterParams: { cutoffHz: 0, q: 5, gain: 1 },
        });
      });

      expect(screen.getByText("5.00")).toBeInTheDocument();
    });

    it("Q를 0.10으로 변경하면 '0.10'이 표시된다", () => {
      render(<FilterNode />);

      act(() => {
        useAudioStore.setState({
          filterParams: { cutoffHz: 0, q: 0.1, gain: 1 },
        });
      });

      expect(screen.getByText("0.10")).toBeInTheDocument();
    });
  });

  // ── React Flow Handle 검증 ──

  describe("핸들", () => {
    it("입력(target) 핸들이 렌더링된다", () => {
      render(<FilterNode />);
      expect(screen.getByTestId("handle-target")).toBeInTheDocument();
    });

    it("출력(source) 핸들이 렌더링된다", () => {
      render(<FilterNode />);
      expect(screen.getByTestId("handle-source")).toBeInTheDocument();
    });
  });
});
