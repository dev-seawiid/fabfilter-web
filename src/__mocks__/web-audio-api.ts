/**
 * Web Audio API Mock — jsdom에 없는 AudioContext 등을 테스트용으로 제공
 *
 * 각 노드의 connect/disconnect 호출을 추적하여
 * Constitution I의 노드 연결 순서를 검증할 수 있다.
 */

export const connectCalls: Array<{ from: string; to: string }> = [];
export const disconnectCalls: string[] = [];

function resetTracking() {
  connectCalls.length = 0;
  disconnectCalls.length = 0;
}

function createMockNode(name: string) {
  return {
    _name: name,
    connect: vi.fn((target: { _name?: string }) => {
      connectCalls.push({ from: name, to: target._name ?? "unknown" });
      return target;
    }),
    disconnect: vi.fn(() => {
      disconnectCalls.push(name);
    }),
  };
}

function createMockAnalyserNode(name: string) {
  return {
    ...createMockNode(name),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatFrequencyData: vi.fn(),
    getByteFrequencyData: vi.fn(),
  };
}

function createMockBiquadFilterNode() {
  return {
    ...createMockNode("BiquadFilter"),
    type: "lowpass" as BiquadFilterType,
    frequency: { value: 350, setTargetAtTime: vi.fn() },
    Q: { value: 1, setTargetAtTime: vi.fn() },
    getFrequencyResponse: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    ...createMockNode("Gain"),
    gain: { value: 1, setTargetAtTime: vi.fn() },
  };
}

function createMockSourceNode() {
  return {
    ...createMockNode("BufferSource"),
    buffer: null as AudioBuffer | null,
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
    playbackRate: { value: 1 },
  };
}

export function createMockAudioBuffer(
  duration = 10,
  sampleRate = 44100,
  numberOfChannels = 2,
): AudioBuffer {
  return {
    duration,
    sampleRate,
    numberOfChannels,
    length: Math.floor(duration * sampleRate),
    getChannelData: vi.fn(
      () => new Float32Array(Math.floor(duration * sampleRate)),
    ),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

export class MockAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = createMockNode("Destination");

  resume = vi.fn(async () => {
    this.state = "running";
  });

  close = vi.fn(async () => {
    this.state = "closed";
  });

  createAnalyser = vi.fn(() => {
    const count = this.createAnalyser.mock.calls.length;
    return createMockAnalyserNode(count <= 1 ? "AnalyserPre" : "AnalyserPost");
  });

  createBiquadFilter = vi.fn(() => createMockBiquadFilterNode());
  createGain = vi.fn(() => createMockGainNode());

  createBufferSource = vi.fn(() => createMockSourceNode());

  decodeAudioData = vi.fn(async () => createMockAudioBuffer());
}

export function setupWebAudioMock() {
  resetTracking();
  vi.stubGlobal("AudioContext", MockAudioContext);
}

export function teardownWebAudioMock() {
  resetTracking();
  vi.unstubAllGlobals();
}
