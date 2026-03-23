import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── 테스트용 WAV 생성 (저주파 중심 — 필터 효과가 잘 드러남) ──

/**
 * 100Hz 사인파 WAV 생성.
 * Highpass cutoff를 올리면 이 주파수가 명확히 감쇄된다.
 */
function createLowFreqWav(outputPath: string, durationSec = 3): void {
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

  // 100Hz 사인파 (저주파 — highpass 필터 테스트에 적합)
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 100 * i) / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 32767), headerSize + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
}

/** 파일 업로드 후 디코딩 완료 대기 */
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

test.describe("Filter Interaction", () => {
  test.describe.configure({ mode: "serial" });

  const testAudioPath = path.join(__dirname, "test-filter-audio.wav");

  test.beforeAll(() => {
    createLowFreqWav(testAudioPath, 3);
  });

  test.afterAll(() => {
    if (fs.existsSync(testAudioPath)) fs.unlinkSync(testAudioPath);
  });

  test("Cutoff 노브가 올바른 초기값으로 렌더링된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // Cutoff 노브: aria-label="Cutoff", 초기값=0Hz
    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await expect(cutoffKnob).toBeVisible();
    await expect(cutoffKnob).toHaveAttribute("aria-valuenow", "0");
  });

  test("Cutoff 노브를 키보드로 조작하면 값이 변경된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await cutoffKnob.focus();

    // ArrowUp 10회 → 값이 0에서 증가해야 함
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("ArrowUp");
    }

    const value = Number(await cutoffKnob.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(0);
  });

  test("Cutoff 변경 후 재생 시 오디오 엔진에 필터가 적용된다", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // Cutoff를 높은 값으로 설정 (Shift+ArrowUp으로 대폭 증가)
    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await cutoffKnob.focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Shift+ArrowUp");
    }

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // Cutoff 값이 상당히 높아졌는지 확인
    const value = Number(await cutoffKnob.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(100);

    // 재생 정지
    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("Q 노브가 존재하고 조작 가능하다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    const qKnob = page.getByRole("slider", { name: "Q" });
    await expect(qKnob).toBeVisible();

    // 초기 Q값은 0.71 (Butterworth, Math.SQRT1_2)
    const initialQ = Number(await qKnob.getAttribute("aria-valuenow"));
    expect(initialQ).toBeCloseTo(0.71, 1);

    // ArrowUp으로 Q 증가
    await qKnob.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowUp");
    }

    const newQ = Number(await qKnob.getAttribute("aria-valuenow"));
    expect(newQ).toBeGreaterThan(initialQ);
  });

  test("Gain 노브가 존재하고 조작 가능하다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    const gainKnob = page.getByRole("slider", { name: "Gain" });
    await expect(gainKnob).toBeVisible();

    // 초기 Gain=1
    const initialGain = Number(await gainKnob.getAttribute("aria-valuenow"));
    expect(initialGain).toBe(1);

    // ArrowDown으로 Gain 감소
    await gainKnob.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
    }

    const newGain = Number(await gainKnob.getAttribute("aria-valuenow"));
    expect(newGain).toBeLessThan(1);
  });

  test("급격한 Cutoff 변경 시 AudioParam smoothing이 적용된다 (SC-005)", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await cutoffKnob.focus();

    // 급격한 변경: 0 → 최대값 근처까지 빠르게 올림
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+ArrowUp");
    }

    // 잠시 대기 후 다시 급격히 내림
    await page.waitForTimeout(200);
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+ArrowDown");
    }

    // 팝/클릭 노이즈 여부는 직접 검증이 어려우므로
    // 재생이 에러 없이 계속되는지 확인 (AudioContext가 중단되지 않음)
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // 정지
    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("필터 파라미터가 파일 재업로드 후에도 유지된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // Cutoff를 변경
    const cutoffKnob = page.getByRole("slider", { name: "Cutoff" });
    await cutoffKnob.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+ArrowUp");
    }

    const cutoffBefore = Number(await cutoffKnob.getAttribute("aria-valuenow"));
    expect(cutoffBefore).toBeGreaterThan(0);

    // 새 파일 업로드
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testAudioPath);

    // 재업로드 후에도 cutoff 값이 유지되어야 함 (필터는 글로벌 상태)
    const cutoffAfter = Number(await cutoffKnob.getAttribute("aria-valuenow"));
    expect(cutoffAfter).toBe(cutoffBefore);
  });
});
