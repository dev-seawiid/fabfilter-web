import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileUploader from "../FileUploader";
import { useAudioStore } from "@/store/useAudioStore";

vi.mock("framer-motion", () => import("@/__mocks__/framer-motion"));

describe("FileUploader", () => {
  beforeEach(() => {
    useAudioStore.setState({
      playbackState: "idle",
      isLoading: false,
      error: null,
      fileMetadata: null,
    });
  });

  it("초기 상태에서 드롭 영역이 표시된다", () => {
    render(<FileUploader />);

    expect(screen.getByText(/Drop audio file or/)).toBeInTheDocument();
    expect(screen.getByText(".wav .mp3 .flac supported")).toBeInTheDocument();
  });

  it("파일 선택 시 loadFile이 호출된다", async () => {
    const loadFileMock = vi.fn();
    useAudioStore.setState({ loadFile: loadFileMock });
    const user = userEvent.setup();

    render(<FileUploader />);

    const file = new File(["audio content"], "test.wav", {
      type: "audio/wav",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    await user.upload(input, file);

    expect(loadFileMock).toHaveBeenCalledOnce();
    expect(loadFileMock).toHaveBeenCalledWith(file);
  });

  it("로딩 상태에서 Decoding 텍스트가 표시된다", () => {
    useAudioStore.setState({ isLoading: true });
    render(<FileUploader />);

    expect(screen.getByText("Decoding...")).toBeInTheDocument();
  });

  it("에러 상태에서 에러 메시지가 표시된다", () => {
    useAudioStore.setState({ error: "Unsupported format" });
    render(<FileUploader />);

    expect(screen.getByText("Unsupported format")).toBeInTheDocument();
  });

  it("파일 로드 후 컴팩트 뷰로 전환된다 (파일명 표시)", () => {
    useAudioStore.setState({
      playbackState: "stopped",
      fileMetadata: {
        name: "track.mp3",
        size: 1024,
        type: "audio/mpeg",
        duration: 180,
        sampleRate: 44100,
        numberOfChannels: 2,
      },
    });

    render(<FileUploader />);

    expect(screen.getByText("track.mp3")).toBeInTheDocument();
    expect(screen.queryByText(/Drop audio file/)).not.toBeInTheDocument();
  });

  it("input의 accept 속성이 오디오 포맷을 허용한다", () => {
    render(<FileUploader />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toContain("audio/wav");
    expect(input.accept).toContain("audio/mpeg");
    expect(input.accept).toContain("audio/flac");
  });
});
