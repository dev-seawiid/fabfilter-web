# Chrome DevTools MCP를 활용한 Performance 테스트 가이드

이 문서는 Claude Code의 Chrome DevTools MCP 플러그인을 사용하여 FabFilter Web의 실시간 오디오 시각화 성능을 자동 측정하는 방법을 설명합니다.

## 사전 준비

### 1. MCP 플러그인 설치 및 활성화

```bash
# Claude Code에서 실행
/install-plugin chrome-devtools-mcp
/reload-plugins
```

### 2. 개발 서버 실행

```bash
# 개발 모드
pnpm dev

# 또는 프로덕션 빌드 (정확한 성능 측정 시)
pnpm build && pnpm start
```

서버가 `http://localhost:3000`에서 실행 중이어야 합니다.

## 테스트 절차

### Step 1. 테스트용 WAV 파일 생성

화이트 노이즈는 전 주파수 대역이 활성화되어 스펙트럼 시각화의 최대 부하를 테스트할 수 있습니다. `e2e/helpers/create-test-wav.ts`에 공통 유틸이 있으므로 Node.js에서 직접 호출할 수 있습니다.

```bash
# 30초 화이트 노이즈 WAV 생성 (공통 유틸 사용)
npx tsx -e "
import { createWhiteNoiseWav } from './e2e/helpers/create-test-wav';
createWhiteNoiseWav('/private/tmp/claude/test-perf.wav', 30);
console.log('Created 30s white noise WAV');
"
```

### Step 2. 페이지 이동 및 파일 업로드

```
# MCP 도구 호출 순서

1. navigate_page → url: "http://localhost:3000"
2. take_snapshot → file input 또는 "browse" 텍스트의 uid 확인
3. upload_file → uid: (browse 텍스트의 uid), filePath: "/private/tmp/claude/test-perf.wav"
```

### Step 3. 재생 + 퍼포먼스 측정

`evaluate_script`로 Play 클릭 → 측정을 한 번에 실행합니다.

#### 테스트 A: 재생만 (기본 성능)

```javascript
// evaluate_script에 전달할 함수
async () => {
  // Play
  const playBtn = document.querySelector('button[aria-label="Play"]')
    || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Play');
  if (playBtn) playBtn.click();
  await new Promise(r => setTimeout(r, 500));

  const memStart = performance.memory ? performance.memory.usedJSHeapSize : 0;

  // Long Task
  const longTasks = [];
  const ltObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  });
  ltObserver.observe({ type: 'longtask', buffered: false });

  // FPS
  let frameCount = 0;
  const fpsStart = performance.now();
  let measuring = true;
  function tick() { frameCount++; if (measuring) requestAnimationFrame(tick); }
  requestAnimationFrame(tick);

  // 3초 대기
  await new Promise(r => setTimeout(r, 3000));

  measuring = false;
  ltObserver.disconnect();
  const memEnd = performance.memory ? performance.memory.usedJSHeapSize : 0;

  return {
    longTask: { count: longTasks.length, totalMs: Math.round(longTasks.reduce((a, b) => a + b, 0)) },
    fps: { fps: Math.round(frameCount / 3 * 10) / 10, frames: frameCount },
    memory: {
      startMB: Math.round(memStart / 1024 / 1024 * 10) / 10,
      endMB: Math.round(memEnd / 1024 / 1024 * 10) / 10,
      growthMB: Math.round((memEnd - memStart) / 1024 / 1024 * 10) / 10,
    },
  };
}
```

#### 테스트 B: 재생 + 노브 조작 (인터랙션 포함 성능)

