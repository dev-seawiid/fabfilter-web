import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

// 테스트용 WAV 파일 생성 (지정 초, 44100Hz, 모노, 16bit)
function createTestWavFile(outputPath: string, durationSec = 1): void {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // WAV header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // 440Hz 사인파 생성
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, headerSize + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}

/** 헬퍼: 파일 업로드 후 디코딩 완료 대기 */
async function uploadAndWait(
  page: import("@playwright/test").Page,
  filePath: string,
) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
  // 노드 그래프에도 파일명이 표시되므로 FileUploader 버튼으로 특정
  await expect(
    page.getByRole("button", { name: path.basename(filePath) }),
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Playback Flow", () => {
  test.describe.configure({ mode: "serial" });

  const testAudioPath = path.join(__dirname, "test-audio.wav");
  const testAudio3sPath = path.join(__dirname, "test-audio-3s.wav");

  test.beforeAll(() => {
    createTestWavFile(testAudioPath, 1);
    createTestWavFile(testAudio3sPath, 3);
  });

  test.afterAll(() => {
    for (const p of [testAudioPath, testAudio3sPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  test("페이지 로드 시 파일 업로드 영역이 표시된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Drop audio file or/)).toBeVisible();
    await expect(page.getByText(".wav .mp3 .flac supported")).toBeVisible();
  });

  test("Play 버튼이 초기에 비활성화되어 있다", async ({ page }) => {
    await page.goto("/");
    const playBtn = page.getByRole("button", { name: "Play" });
    await expect(playBtn).toBeDisabled();
  });

  test("오디오 파일 업로드 → 디코딩 → 컨트롤 활성화", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    const playBtn = page.getByRole("button", { name: "Play" });
    await expect(playBtn).toBeEnabled();
  });

  test("재생 → 정지 → 재생 흐름", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생
    await page.getByRole("button", { name: "Play" }).click();

    // Pause 버튼으로 전환 확인
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // 정지
    await page.getByRole("button", { name: "Pause" }).click();

    // Play 버튼으로 복귀
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("타임라인 클릭으로 실제 Seeking", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudio3sPath);

    // 초기 시간 0:00
    const timeDisplay = page.locator(".text-right.tabular-nums").first();
    await expect(timeDisplay).toHaveText("0:00");

    // 타임라인 트랙 요소 — bg-surface-700 클래스의 진행 바 컨테이너
    const track = page.locator(".cursor-pointer.rounded-full").first();
    const box = await track.boundingBox();
    expect(box).not.toBeNull();

    // 타임라인의 중간 지점(50%) 클릭 → 3초 파일의 ~1.5초로 seek
    if (!box) throw new Error("Track bounding box not found");
    await track.click({
      position: { x: box.width * 0.5, y: box.height / 2 },
    });

    // seek 후 시간이 0:00이 아닌 값으로 변해야 한다
    await expect(timeDisplay).not.toHaveText("0:00");
  });

  test("재생 완료 후 Playhead가 처음으로 돌아간다 (FR-013)", async ({
    page,
  }) => {
    await page.goto("/");
    // 1초짜리 파일 사용 — 빠르게 재생 완료됨
    await uploadAndWait(page, testAudioPath);

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // 재생 완료 대기 — Play 버튼이 다시 나타남 (1초 파일이므로 ~1.5초면 충분)
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({
      timeout: 5000,
    });

    // 시간이 0:00으로 리셋
    const timeDisplay = page.locator(".text-right.tabular-nums").first();
    await expect(timeDisplay).toHaveText("0:00");
  });

  test("새 파일 업로드 시 이전 상태가 리셋된다 (FR-002)", async ({ page }) => {
    await page.goto("/");

    // 3초 파일 업로드 후 중간으로 seek
    await uploadAndWait(page, testAudio3sPath);
    const track = page.locator(".cursor-pointer.rounded-full").first();
    const box = await track.boundingBox();
    if (box) {
      await track.click({
        position: { x: box.width * 0.5, y: box.height / 2 },
      });
    }

    // 재업로드 (1초 파일)
    const reuploadInput = page.locator('input[type="file"]').first();
    await reuploadInput.setInputFiles(testAudioPath);
    await expect(
      page.getByRole("button", { name: "test-audio.wav" }),
    ).toBeVisible({ timeout: 5000 });

    // 상태 리셋 확인 — Play 버튼 활성화, 시간 0:00
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled();
    const timeDisplay = page.locator(".text-right.tabular-nums").first();
    await expect(timeDisplay).toHaveText("0:00");
  });
});
