import fs from "fs";

/**
 * WAV 파일의 44-byte 헤더를 작성한다.
 */
function writeWavHeader(
  buffer: Buffer,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  dataSize: number,
): void {
  const headerSize = 44;
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
}

/**
 * 사인파 WAV 파일을 생성한다.
 *
 * @param outputPath - 저장 경로
 * @param frequency - 주파수 (Hz). 기본값 440
 * @param durationSec - 길이 (초). 기본값 3
 */
export function createSineWav(
  outputPath: string,
  frequency = 440,
  durationSec = 3,
): void {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataSize);
  writeWavHeader(buffer, sampleRate, numChannels, bitsPerSample, dataSize);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}

/**
 * 화이트 노이즈 WAV 파일을 생성한다.
 * 전 주파수 대역이 활성화되어 스펙트럼 시각화의 최대 부하를 테스트할 수 있다.
 *
 * @param outputPath - 저장 경로
 * @param durationSec - 길이 (초). 기본값 10
 */
export function createWhiteNoiseWav(
  outputPath: string,
  durationSec = 10,
): void {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataSize);
  writeWavHeader(buffer, sampleRate, numChannels, bitsPerSample, dataSize);

  for (let i = 0; i < numSamples; i++) {
    const sample = (Math.random() * 2 - 1) * 0.5;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}
