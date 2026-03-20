# Review 004: Phase 4 Viz Best Practice Audit (Vercel Skills 검증)

**Date**: 2026-03-20
**Scope**: Phase 4 (US3: Visualization) — AnalyserBridge, useSpectrumData, SpectrumCanvas, PeakLED, frequency/smoothing utils
**Reference**: Vercel React Best Practices (58 rules), Vercel Composition Patterns (8 rules)
**Status**: Complete

---

## Vercel 룰 대조 결과

### 수정 필요했던 항목

| # | 룰 | 파일 | 이슈 | 수정 |
|---|---|---|---|---|
| 1 | `js-cache-property-access` | `AnalyserBridge.ts` | `getPostPeak()`이 매 프레임 `new Float32Array(fftSize)` 할당 — 60fps × GC 부담 | 생성자에서 `timeDomainBuffer` 사전 할당, 루프 내 `buf`/`len` 캐싱 |
| 2 | `client-event-listeners` | `PeakLED.tsx` | `useSpectrumData()` 중복 호출 → 외부 스토어 listener 2개 등록 | `feedPeak()`를 useSpectrumData rAF 콜백에서 직접 호출, PeakLED는 피크 외부 스토어만 구독 |
| 3 | `rerender-move-effect-to-event` | `SpectrumCanvas.tsx` | `useCallback` 3개가 `useEffect` deps에 포함 → React Compiler 환경에서 불필요 | `useCallback` 제거, 일반 함수로 전환 |

### PASS 항목

| 룰 | 근거 |
|---|---|
| `rerender-derived-state-no-effect` | `isActive = playbackState === "playing"` — render 중 파생 ✓ |
| `rerender-simple-expression-in-memo` | 단순 boolean 파생에 useMemo 미사용 ✓ |
| `rerender-functional-setstate` | 해당 없음 — 시각화 컴포넌트는 store를 읽기만 함 |
| `advanced-init-once` | `FREQ_ARRAY` 모듈 레벨에서 1회 생성 ✓ |
| `rendering-hoist-jsx` | React Compiler 활성 환경 — 자동 호이스팅 |
| `js-combine-iterations` | `getPostPeak` 루프가 단일 반복 ✓ |
| `js-early-exit` | `drawSpectrum` 루프 내 `if (hz < MIN_HZ ...) continue` ✓ |
| `bundle-barrel-imports` | `optimizePackageImports` 이미 설정 |

### 수용한 항목 (WONTFIX)

| 룰 | 이유 |
|---|---|
| `getEngine()` 부활 | AnalyserNode/FilterEngine 접근에 필수. 읽기 전용 래퍼로 감싸면 과도한 추상화 |
| Canvas `useEffect` 드로잉 | rAF 직접 드로잉으로 바꾸면 SpectrumCanvas-useSpectrumData 강결합. 현재 1프레임 지연은 60fps에서 시각적으로 인지 불가 |

---

## 수정 상세

### 1. `AnalyserBridge.getPostPeak()` — Float32Array 사전 할당

**Before**: 매 프레임 `new Float32Array(this.analyserPost.fftSize)` 할당
**After**: 생성자에서 `this.timeDomainBuffer` 1회 할당, `getPostPeak()`에서 재사용

### 2. PeakLED 구조 변경 — useSpectrumData 이중 호출 제거

**Before**:
```
SpectrumCanvas → useSpectrumData (listener 1)
PeakLED → useSpectrumData (listener 2) → usePeakDetector
```

**After**:
```
SpectrumCanvas → useSpectrumData (listener 1) → rAF 내 feedPeak() 직접 호출
PeakLED → useSyncExternalStore(peakStore) (listener 0 on spectrumStore)
```

PeakLED는 `useSpectrumData`를 전혀 구독하지 않고, peak 전용 외부 스토어의 boolean만 감지. re-render는 **클리핑 시작/종료 시에만** 발생 (초당 0~1회).

### 3. SpectrumCanvas — useCallback 제거

React Compiler 환경에서 `useCallback`은 자동 메모이제이션되므로 수동 래핑 불필요. 일반 함수로 전환하여 코드 간결화.

---

## 검증

- `tsc --noEmit`: 0 errors
- `eslint .`: 0 errors
- `vitest run`: 59 passed
