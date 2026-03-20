# Implementation Plan: Fabfilter Web Audio Processor

**Branch**: `main` | **Date**: 2026-03-20 | **Spec**: [02-specify.md](02-specify.md)
**Input**: Fabfilter 스타일 브라우저 기반 오디오 프로세서 — Low-cut 필터, Pre/Post 3-레이어 FFT 시각화, 노드 그래프 가시화

## Summary

브라우저에서 오디오 파일을 업로드하고, Web Audio API 기반 Low-cut 필터를 실시간 조작하며, Fabfilter Pro-Q 스타일의 Pre/Post 스펙트럼 비교 시각화를 제공하는 웹 애플리케이션을 구현한다. Next.js App Router + Zustand + Canvas 2D + React Flow 스택으로 구성하며, `engine/ → store/ → components/` 삼각 아키텍처를 통해 오디오 로직과 UI를 분리한다.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Framework**: Next.js (latest, App Router)
**Primary Dependencies**: Zustand, Framer Motion, React Flow (`@xyflow/react`), Tailwind CSS
**Storage**: N/A (클라이언트 사이드 전용, 파일은 메모리 내 `AudioBuffer`로 처리)
**Testing**: Vitest (Unit/Component) + Playwright (E2E)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge) — Web Audio API 지원 필수
**Project Type**: Web Application (SPA)
**Performance Goals**: 60fps Canvas 렌더링, 메인 스레드 점유율 15% 이하
**Constraints**: AudioContext 브라우저 정책(사용자 제스처 필요), Canvas 단일 스레드 렌더링
**Scale/Scope**: 단일 페이지, 4~8개 오디오 노드, 1개 필터 (Low-cut)

## Constitution Check

_GATE: 각 Phase 시작 전 검증. 위반 시 Complexity Tracking에 기록._

| #   | 원칙                   | 검증 항목                                                                                                                                      | Phase         |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| I   | Audio-First            | 오디오 그래프가 `engine/` 단일 모듈에서 관리되는가? `Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination` 경로가 유지되는가? | Phase 0, 1    |
| II  | Single Source of Truth | 모든 오디오 상태가 Zustand 스토어 하나에서 관리되는가? 컴포넌트가 `engine/`을 직접 import하지 않는가?                                          | Phase 0, 1, 2 |
| III | 60fps Visual Fidelity  | Canvas 드로잉이 15% 메인 스레드 예산 내인가? Pre/Post 3-레이어 합성이 단일 Canvas에서 이루어지는가?                                            | Phase 2       |
| IV  | Three-Layer Testing    | Unit(매 커밋) + Component(매 커밋) + E2E(PR 단위) 3계층이 구성되어 있는가?                                                                     | Phase 0~3     |
| V   | Graceful Degradation   | AudioContext suspended 대응, 에러 메시지, 메모리 클린업이 구현되어 있는가?                                                                     | Phase 1~3     |

## Project Structure

### Documentation

```text
docs/
├── 00-requirements.md        # 요구사항 체크리스트
├── 01-constitution.md         # 프로젝트 헌법 (v1.3.0)
├── 02-specify.md              # Feature Specification
├── 03-plan.md                 # This file — Implementation Plan
└── adr/
    ├── adr-audio-visualization.md     # 오디오 시각화 라이브러리 선택
    └── adr-node-graph-visualization.md # 노드 그래프 라이브러리 선택
```

### Source Code

