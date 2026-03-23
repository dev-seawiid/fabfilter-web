import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import SourceNode from "../nodes/SourceNode";
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
    playbackState: "stopped",
    fileMetadata: {
      name: "test.wav",
      size: 100,
      type: "audio/wav",
      duration: 3,
      sampleRate: 44100,
      numberOfChannels: 2,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SourceNode", () => {
  // ── 상태 아이콘 전환 ──

  it("stopped 상태에서 ■ 아이콘이 표시된다", () => {
    render(<SourceNode />);
    expect(screen.getByText("■ stopped")).toBeInTheDocument();
  });

  it("playing 상태에서 ▶ 아이콘이 표시된다", () => {
    render(<SourceNode />);

    act(() => {
      useAudioStore.setState({ playbackState: "playing" });
    });

    expect(screen.getByText("▶ playing")).toBeInTheDocument();
  });

  it("idle 상태에서 ○ 아이콘이 표시된다", () => {
    render(<SourceNode />);

    act(() => {
      useAudioStore.setState({ playbackState: "idle" });
    });

    expect(screen.getByText("○ idle")).toBeInTheDocument();
  });

  // ── 파일명 표시 ──

  it("파일명이 표시된다", () => {
    render(<SourceNode />);
    expect(screen.getByText("test.wav")).toBeInTheDocument();
  });

  it("14자 초과 파일명은 잘린다", () => {
    render(<SourceNode />);

    act(() => {
      useAudioStore.setState({
        fileMetadata: {
          name: "very-long-filename-test.wav",
          size: 100,
          type: "audio/wav",
          duration: 3,
          sampleRate: 44100,
          numberOfChannels: 2,
        },
      });
    });

    expect(screen.getByText("very-long-fil…")).toBeInTheDocument();
  });

  it("파일이 없으면 — 가 표시된다", () => {
    render(<SourceNode />);

    act(() => {
      useAudioStore.setState({ fileMetadata: null });
    });

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
