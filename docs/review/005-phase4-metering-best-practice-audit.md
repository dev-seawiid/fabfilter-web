# Review 005: Phase 4 Metering & Canvas Best Practice Audit

**Date**: 2026-03-20
**Scope**: PeakLED (볼륨 미터 + 클리핑 LED), usePeakDetector (레벨/클리핑 외부 스토어), SpectrumCanvas (logicalSizeRef, grid 캐시, freqX 캐시), AppShell (레이아웃), FilterControls (Q 노브 추가), Knob (LOG_FLOOR), 타입/엔진/스토어 Q 파라미터 추가
**Reference**: Vercel React Best Practices — `rerender-use-ref-transient-values`, `js-batch-dom-css`, `js-cache-function-results`, `client-event-listeners`, `advanced-event-handler-refs`, `rendering-hoist-jsx`, `rerender-defer-reads`, `rerender-memo-with-default-value`, `rerender-functional-setstate`, `rerender-derived-state`, `rendering-conditional-render`
**Status**: Complete

---

## 렌더링 분석

### PeakLED re-render 빈도

| 트리거 | 빈도 | 메커니즘 |
|--------|------|----------|
| `isClipping` 변경 | 클리핑 시작 시 1회, 리셋 시 1회 | `useSyncExternalStore(peakSubscribe)` |
| 볼륨 레벨 변경 | **re-render 0회** | `subscribeLevel` → `onLevel` 콜백 → ref 기반 DOM 직접 조작 |

**결론**: `rerender-use-ref-transient-values` 룰의 교과서적 구현.

### SpectrumCanvas re-render 빈도

| 트리거 | 빈도 | 메커니즘 |
|--------|------|----------|
| `spectrumData` 변경 | 60fps | `useSyncExternalStore` → `useEffect` → Canvas 2D 드로잉 |
| `playbackState` 변경 | 이산적 (play/pause/stop) | Zustand selector |

**결론**: 재생 중 60fps re-render는 불가피. 그리드 offscreen 캐시 + freqX 캐시로 매 프레임 연산 최소화.

### FilterControls re-render 빈도

| 트리거 | 빈도 | 메커니즘 |
|--------|------|----------|
| `cutoffHz` 변경 | 드래그 중 매 프레임 | `(s) => s.filterParams.cutoffHz` primitive selector |
| `q` 변경 | 드래그 중 매 프레임 | `(s) => s.filterParams.q` primitive selector |
| `gain` 변경 | 드래그 중 매 프레임 | `(s) => s.filterParams.gain` primitive selector |

**결론**: 각 selector가 primitive를 추출하므로, Cutoff 드래그 시 Q/Gain 노브는 re-render 안 됨 (`rerender-derived-state`). PASS.

### feedPeak → emitLevel 호출 빈도

| 수정 전 | 수정 후 |
|---------|---------|
| 매 프레임 무조건 emitLevel() | dB 변화 ≥ 0.5 또는 finite 전환 시에만 |

---

## Vercel 룰 대조

### PASS

| 룰 | 근거 |
|---|---|
| `rerender-use-ref-transient-values` | PeakLED: barRef/dbTextRef DOM 직접 조작. SpectrumCanvas: logicalSizeRef, gridSizeRef, freqXWidthRef |
| `rerender-functional-setstate` | `setQ`: `set((state) => ({ filterParams: { ...state.filterParams, q: clamped } }))` ✓ |
| `rerender-derived-state` | FilterControls: `(s) => s.filterParams.q` primitive 추출 ✓ |
| `rerender-memo-with-default-value` | `formatQ`, `formatCutoff`, `formatGain` 모듈 상수 + `LED_STYLE_*` 모듈 상수 ✓ |
| `client-event-listeners` | `levelListeners` Set 패턴, 단일 리스너 ✓ |
| `advanced-event-handler-refs` | PeakLED `onLevel`: deps 없는 effect에서 정의 ✓ |
| `rendering-conditional-render` | `{!isActive && ...}` — boolean, falsy 값 위험 없음 ✓ |
| `js-early-exit` | SpectrumCanvas effect 4개 early return ✓ |

### 수정 항목 (라운드 1 — PeakLED/usePeakDetector)

| # | 룰 | 파일 | 수정 |
|---|---|---|---|
| 1 | `js-batch-dom-css` | `PeakLED.tsx` | `barRef` style → `cssText` 단일 할당 |
| 2 | React Compiler | `PeakLED.tsx` | `useCallback` 제거 |
| 3 | `client-event-listeners` | `usePeakDetector.ts` | `emitLevel` dB ≥ 0.5 변화 조건 |
| 4 | `rerender-memo-with-default-value` | `PeakLED.tsx` | LED style 객체 → `LED_STYLE_CLIPPING`/`LED_STYLE_NORMAL` 모듈 상수 |
| 5 | TypeScript | `usePeakDetector.ts` | `subscribe`/`subscribeLevel` 반환 타입 void 래핑 |
| 6 | unused import | `usePeakDetector.ts` | `useSyncExternalStore` 제거 |

### 수정 항목 (라운드 2 — Q 추가 + SpectrumCanvas 캐싱)

| # | 룰 | 파일 | 수정 |
|---|---|---|---|
| 7 | `js-cache-function-results` | `SpectrumCanvas.tsx` | `drawGrid` → offscreen canvas 캐시. 리사이즈 시에만 재생성, 매 프레임 `drawImage`로 복사 |
| 8 | `js-cache-function-results` | `SpectrumCanvas.tsx` | `FREQ_ARRAY` X좌표 → `freqXCacheRef`. width 변경 시에만 재계산 |
| 9 | 타입 전파 누락 | `useAudioStore.test.ts` | `initialState.filterParams`에 `q: Math.SQRT1_2` 추가 |
| 10 | 기본값 변경 전파 | `AudioEngine.test.ts` | "기본 주파수 20Hz" → "기본 주파수 0Hz" + "기본 Q Butterworth" 테스트 추가 |

---

## SpectrumCanvas 캐싱 상세

### 그리드 offscreen 캐시

**이전**: `drawGrid()` 매 프레임(60fps) 호출 — 8개 주파수 선 + 5개 dB 선 + 13개 텍스트 라벨
**이후**: `gridCacheRef`에 offscreen canvas 캐시. `gridSizeRef`와 비교하여 리사이즈 시에만 재생성. 매 프레임은 `ctx.drawImage()` 1회.

### FREQ_ARRAY X좌표 캐시

**이전**: `hzToLogX(FREQ_ARRAY[i], width, ...)` 256회 × 60fps = 15,360 log10 호출/초
**이후**: `freqXCacheRef`에 Float32Array 캐시. `freqXWidthRef`와 비교하여 width 변경 시에만 재계산. 매 프레임은 캐시된 배열 참조.

---

## 검증

- `tsc --noEmit`: 0 errors
- `eslint .`: 0 errors, 0 warnings
- `vitest run`: 60 passed
