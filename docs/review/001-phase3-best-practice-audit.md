# Review 001: Phase 3 Best Practice Audit

**Date**: 2026-03-20
**Scope**: Phase 3 (US1: 오디오 파일 업로드 및 재생) 구현 코드
**Reference**: Vercel React Best Practices, Vercel Composition Patterns, Project Constitution v1.3.0
**Status**: In Progress

---

## 검증 기준

| 소스                                        | 설명                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [01-constitution.md](../01-constitution.md) | 프로젝트 아키텍처 원칙 (Audio-First, SSOT, 60fps, Testing, Graceful Degradation)               |
| Vercel React Best Practices                 | 58개 룰, 8개 카테고리 (Waterfalls, Bundle, Server, Client, Re-render, Rendering, JS, Advanced) |
| Vercel Composition Patterns                 | 8개 룰 (Architecture, State, Patterns, React 19 APIs)                                          |

---

## Constitution 준수 현황

| 원칙                       | 판정 | 근거                                                                                             |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| I. Audio-First             | PASS | `engine/`이 React 무의존, 노드 토폴로지 `Source → Pre → Filter → Gain → Post → Destination` 정확 |
| II. Single Source of Truth | WARN | `getEngine()` 액션이 엔진 인스턴스를 컴포넌트에 직접 노출 가능 — 우회 경로                       |
| III. 60fps Visual Fidelity | FAIL | Timeline이 매 프레임 React state 갱신 → 초당 60회 re-render                                      |
| IV. Three-Layer Testing    | N/A  | Phase 3 테스트 미작성 상태 (04-tasks.md 기준 T013~T017)                                          |
| V. Graceful Degradation    | PASS | `ensureResumed()`, `decodeAudioData` 에러 핸들링, `onended` 상태 초기화 구현                     |

---

## 발견된 이슈

### CRITICAL

#### C-01: Timeline 60fps re-render

- **파일**: `src/components/audio/Timeline.tsx:19, 28-30`
- **룰**: `rerender-use-ref-transient-values` (Vercel, MEDIUM impact)
- **헌법**: III. 60fps Visual Fidelity — 메인 스레드 15% 예산 위협

**현상**: `useAudioStore((s) => s.currentTime)` 구독 + `useAnimationFrame` 내 `updateCurrentTime()` 호출로, 재생 중 매 프레임 React state가 갱신되어 Timeline 전체가 re-render.

**영향**: React reconciliation 비용이 매 프레임(16ms 예산) 발생. Phase 2에서 SpectrumCanvas + AnalyserNode 2개 추가 시 15% 메인 스레드 예산 초과 위험.

**수정**: `currentTime`을 ref로 관리하고, 진행 바/Playhead/시간 표시를 직접 DOM 조작으로 업데이트. React re-render를 0회로 줄임.

#### C-02: `updateCurrentTime`이 매 프레임 전역 store 갱신

- **파일**: `src/store/useAudioStore.ts:142-147`
- **룰**: `rerender-defer-reads` (Vercel, MEDIUM impact)
- **헌법**: II. Single Source of Truth — 불필요한 전역 상태 변경

**현상**: `updateCurrentTime()`이 매 프레임 `set({ currentTime })` 호출. `currentTime`을 구독하는 모든 컴포넌트가 60fps re-render 대상이 됨.

**수정**: Timeline의 currentTime을 store에서 분리하여 ref 기반 로컬 업데이트로 전환. store의 `currentTime`은 seek/pause 등 이산적 이벤트에서만 갱신.

#### C-03: SVG 직접 애니메이션

- **파일**: `src/components/audio/FileUploader.tsx:124`
- **룰**: `rendering-animate-svg-wrapper` (Vercel, LOW impact)

**현상**: `<svg className="animate-spin">`으로 SVG 요소에 직접 CSS 애니메이션 적용. 다수 브라우저에서 GPU 가속이 작동하지 않음.

**수정**: `<div className="animate-spin">` 래퍼로 감싸기.

### HIGH

#### H-01: Barrel file imports — framer-motion

- **파일**: 전체 `"use client"` 컴포넌트
- **룰**: `bundle-barrel-imports` (Vercel, CRITICAL impact)

**현상**: `import { motion } from "framer-motion"`이 전체 모듈 그래프를 로드.

**수정**: `next.config.ts`에 `optimizePackageImports: ['framer-motion', '@xyflow/react']` 추가.

#### H-02: `getEngine()` 액션이 Constitution II를 약화

- **파일**: `src/store/useAudioStore.ts:77`
- **헌법**: II. Single Source of Truth — "컴포넌트는 engine/을 직접 import하지 않고, 스토어 액션을 통해 간접 제어"

