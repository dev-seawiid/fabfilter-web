import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── 테스트용 WAV 생성 ──

function createTestWav(
  outputPath: string,
  frequency = 440,
  durationSec = 3,
): void {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 32767), headerSize + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}

async function uploadAndWait(
  page: import("@playwright/test").Page,
  filePath: string,
) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
  await expect(page.getByText(path.basename(filePath))).toBeVisible({
    timeout: 5000,
  });
}

/** Canvas의 비어있지 않은 픽셀 비율을 반환 (0~1) */
async function getCanvasFilledRatio(
  page: import("@playwright/test").Page,
): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const { width, height } = canvas;
    if (width === 0 || height === 0) return 0;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let filledPixels = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) filledPixels++;
    }
    return filledPixels / (width * height);
  });
}

/** Canvas의 pixel data snapshot을 반환 */
async function getCanvasSnapshot(
  page: import("@playwright/test").Page,
): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  });
}

test.describe("Visualization", () => {
  test.describe.configure({ mode: "serial" });

  const testAudioPath = path.join(__dirname, "test-viz-audio.wav");

  test.beforeAll(() => {
    createTestWav(testAudioPath, 440, 5);
  });

  test.afterAll(() => {
    if (fs.existsSync(testAudioPath)) fs.unlinkSync(testAudioPath);
  });

  test("Canvas 요소가 페이지에 존재한다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("idle 상태에서 FileUploader가 표시된다 (SpectrumCanvas는 미렌더링)", async ({
    page,
  }) => {
    await page.goto("/");

    // idle 상태에서는 SpectrumCanvas 대신 FileUploader가 표시됨 (AppShell 조건부 렌더링)
    await expect(page.getByText(/Drop audio file or/)).toBeVisible();
    // Canvas는 파일 업로드 후에만 렌더링됨
    await expect(page.locator("canvas")).not.toBeVisible();
  });

  test("파일 업로드 후 'Press play to visualize' 메시지가 표시된다", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    await expect(page.getByText("Press play to visualize")).toBeVisible();
  });

  test("재생 중 Canvas에 스펙트럼이 렌더링된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // Canvas 렌더링 안정화 대기 (rAF + EMA smoothing 수렴)
    await page.waitForTimeout(500);

    // Canvas에 무언가 그려졌는지 확인
    const filledRatio = await getCanvasFilledRatio(page);
    expect(filledRatio).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("재생 중 오버레이 메시지가 사라진다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // 오버레이가 없어야 함
    await expect(
      page.getByText("Press play to visualize"),
    ).not.toBeVisible();

    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("Cutoff 변경 시 Canvas 렌더링이 변화한다 (필터 커브)", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.waitForTimeout(500);

    // Cutoff=0 (필터 비활성) 상태의 Canvas 스냅샷
    const snapshotBefore = await getCanvasSnapshot(page);

    // Cutoff를 크게 올림
    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await cutoffKnob.focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Shift+ArrowUp");
    }

    // 렌더링 반영 대기
    await page.waitForTimeout(500);

    // Cutoff 적용 후 Canvas 스냅샷
    const snapshotAfter = await getCanvasSnapshot(page);

    // 두 스냅샷이 달라야 함 (필터 커브 + Post 스펙트럼 변화)
    expect(snapshotAfter).not.toBe(snapshotBefore);

    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("정지 후 오버레이가 다시 표시된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 → 정지
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();

    // 오버레이 복귀
    await expect(page.getByText("Press play to visualize")).toBeVisible();
  });

  test("Peak LED가 존재한다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // PeakLED의 텍스트 요소 확인
    const peakText = page.locator("text=PEAK").or(page.locator("text=dB"));
    // 적어도 하나의 Peak 관련 요소가 존재
    const peakElements = page.locator('[class*="tabular-nums"]');
    await expect(peakElements.first()).toBeVisible();
  });
});
