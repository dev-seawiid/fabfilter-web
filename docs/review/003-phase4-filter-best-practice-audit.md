# Review 003: Phase 4 Filter Best Practice Audit (Vercel Skills 검증)

**Date**: 2026-03-20
**Scope**: Phase 4 (US2+US3: Filter+Viz) — FilterEngine, Knob, FilterControls, Store setCutoff/setGain
**Reference**: Vercel React Best Practices (58 rules), Vercel Composition Patterns (8 rules)
**Status**: Complete

---

## Vercel 룰 대조 결과

### CRITICAL / HIGH

| 룰 | 판정 | 근거 |
|---|---|---|
| `bundle-barrel-imports` | PASS | `optimizePackageImports` 이미 설정 (Review 001) |
| `bundle-dynamic-imports` | N/A | Phase 2 컴포넌트는 항상 렌더링 |
| `bundle-conditional` | PASS | 조건적 로드 대상 아님 |
| `architecture-avoid-boolean-props` | PASS (예외) | `logarithmic`은 계산 로직만 변경, UI 구조 동일 |
| `patterns-explicit-variants` | PASS (예외) | JSX 100% 동일, variant 분리 시 300줄 중복 |

### MEDIUM — 수정 필요했던 항목

| 룰 | 판정 | 수정 내용 |
|---|---|---|
| `rerender-memo-with-default-value` | **DONE** | `formatValue` 인라인 함수 → 모듈 레벨 상수 `formatCutoff`, `formatGain`으로 추출 |
| `rendering-svg-precision` | **DONE** | `polarToCartesian` 결과를 소수점 1자리로 반올림 |

### MEDIUM — PASS 항목

| 룰 | 근거 |
|---|---|
| `rerender-functional-setstate` | `setCutoff`/`setGain`이 `set((state) => ...)` 함수형 업데이트 사용 |
| `rerender-derived-state` | FilterControls에서 `(s) => s.filterParams.cutoffHz` — primitive 추출, 교차 re-render 없음 |
| `rerender-move-effect-to-event` | Knob 인터랙션이 useEffect 없이 이벤트 핸들러에서 직접 처리 |
| `client-passive-event-listeners` | React synthetic events 사용, 별도 addEventListener 없음 |
| `js-early-exit` | `handlePointerMove`에서 `if (!e.buttons) return` |

### MEDIUM — 수용한 항목 (WONTFIX)

| 룰 | 이유 |
|---|---|
| `rerender-transitions` | Knob 드래그는 urgent 업데이트 — `startTransition` 부적절 |
| `rerender-use-ref-transient-values` | SVG 인디케이터 각도를 ref로 전환하면 복잡성 급증, 성능 문제 관측 시 최적화 |

### 이전 리뷰(001)에서 추가 적용된 항목

| 수정 | 파일 |
|---|---|
| Knob 접근성: `role="slider"`, ARIA 속성, 키보드 지원 | `Knob.tsx` |
| `_filterEngine = null` in dispose | `AudioEngine.ts` |
| `useCallback` 제거 (React Compiler 환경) | `Knob.tsx` |

---

## 최종 수정 통계

| 파일 | 변경 | 룰 |
|---|---|---|
| `FilterControls.tsx` | `formatValue` 인라인 함수 → 모듈 상수 | `rerender-memo-with-default-value` |
| `Knob.tsx` | SVG 좌표 소수점 1자리 제한 | `rendering-svg-precision` |
| `Knob.tsx` | ARIA 속성 + 키보드 + `useCallback` 제거 | 접근성 + React Compiler |
| `AudioEngine.ts` | `dispose`에서 `_filterEngine` 정리 | 리소스 해제 |

**검증**: `tsc --noEmit` 0 errors, `eslint .` 0 errors, `vitest run` 59 passed