```text
src/
├── app/
│   ├── layout.tsx             # Root layout (Tailwind, 폰트)
│   └── page.tsx               # 메인 페이지 (단일 SPA)
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Knob.tsx           # 회전 노브 (Cutoff, Gain 제어)
│   │   ├── Slider.tsx
│   │   └── PeakLED.tsx        # Clipping 경고 인디케이터
│   ├── audio/
│   │   ├── FileUploader.tsx   # 파일 드롭/선택 + 디코딩 로딩
│   │   ├── Timeline.tsx       # 타임라인 + Playhead
│   │   ├── PlaybackControls.tsx
│   │   ├── SpectrumCanvas.tsx # 3-레이어 FFT 시각화 (Pre/Post/응답곡선)
│   │   └── FilterControls.tsx # Cutoff + Gain 노브 패널
│   ├── graph/
│   │   ├── AudioNodeGraph.tsx # React Flow 메인 컴포넌트
│   │   ├── nodes/             # 커스텀 노드 (Source, Filter, Gain, Analyser, Destination)
│   │   └── edges/             # 커스텀 엣지 (애니메이션 신호 흐름)
│   └── layout/
│       └── AppShell.tsx       # 전체 레이아웃 (스펙트럼 + 컨트롤 + 그래프)
├── engine/
│   ├── AudioEngine.ts         # AudioContext, 노드 그래프 생성/연결/해제
│   ├── FilterEngine.ts        # BiquadFilterNode 래퍼, Smoothing 로직
│   ├── AnalyserBridge.ts      # Pre/Post AnalyserNode FFT 데이터 추출
│   └── types.ts               # 엔진 내부 타입
├── store/
│   └── useAudioStore.ts       # Zustand 스토어 (재생, 시간, 필터, 게인)
├── hooks/
│   ├── useAnimationFrame.ts   # requestAnimationFrame 래퍼
│   └── useSpectrumData.ts     # AnalyserNode → Float32Array 브릿지
├── utils/
│   ├── frequency.ts           # Hz ↔ 로그 스케일 변환, dB 변환
│   └── smoothing.ts           # FFT 데이터 Smoothing 알고리즘
└── types/
    └── audio.ts               # 공유 타입 (PlaybackState, FilterParams 등)
e2e/
├── playback.spec.ts
├── filter.spec.ts
├── visualization.spec.ts
└── performance.spec.ts
```

**Structure Decision**: Constitution I의 `engine/ → store/ → components/` 삼각 구조를 따른다. `engine/`은 React 무의존, `store/`가 유일한 통신 채널, `components/`는 스토어만 구독한다.

---

## Implementation Phases

<!--
  각 Phase는 Spec의 User Story와 1:1 매핑된다.
  Phase 완료 = 해당 User Story의 Acceptance Scenarios 전체 통과.
  각 Phase는 독립적으로 배포 가능한 상태를 목표로 한다.
-->

### Phase 0 — 프로젝트 부트스트래핑 (Foundation)

**목표**: 개발 환경 구성 + 빈 `engine/ → store/ → components/` 스캐폴딩. 코드 한 줄도 비즈니스 로직이 없지만, Constitution의 아키텍처 원칙이 폴더 구조에 반영된 상태.

**산출물**:

| Task                                 | 파일                                                                                     | FR     | 완료 기준                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Next.js + TypeScript 프로젝트 초기화 | `package.json`, `tsconfig.json`, `next.config.ts`                                        | —      | `npm run dev`로 빈 페이지 렌더링                                                              |
| Tailwind CSS 설정                    | `tailwind.config.ts`, `globals.css`                                                      | —      | 유틸리티 클래스 적용 확인                                                                     |
| ESLint + Prettier 설정               | `.eslintrc`, `.prettierrc`                                                               | —      | `npm run lint` 통과                                                                           |
| Vitest 설정                          | `vitest.config.ts`                                                                       | FR-070 | `npm run test` 실행 가능 (0 tests)                                                            |
| Playwright 설정                      | `playwright.config.ts`, `e2e/`                                                           | FR-072 | `npx playwright test` 실행 가능 (0 tests)                                                     |
| 디렉토리 스캐폴딩                    | `src/engine/`, `src/store/`, `src/components/`, `src/hooks/`, `src/utils/`, `src/types/` | —      | 빈 디렉토리 + index.ts                                                                        |
| Zustand 스토어 스캐폴딩              | `src/store/useAudioStore.ts`                                                             | FR-050 | 빈 스토어 생성, 타입 정의만                                                                   |
| 의존성 설치                          | `package.json`                                                                           | —      | `zustand`, `framer-motion`, `@xyflow/react`, `vitest`, `@testing-library/react`, `playwright` |