**현상**: `getEngine()` 메서드가 `AudioEngine` 인스턴스를 그대로 반환하여, 컴포넌트가 엔진 메서드를 직접 호출할 수 있는 우회 경로 존재.

**수정**: Phase 2 시각화 구현 시 필요한 접근은 전용 액션(`getPreFrequencyData` 등)으로 대체. 현 단계에서는 `getEngine`을 store 내부 전용으로 제한.

#### H-03: `play()` 액션의 에러 미처리

- **파일**: `src/store/useAudioStore.ts:104-113`

**현상**: `ensureResumed().then()`에 `.catch()`가 없어 `AudioContext.resume()` 실패 시 무음 에러.

**수정**: `async/await` + `try/catch`로 통일, 에러 시 `set({ error })`.

### MEDIUM

#### M-01: `layout.tsx` font 클래스 충돌

- **파일**: `src/app/layout.tsx:15`

**현상**: `<body className="font-sans antialiased">`의 `font-sans`가 `globals.css`의 monospace 폰트 선언을 덮어씀.

**수정**: `font-sans` 제거.

#### M-02: `useAnimationFrame` deps 없는 effect

- **파일**: `src/hooks/useAnimationFrame.ts:18-20`
- **룰**: `advanced-event-handler-refs` (Vercel)

**현상**: `useEffect(() => { callbackRef.current = callback; })` — deps 배열 없이 매 render마다 effect 큐에 추가.

**판정**: WONTFIX — React Compiler ESLint 룰(`Cannot access refs during render`)이 활성화되어 있어 render 중 ref 할당 불가. 현재 `useEffect` 패턴이 이 환경에서의 정답.

#### M-03: 정적 SVG 호이스팅

- **파일**: `src/components/audio/FileUploader.tsx`, `PlaybackControls.tsx`
- **룰**: `rendering-hoist-jsx` (Vercel, LOW impact)

**현상**: SVG 아이콘이 컴포넌트 내부에서 매 render마다 재생성.

**수정**: 모듈 레벨 상수로 추출.

#### M-04: React Flow lazy load 준비

- **룰**: `bundle-dynamic-imports` (Vercel, CRITICAL impact)

**현상**: `@xyflow/react`는 Phase 3에서 사용 예정. 무거운 라이브러리이므로 lazy load 필수.

**수정**: Phase 3 구현 시 `next/dynamic`으로 `ssr: false` lazy import.

---

## PASS 항목

| 항목                                                   | 관련 기준                          |
| ------------------------------------------------------ | ---------------------------------- |
| Zustand selector 세분화 `(s) => s.isLoading`           | `rerender-derived-state`           |
| Server/Client 경계 — `page.tsx` RSC, `AppShell` client | `server-serialization`             |
| `engine/` React 무의존                                 | Constitution I                     |
| `AudioBufferSourceNode` 1회성 패턴                     | Web Audio best practice            |
| `onended` 핸들러 관리 — `stop()` 시 콜백 제거          | Constitution V                     |
| `dispose()` 리소스 해제 — disconnect + close           | Constitution I                     |
| Tailwind v4 `@theme` 커스텀 팔레트                     | 최신 스택                          |
| `aria-label` on PlaybackControls                       | 접근성                             |
| 에러 메시지 표시                                       | Constitution V, FR-061             |
| Boolean prop 미사용, 단일 책임 컴포넌트                | `architecture-avoid-boolean-props` |
| `forwardRef` 미사용                                    | `react19-no-forwardref`            |

---

## 수정 결과

| #   | 이슈                                                | 대상 파일                                  | 상태                          |
| --- | --------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| 1   | C-01 + C-02: Timeline ref 기반 DOM 업데이트         | `Timeline.tsx`, `useAudioStore.ts`         | DONE                          |
| 2   | C-03: SVG spinner div 래퍼                          | `FileUploader.tsx`                         | DONE                          |
| 3   | H-01: `optimizePackageImports` 설정                 | `next.config.ts`                           | DONE                          |
| 4   | H-02: `getEngine()` → `getPlaybackInfo()` 읽기 전용 | `useAudioStore.ts`                         | DONE                          |
| 5   | H-03: `play()` async/await + try/catch              | `useAudioStore.ts`                         | DONE                          |
| 6   | M-01: `font-sans` 제거                              | `layout.tsx`                               | DONE                          |
| 7   | M-02: callbackRef 직접 할당                         | `useAnimationFrame.ts`                     | WONTFIX (React Compiler 제약) |
| 8   | M-03: 정적 SVG 호이스팅                             | `FileUploader.tsx`, `PlaybackControls.tsx` | DONE                          |

**검증**: `tsc --noEmit` PASS, `eslint .` PASS (0 errors, 0 warnings)
