import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlaybackControls from "../PlaybackControls";
import { useAudioStore } from "@/store/useAudioStore";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

describe("PlaybackControls", () => {
  beforeEach(() => {
    useAudioStore.setState({
      playbackState: "idle",
      currentTime: 0,
      duration: 0,
      isLoading: false,
      error: null,
      fileMetadata: null,
    });
  });

  it("idle 상태에서 버튼이 비활성화된다", () => {
    render(<PlaybackControls />);

    const button = screen.getByRole("button", { name: "Play" });
    expect(button).toBeDisabled();
  });

  it("loading 상태에서 버튼이 비활성화된다", () => {
    useAudioStore.setState({ playbackState: "loading" });
    render(<PlaybackControls />);

    const button = screen.getByRole("button", { name: "Play" });
    expect(button).toBeDisabled();
  });

  it("stopped 상태에서 Play 버튼이 표시된다", () => {
    useAudioStore.setState({ playbackState: "stopped" });
    render(<PlaybackControls />);

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("playing 상태에서 Pause 버튼이 표시된다", () => {
    useAudioStore.setState({ playbackState: "playing" });
    render(<PlaybackControls />);

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("Play 버튼 클릭 시 play 액션이 호출된다", async () => {
    const playMock = vi.fn();
    useAudioStore.setState({ playbackState: "stopped", play: playMock });
    const user = userEvent.setup();

    render(<PlaybackControls />);
    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(playMock).toHaveBeenCalledOnce();
  });

  it("Pause 버튼 클릭 시 pause 액션이 호출된다", async () => {
    const pauseMock = vi.fn();
    useAudioStore.setState({ playbackState: "playing", pause: pauseMock });
    const user = userEvent.setup();

    render(<PlaybackControls />);
    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(pauseMock).toHaveBeenCalledOnce();
  });

  it("비활성화 상태에서 클릭해도 play가 호출되지 않는다", async () => {
    const playMock = vi.fn();
    useAudioStore.setState({ playbackState: "idle", play: playMock });
    const user = userEvent.setup();

    render(<PlaybackControls />);
    await user.click(screen.getByRole("button", { name: "Play" }));

    expect(playMock).not.toHaveBeenCalled();
  });
});