**Constitution Check**: 폴더 구조가 I(Audio-First) 원칙을 반영하는가? `engine/`이 React에 의존하지 않는 구조인가?

---

### Phase 1 — 오디오 재생 엔진 (User Story 1: P1)

**목표**: 파일 업로드 → 디코딩 → 재생/정지/탐색 → Playhead 동기화. 이 Phase만 완료해도 "웹 오디오 플레이어"로 동작한다.

**의존성**: Phase 0

**산출물**:

| Task                         | 파일                                        | FR                     | 완료 기준                                                                                                                                       |
| ---------------------------- | ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AudioEngine 코어 구현        | `src/engine/AudioEngine.ts`                 | FR-001, FR-002, FR-023 | `AudioContext` 생성, `decodeAudioData`, 노드 그래프 연결 (`Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination`), 리소스 해제 |
| Zustand 스토어 — 재생 상태   | `src/store/useAudioStore.ts`                | FR-050                 | `playbackState`, `currentTime`, `duration`, `isLoading` + 액션 (`play`, `pause`, `seek`, `loadFile`)                                            |
| FileUploader 컴포넌트        | `src/components/audio/FileUploader.tsx`     | FR-001, FR-003         | 파일 드롭/선택 → 스토어 `loadFile` 액션 호출, 로딩 인디케이터 표시                                                                              |
| PlaybackControls 컴포넌트    | `src/components/audio/PlaybackControls.tsx` | FR-010                 | 재생/정지 버튼 → 스토어 `play`/`pause` 액션                                                                                                     |
| Timeline + Playhead 컴포넌트 | `src/components/audio/Timeline.tsx`         | FR-011, FR-012         | 클릭 → `seek` 액션, `requestAnimationFrame` 기반 Playhead 60fps 동기화                                                                          |
| useAnimationFrame 훅         | `src/hooks/useAnimationFrame.ts`            | FR-012                 | `requestAnimationFrame` 래퍼, 탭 비활성화 시 재동기화                                                                                           |
| 재생 종료 처리               | `src/engine/AudioEngine.ts`                 | FR-013                 | `onended` 콜백 → 스토어 상태 초기화                                                                                                             |
| AudioContext 정책 대응       | `src/engine/AudioEngine.ts`                 | FR-060                 | suspended 감지 → 사용자 제스처 resume 흐름                                                                                                      |
| 에러 핸들링                  | `src/components/audio/FileUploader.tsx`     | FR-061                 | 미지원 포맷 에러 메시지 표시                                                                                                                    |
| Unit 테스트                  | `src/engine/__tests__/AudioEngine.test.ts`  | FR-070                 | AudioContext 모킹, 노드 연결 순서 검증, 리소스 해제 검증                                                                                        |
| Component 테스트             | `src/components/audio/__tests__/`           | FR-071                 | PlaybackControls 클릭 → 스토어 액션 호출 검증                                                                                                   |
| E2E 테스트                   | `e2e/playback.spec.ts`                      | FR-072                 | 파일 업로드 → 재생 → Seeking → 정지 전체 흐름                                                                                                   |

**Acceptance Gate**: Spec User Story 1의 6개 시나리오 전체 통과. SC-001(3초 이내), SC-002(±16ms), SC-007(메모리 누수 없음).

---

### Phase 2 — 필터 엔진 + 시각화 (User Story 2 + 3: P2 + P3)

**목표**: Low-cut 필터 실시간 제어 + Pre/Post 3-레이어 스펙트럼 시각화. P2와 P3을 한 Phase에 묶는 이유: 필터 변경의 **청각적 피드백**(P2)과 **시각적 피드백**(P3)을 동시에 제공해야 Fabfilter 경험이 완성되기 때문.

