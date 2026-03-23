import { useAudioStore } from "@/store/useAudioStore";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudioNodeGraph from "../AudioNodeGraph";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

// ── jsdom에 없는 API mock ──

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    })),
  );

  if (typeof DOMMatrixReadOnly === "undefined") {
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class DOMMatrixReadOnly {
        m22 = 1;
        constructor(init?: string | number[]) {
          if (Array.isArray(init) && init.length >= 6) {
            this.m22 = init[3] ?? 1;
          }
        }
        inverse() {
          return new DOMMatrixReadOnly();
        }
      },
    );
  }

  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 500,
  });

  useAudioStore.setState({
    playbackState: "stopped",
    fileMetadata: {
      name: "test.wav",
      size: 100,
      type: "audio/wav",
      duration: 3,
      sampleRate: 44100,
      numberOfChannels: 2,
    },
    filterParams: { cutoffHz: 0, q: Math.SQRT1_2, gain: 1 },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderGraph() {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 1000, height: 500 }}>
        <AudioNodeGraph />
      </div>
    </ReactFlowProvider>,
  );
}

describe("AudioNodeGraph", () => {
  // ── 노드 렌더링 검증 ──
  // CSS uppercase는 시각적 변환만 하므로 DOM 텍스트는 원본 casing

  describe("노드 6개 렌더링 (Constitution I)", () => {
    it("Source 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Source")).toBeInTheDocument();
    });

    it("Analyser (Pre) 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Analyser (Pre)")).toBeInTheDocument();
    });

    it("Filter 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Filter")).toBeInTheDocument();
    });

    it("Gain 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Gain")).toBeInTheDocument();
    });

    it("Analyser (Post) 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Analyser (Post)")).toBeInTheDocument();
    });

    it("Destination 노드가 렌더링된다", () => {
      renderGraph();
      expect(screen.getByText("Destination")).toBeInTheDocument();
    });
  });

  // ── 노드 내부 콘텐츠 검증 ──

  describe("노드 내부 콘텐츠", () => {
    it("Source 노드에 파일명이 표시된다", () => {
      renderGraph();
      expect(screen.getByText("test.wav")).toBeInTheDocument();
    });

    it("Source 노드에 playbackState가 표시된다", () => {
      renderGraph();
      expect(screen.getByText("■ stopped")).toBeInTheDocument();
    });

    it("Filter 노드에 Highpass 라벨이 표시된다", () => {
      renderGraph();
      expect(screen.getByText("Highpass")).toBeInTheDocument();
    });

    it("Gain 노드에 100%가 표시된다 (기본 gain=1)", () => {
      renderGraph();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("Destination 노드에 Speakers가 표시된다", () => {
      renderGraph();
      expect(screen.getByText("Speakers")).toBeInTheDocument();
    });

    it("Analyser Pre/Post 라벨이 표시된다", () => {
      renderGraph();
      expect(screen.getByText("Pre-EQ")).toBeInTheDocument();
      expect(screen.getByText("Post-EQ")).toBeInTheDocument();
    });
  });
});
