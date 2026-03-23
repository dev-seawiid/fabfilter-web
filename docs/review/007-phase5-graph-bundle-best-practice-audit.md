# Review 007: Graph Component Bundle Best Practice Audit

**Date**: 2026-03-23
**Scope**: AudioNodeGraph 및 graph 컴포넌트 — bundle 최적화, re-render 패턴
**Reference**: Vercel React Best Practices (58 rules)
**Status**: Complete

---

## Vercel 룰 대조 결과

### CRITICAL

| 룰 | 판정 | 근거 | 조치 |
|---|---|---|---|
| `bundle-dynamic-imports` | **FAIL → FIX** | `AudioNodeGraph`는 토글 뒤에서만 렌더되지만 `@xyflow/react`를 정적 import하여 항상 번들에 포함 | `next/dynamic`으로 lazy load |
| `bundle-barrel-imports` | **FAIL → FIX** | `graph/index.ts`에서 barrel re-export 존재 — tree-shaking 방해 가능 | barrel export 제거 |

### HIGH

| 룰 | 판정 | 근거 |
|---|---|---|
| `async-parallel` | N/A | 비동기 작업 없음 |
| `async-suspense-boundaries` | N/A | 서버 데이터 페칭 없음 |

### MEDIUM

| 룰 | 판정 | 근거 |
|---|---|---|
| `rerender-derived-state` | **PASS** | `SignalFlowEdge`가 `s.playbackState === "playing"` 파생 boolean 구독 — raw 상태가 아닌 파생값 사용 |
| `rerender-functional-setstate` | **PASS** | `setGraphOpen((prev) => !prev)` 함수형 setState 사용 |
| `rendering-hoist-jsx` | **PASS** | `nodeTypes`, `edgeTypes`, `bgEdgeStyle`, `proOptions`, `fitViewOptions` 모두 모듈 레벨 호이스팅 |
| `rendering-conditional-render` | **PASS** | `{graphOpen && (...)}` — boolean이므로 falsy `0`/`""` 렌더 리스크 없음 |
| `rerender-derived-state-no-effect` | **PASS** | `GainNodeDisplay`의 dB 계산을 렌더 중 직접 수행 (effect 사용 안 함) |
| `rerender-memo` | N/A | 노드 컴포넌트는 각각 독립 store selector로 필요한 상태만 구독 — 불필요한 re-render 없음 |

### LOW-MEDIUM

| 룰 | 판정 | 근거 |
|---|---|---|
| `js-early-exit` | **PASS** | `GainNodeDisplay`의 `gain > 0` 가드로 -∞dB 처리 |
| `rendering-svg-precision` | N/A | SVG 좌표를 직접 제어하지 않음 (React Flow가 관리) |

---

## 수정 상세

### 1. `bundle-dynamic-imports` — AudioNodeGraph lazy load

**수정 전:**
```ts
// AppShell.tsx
import AudioNodeGraph from "@/components/graph/AudioNodeGraph";
```

**수정 후:**
```ts
import dynamic from "next/dynamic";

const AudioNodeGraph = dynamic(
  () => import("@/components/graph/AudioNodeGraph"),
  { ssr: false },
);
```

**이유**: `@xyflow/react`는 React Flow core + 렌더링 엔진을 포함하는 무거운 라이브러리입니다. 그래프 패널은 토글 버튼 뒤에 숨어있어 대부분의 사용자가 페이지 로드 시 즉시 필요하지 않습니다. `next/dynamic`으로 lazy load하면 초기 JS 번들에서 제외되어 First Load JS가 줄어듭니다. `ssr: false`는 React Flow가 DOM 측정에 의존하므로 서버 렌더링이 불가능하기 때문입니다.

### 2. `bundle-barrel-imports` — barrel re-export 제거

**수정 전:**
```ts
// graph/index.ts
export { default as AudioNodeGraph } from "./AudioNodeGraph";
```

**수정 후:**
```ts
// graph/index.ts
// bundle-barrel-imports: barrel re-export 금지.
// AudioNodeGraph는 dynamic import로 로드되므로 직접 경로를 사용할 것.
```

**이유**: barrel 파일은 번들러가 tree-shaking을 수행할 때 모듈 간 의존성을 복잡하게 만듭니다. 특히 dynamic import와 결합하면 barrel 파일이 정적으로 분석되어 의도치 않게 번들에 포함될 수 있습니다. 현재 모든 소비자가 직접 경로로 import하고 있으므로 barrel은 불필요합니다.

---

## 이미 올바르게 구현된 패턴

변경된 graph 컴포넌트에서 Vercel 베스트 프랙티스에 부합하는 좋은 패턴들:

| 파일 | 패턴 | 규칙 |
|------|------|------|
| `AudioNodeGraph.tsx` | `nodeTypes`, `edgeTypes` 등 정적 객체를 모듈 레벨에 선언 | `rendering-hoist-jsx` |
| `SignalFlowEdge.tsx` | `bgEdgeStyle` 모듈 레벨 상수 + 파생 boolean selector | `rendering-hoist-jsx` + `rerender-derived-state` |
| `FilterNode.tsx` | `formatHz()` 순수 함수를 모듈 레벨에 선언 | `js-cache-function-results` |
| `GainNodeDisplay.tsx` | dB 변환을 렌더 중 직접 계산 (useEffect/useState 없이) | `rerender-derived-state-no-effect` |
| 각 노드 컴포넌트 | 개별 selector로 필요한 상태만 구독 (`s.filterParams.cutoffHz` 등) | `rerender-derived-state` |

---

## 수정된 파일

| 파일 | 수정 내용 |
|------|-----------|
| `src/components/layout/AppShell.tsx` | `AudioNodeGraph` → `next/dynamic` lazy load |
| `src/components/graph/index.ts` | barrel re-export 제거 |
