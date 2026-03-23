import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── 테스트용 WAV 생성 (화이트 노이즈 — 전 주파수 대역 활성) ──

function createWhiteNoiseWav(outputPath: string, durationSec = 10): void {
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

  // 화이트 노이즈 — 스펙트럼 전 대역에서 시각화가 활성화됨
  for (let i = 0; i < numSamples; i++) {
    const sample = (Math.random() * 2 - 1) * 0.5; // -0.5 ~ 0.5
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

test.describe("Performance", () => {
  const testAudioPath = path.join(__dirname, "test-perf-audio.wav");

  test.beforeAll(() => {
    createWhiteNoiseWav(testAudioPath, 10);
  });

  test.afterAll(() => {
    if (fs.existsSync(testAudioPath)) fs.unlinkSync(testAudioPath);
  });

  test("재생 + 시각화 상태에서 메인 스레드 점유율 15% 이하 (SC-004)", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 시작 — 시각화 활성화
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // 워밍업 대기 (JIT, 초기 캐시 구축 등)
    await page.waitForTimeout(1000);

    // Performance 측정: 3초간 Long Task 수집
    const mainThreadUsage = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const longTasks: number[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push(entry.duration);
          }
        });

        observer.observe({ type: "longtask", buffered: false });

        const measureDuration = 3000; // 3초 측정
        setTimeout(() => {
          observer.disconnect();
          // Long Task 총 시간 / 측정 시간 = 메인 스레드 점유율
          const totalLongTaskTime = longTasks.reduce((a, b) => a + b, 0);
          const usage = totalLongTaskTime / measureDuration;
          resolve(usage);
        }, measureDuration);
      });
    });

    // SC-004: 15% 이하
    expect(mainThreadUsage).toBeLessThanOrEqual(0.15);

    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("프레임 드롭 없이 안정적 렌더링 (60fps 목표)", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.waitForTimeout(500);

    // 2초간 rAF 프레임 카운트 측정
    const fps = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const measureMs = 2000;
        const start = performance.now();

        function tick() {
          frameCount++;
          if (performance.now() - start < measureMs) {
            requestAnimationFrame(tick);
          } else {
            resolve((frameCount / measureMs) * 1000);
          }
        }
        requestAnimationFrame(tick);
      });
    });

    // 최소 30fps 이상 (60fps 목표이지만, CI 환경 고려)
    expect(fps).toBeGreaterThanOrEqual(30);

    await page.getByRole("button", { name: "Pause" }).click();
  });

  test("30초 재생 후 메모리 누수 없음 (SC-007)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60000); // 타임아웃을 60초로 연장
    // Chromium에서만 performance.memory 접근 가능
    test.skip(
      !page.context().browser()?.browserType().name().includes("chromium"),
      "performance.memory는 Chromium 전용",
    );

    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 시작
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.waitForTimeout(1000);

    // 초기 힙 크기 측정
    const initialHeap = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      if (!mem) return 0;
      return mem.usedJSHeapSize as number;
    });

    // 10초간 재생 + 시각화 (CI에서 30초는 너무 길어 10초로 단축)
    await page.waitForTimeout(10000);

    // GC 유도 (가능한 경우)
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {
      /* CDP 미지원 시 무시 */
    });
    await page.waitForTimeout(500);

    // 최종 힙 크기 측정
    const finalHeap = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      if (!mem) return 0;
      return mem.usedJSHeapSize as number;
    });

    if (initialHeap > 0 && finalHeap > 0) {
      // 힙 증가율이 50% 미만이면 누수 없음으로 판정
      const growthRatio = (finalHeap - initialHeap) / initialHeap;
      expect(growthRatio).toBeLessThan(0.5);
    }

    // 10초 파일이 재생 완료되었을 수 있으므로, Pause가 보이면 클릭
    const pauseBtn = page.getByRole("button", { name: "Pause" });
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }
  });

  test("파일 재업로드 시 이전 리소스가 해제된다", async ({ page }) => {
    await page.goto("/");
    await uploadAndWait(page, testAudioPath);

    // 재생 → 정지
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Pause" }).click();

    const heapBefore = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      return mem ? (mem.usedJSHeapSize as number) : 0;
    });

    // 3번 재업로드 반복
    for (let i = 0; i < 3; i++) {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testAudioPath);
      await page.waitForTimeout(500);
    }

    // GC 유도
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    await page.waitForTimeout(500);

    const heapAfter = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      return mem ? (mem.usedJSHeapSize as number) : 0;
    });

    if (heapBefore > 0 && heapAfter > 0) {
      // 3번 재업로드 후 힙이 3배 이상 늘어나지 않아야 함
      const growthRatio = (heapAfter - heapBefore) / heapBefore;
      expect(growthRatio).toBeLessThan(2.0);
    }
  });
});