**의존성**: Phase 1

**산출물**:

| Task                       | 파일                                        | FR                     | 완료 기준                                                                                                       |
| -------------------------- | ------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| FilterEngine 구현          | `src/engine/FilterEngine.ts`                | FR-020, FR-021         | `BiquadFilterNode(highpass)` 래퍼, `setTargetAtTime` Smoothing, Cutoff/Q 제어                                   |
| GainNode 제어              | `src/engine/AudioEngine.ts`                 | FR-022                 | `GainNode` gain 파라미터 Smoothing 포함 제어                                                                    |
| Zustand 스토어 — 필터 상태 | `src/store/useAudioStore.ts`                | FR-050                 | `cutoffHz`, `gain` 상태 + `setCutoff`, `setGain` 액션 추가                                                      |
| AnalyserBridge 구현        | `src/engine/AnalyserBridge.ts`              | FR-024                 | Pre/Post `AnalyserNode`에서 `getFloatFrequencyData()` 추출, `Float32Array` 반환                                 |
| frequency 유틸리티         | `src/utils/frequency.ts`                    | FR-030                 | Hz → 로그 스케일 X좌표 변환, dB → Y좌표 변환, 로그 주파수 배열(20Hz~20kHz) 생성                                 |
| smoothing 유틸리티         | `src/utils/smoothing.ts`                    | FR-031                 | FFT 데이터 시간 도메인 Smoothing (exponential moving average)                                                   |
| SpectrumCanvas 컴포넌트    | `src/components/audio/SpectrumCanvas.tsx`   | FR-030, FR-031, FR-032 | 단일 Canvas 위 3-레이어 합성: Pre(ghost) → 필터 응답 곡선(영역) → Post(primary). 60fps `requestAnimationFrame`. |
| useSpectrumData 훅         | `src/hooks/useSpectrumData.ts`              | FR-030                 | AnalyserBridge → Float32Array → Smoothing → 컴포넌트 전달                                                       |
| Knob 컴포넌트              | `src/components/ui/Knob.tsx`                | FR-020                 | 회전 드래그 인터랙션, Framer Motion 애니메이션, 스토어 액션 연결                                                |
| FilterControls 패널        | `src/components/audio/FilterControls.tsx`   | FR-020, FR-022         | Cutoff 노브 + Gain 노브 + 수치 표시                                                                             |
| PeakLED 컴포넌트           | `src/components/ui/PeakLED.tsx`             | FR-033                 | Post-EQ AnalyserNode 피크 감지 → Clipping 경고                                                                  |
| Unit 테스트 — 필터 수학    | `src/engine/__tests__/FilterEngine.test.ts` | FR-070                 | 감쇄율 이론치 ±1dB 검증 (SC-006), Smoothing 계수 범위 검증                                                      |
| Unit 테스트 — 유틸리티     | `src/utils/__tests__/`                      | FR-070                 | Hz↔로그 변환 정확도, Smoothing 알고리즘 수렴 검증                                                               |
| Component 테스트 — 노브    | `src/components/ui/__tests__/Knob.test.tsx` | FR-071                 | 드래그 → 스토어 `setCutoff` 호출 검증                                                                           |
| E2E 테스트 — 필터          | `e2e/filter.spec.ts`                        | FR-072                 | Cutoff 조작 → 오디오 변화, Smoothing(팝 없음)                                                                   |
| E2E 테스트 — 시각화        | `e2e/visualization.spec.ts`                 | FR-072                 | Canvas 렌더링 존재 확인, Pre/Post 스펙트럼 차이                                                                 |
| E2E 테스트 — 성능          | `e2e/performance.spec.ts`                   | FR-072                 | 메인 스레드 15% 이하 (SC-004)                                                                                   |