```javascript
// evaluate_script에 전달할 함수
async () => {
  // Play
  const playBtn = document.querySelector('button[aria-label="Play"]')
    || Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Play');
  if (playBtn) playBtn.click();
  await new Promise(r => setTimeout(r, 500));

  const memStart = performance.memory ? performance.memory.usedJSHeapSize : 0;

  // Long Task
  const longTasks = [];
  const ltObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  });
  ltObserver.observe({ type: 'longtask', buffered: false });

  // FPS
  let frameCount = 0;
  const fpsStart = performance.now();
  let measuring = true;
  function tick() { frameCount++; if (measuring) requestAnimationFrame(tick); }
  requestAnimationFrame(tick);

  // 5초간 Cutoff 노브 키보드 조작 (50ms 간격, 100회)
  const cutoffSlider = document.querySelector('[aria-label="Cutoff"]');
  if (cutoffSlider) {
    cutoffSlider.focus();
    await new Promise(resolve => {
      let count = 0;
      let goingUp = true;
      const interval = setInterval(() => {
        const key = goingUp ? 'ArrowUp' : 'ArrowDown';
        cutoffSlider.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
        count++;
        if (count % 50 === 0) goingUp = !goingUp;
        if (count >= 100) { clearInterval(interval); resolve(undefined); }
      }, 50);
    });
  }

  measuring = false;
  ltObserver.disconnect();
  const memEnd = performance.memory ? performance.memory.usedJSHeapSize : 0;
  const elapsed = (performance.now() - fpsStart) / 1000;

  return {
    longTask: { count: longTasks.length, totalMs: Math.round(longTasks.reduce((a, b) => a + b, 0)) },
    fps: { fps: Math.round(frameCount / elapsed * 10) / 10, frames: frameCount, durationSec: Math.round(elapsed * 10) / 10 },
    memory: {
      startMB: Math.round(memStart / 1024 / 1024 * 10) / 10,
      endMB: Math.round(memEnd / 1024 / 1024 * 10) / 10,
      growthMB: Math.round((memEnd - memStart) / 1024 / 1024 * 10) / 10,
    },
    cutoffAfter: cutoffSlider ? cutoffSlider.getAttribute('aria-valuenow') : 'N/A',
  };
}
```

## 성능 기준 (Performance Budget)

| 지표 | 기준 | 설명 |
|------|------|------|
| **Long Task** | 0개 | 50ms 이상 메인 스레드 점유 작업이 없어야 함 |
| **FPS** | ≥ 59fps | 60fps 목표, 59 이상이면 양호 |
| **Heap 증가 (재생만)** | < 0.5MB / 3초 | 재생만 할 때 Heap이 거의 증가하지 않아야 함 |
| **Heap 증가 (노브 조작)** | < 3MB / 5초 | Zustand 상태 업데이트로 인한 일시적 증가는 허용 |

## 결과 해석

### 좋은 결과 예시

```json
{
  "longTask": { "count": 0, "totalMs": 0 },
  "fps": { "fps": 60.7, "frames": 182 },
  "memory": { "startMB": 15.8, "endMB": 15.8, "growthMB": 0 }
}
```

- Long Task 0개: 메인 스레드가 블로킹되지 않음
- FPS 60+: 프레임 드롭 없음
- Heap 증가 0MB: 메모리 누수 없음

### 나쁜 결과 예시 및 원인

```json
{
  "longTask": { "count": 3, "totalMs": 250 },
  "fps": { "fps": 45.2, "frames": 136 },
  "memory": { "startMB": 15.0, "endMB": 35.0, "growthMB": 20 }
}
```

- Long Task 3개: 무거운 연산이 메인 스레드를 블로킹 → `useEffect`에서 Canvas 드로잉하고 있지 않은지 확인
- FPS 45: 프레임 드롭 발생 → rAF 콜백 안에서 불필요한 객체 할당 확인
- Heap 20MB 증가: 메모리 누수 → `useSyncExternalStore`를 통한 React 리렌더링이 60fps로 발생하고 있지 않은지 확인

## 주의사항

- **프로덕션 빌드에서 측정**: 개발 모드는 React StrictMode, HMR 등 오버헤드가 있어 정확하지 않음
- **브라우저 확장 프로그램 비활성화**: React DevTools 등이 Scripting 시간에 영향을 줌
- **`performance.memory`는 Chromium 전용**: MCP 브라우저(Chromium 기반)에서는 동작하지만, Firefox/Safari에서는 사용 불가
- **화이트 노이즈 사용**: 사인파(440Hz)는 FFT 스펙트럼이 일정하여 "Canvas가 업데이트되는지" 검증에 부적합
- **파일 길이**: 측정 시간보다 긴 파일을 사용해야 함 (5초 측정이면 최소 10초 파일)
- **MCP 브라우저는 headless**: 실제 사용자 환경과 약간 다를 수 있으므로, 중요한 측정은 Chrome DevTools Performance 탭에서도 교차 검증

## 관련 파일

- `e2e/performance.spec.ts` — Playwright E2E 성능 테스트 (CI 자동 검증)
- `e2e/visualization.spec.ts` — 스펙트럼 실시간 업데이트 검증
- `docs/review/009-spectrum-renderer-refactor-audit.md` — 성능 리팩토링 이력