**Acceptance Gate**: Spec User Story 2의 4개 시나리오 + User Story 3의 5개 시나리오 전체 통과. SC-003(50ms 이하), SC-004(15%), SC-005(팝 없음), SC-006(±1dB).

---

### Phase 3 — 노드 그래프 가시화 (User Story 4: P4)

**목표**: React Flow 기반 오디오 노드 그래프. 이 Phase는 SHOULD 레벨이므로 Phase 2까지 완료된 상태에서 추가한다.

**의존성**: Phase 2

**산출물**:

| Task                          | 파일                                             | FR     | 완료 기준                                         |
| ----------------------------- | ------------------------------------------------ | ------ | ------------------------------------------------- |
| AudioNodeGraph 컴포넌트       | `src/components/graph/AudioNodeGraph.tsx`        | FR-040 | React Flow 초기화, 노드/엣지 정의, 좌→우 레이아웃 |
| 커스텀 노드 — SourceNode      | `src/components/graph/nodes/SourceNode.tsx`      | FR-040 | 파일명, 재생 상태 표시                            |
| 커스텀 노드 — FilterNode      | `src/components/graph/nodes/FilterNode.tsx`      | FR-042 | Cutoff Hz 실시간 값 표시                          |
| 커스텀 노드 — GainNode        | `src/components/graph/nodes/GainNode.tsx`        | FR-042 | Gain 값 실시간 표시                               |
| 커스텀 노드 — AnalyserNode    | `src/components/graph/nodes/AnalyserNode.tsx`    | FR-040 | Pre/Post 라벨, 미니 레벨 미터 (MAY)               |
| 커스텀 노드 — DestinationNode | `src/components/graph/nodes/DestinationNode.tsx` | FR-040 | 출력 아이콘                                       |
| 애니메이션 엣지               | `src/components/graph/edges/SignalFlowEdge.tsx`  | FR-041 | `animated` prop, 재생 중일 때만 활성화            |
| AppShell 레이아웃 통합        | `src/components/layout/AppShell.tsx`             | —      | 스펙트럼 + 컨트롤 + 노드 그래프 패널 배치         |
| Component 테스트              | `src/components/graph/__tests__/`                | FR-071 | 노드 6개 렌더링, 엣지 5개 연결 검증               |

**Acceptance Gate**: Spec User Story 4의 4개 시나리오 통과. 노드 그래프 DOM 렌더링이 전체 15% 예산 내.

---

## Phase 의존성 다이어그램

```
Phase 0 (Foundation)
  │
  ▼
Phase 1 (Playback — P1)          ← 이것만으로 MVP
  │
  ▼
Phase 2 (Filter + Viz — P2+P3)   ← Fabfilter 경험 완성
  │
  ▼
Phase 3 (Node Graph — P4)        ← Observability 추가
```

## Complexity Tracking

| 결정                        | 이유                                                                           | 더 단순한 대안을 기각한 이유                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AnalyserNode 2개 (Pre/Post) | Fabfilter 스타일 Pre/Post 비교 시각화 요구                                     | AnalyserNode 1개(Post만)로는 필터 적용 전 원본 스펙트럼을 보여줄 수 없음                                                                                |
| P2+P3 동일 Phase            | 필터의 청각적+시각적 피드백이 동시에 제공되어야 Fabfilter UX 성립              | P2, P3 분리 시 필터 조작 후 시각적 피드백 없이 배포하게 됨 — 불완전한 UX                                                                                |
| React Flow 도입             | 노드 그래프 가시화 요구사항 (Requirements §3)                                  | Canvas 직접 구현 대비 노드 안에 React 컴포넌트(노브, 미터) 삽입이 필요하므로 React Flow가 유일한 선택 ([ADR 참조](adr/adr-node-graph-visualization.md)) |
| Playwright E2E 도입         | `AudioContext`, `Canvas`, `performance.memory`는 실제 브라우저에서만 검증 가능 | Vitest만으로는 SC 7개 중 5개를 검증할 수 없음                                                                                                           |
