# Tasks: Fabfilter Web Audio Processor

**Input**: [03-plan.md](03-plan.md), [02-specify.md](02-specify.md), [01-constitution.md](01-constitution.md)
**Prerequisites**: plan.md (required), spec.md (required for user stories), ADRs

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `src/` at repository root
- **E2E Tests**: `e2e/` at repository root
- **Config**: repository root

---

## Phase 1: Setup

**Purpose**: 프로젝트 초기화 및 개발 환경 구성

- [ ] T001 Initialize Next.js + TypeScript project — `package.json`, `tsconfig.json`, `next.config.ts` → `npm run dev`로 빈 페이지 렌더링
- [ ] T002 [P] Configure Tailwind CSS v4 — `postcss.config.mjs`, `src/app/globals.css` (`@import "tailwindcss"`) → 유틸리티 클래스 적용 확인
- [ ] T003 [P] Configure ESLint 9 (flat config) + Prettier — `eslint.config.mjs`, `.prettierrc` → `npm run lint` 통과
- [ ] T004 [P] Install all dependencies — `zustand`, `framer-motion`, `@xyflow/react`, `vitest`, `@testing-library/react`, `@playwright/test`

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: 아키텍처 스캐폴딩 + 테스트 인프라. 비즈니스 로직 없음. Constitution I의 `engine/ → store/ → components/` 삼각 구조가 폴더에 반영된 상태.

**⚠️ CRITICAL**: User Story 구현은 이 Phase 완료 후 시작 가능

- [ ] T005 Create directory scaffolding — `src/engine/`, `src/store/`, `src/components/{ui,audio,graph,layout}/`, `src/hooks/`, `src/utils/`, `src/types/` 빈 디렉토리 + `index.ts`
- [ ] T006 [P] Define shared types in `src/types/audio.ts` — `PlaybackState` (`idle` | `loading` | `playing` | `stopped`), `FilterParams` (`cutoffHz`, `gain`), `AudioFileMetadata`
- [ ] T007 [P] Define engine internal types in `src/engine/types.ts` — `AudioGraphNodes`, `EngineConfig`, `AnalyserData` (Pre/Post Float32Array)
- [ ] T008 [P] Scaffold Zustand store in `src/store/useAudioStore.ts` — 빈 스토어 생성, 타입 정의만, 액션 시그니처만 (구현은 Phase 3) [FR-050]
- [ ] T009 [P] Configure Vitest — `vitest.config.ts`, jsdom 환경, `src/` path alias → `npm run test` 실행 가능 (0 tests) [FR-070]
- [ ] T010 [P] Configure Playwright — `playwright.config.ts`, `e2e/` 디렉토리, Chromium 설정 → `npx playwright test` 실행 가능 (0 tests) [FR-072]
- [ ] T011 Create root layout in `src/app/layout.tsx` — Tailwind import, 폰트 설정, `<html lang="ko">`
- [ ] T012 Create empty page in `src/app/page.tsx` — AppShell placeholder 렌더링

**Checkpoint**: `npm run dev` + `npm run lint` + `npm run test` + `npx playwright test` 모두 통과. Constitution I 폴더 구조 검증 완료.

---

## Phase 3: User Story 1 — 오디오 파일 업로드 및 재생 (Priority: P1) 🎯 MVP

**Goal**: 파일 업로드 → 디코딩 → 재생/정지/탐색 → Playhead 60fps 동기화. 이 Phase만 완료해도 "웹 오디오 플레이어"로 동작한다.

**Independent Test**: 오디오 파일을 업로드하고 재생 버튼을 눌러 소리가 출력되는지, 타임라인 클릭으로 Seeking이 되는지 확인.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Unit test for AudioEngine in `src/engine/__tests__/AudioEngine.test.ts` — AudioContext 모킹, 노드 연결 순서 (`Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination`) 검증, `dispose()` 호출 시 리소스 해제 검증 [FR-070]
- [ ] T014 [P] [US1] Unit test for store actions in `src/store/__tests__/useAudioStore.test.ts` — `loadFile`, `play`, `pause`, `seek` 액션이 상태를 올바르게 변경하는지 검증 [FR-070]
- [ ] T015 [P] [US1] Component test for PlaybackControls in `src/components/audio/__tests__/PlaybackControls.test.tsx` — 재생 버튼 클릭 → 스토어 `play` 액션 호출, 정지 버튼 클릭 → `pause` 호출 [FR-071]
- [ ] T016 [P] [US1] Component test for FileUploader in `src/components/audio/__tests__/FileUploader.test.tsx` — 파일 선택 → 스토어 `loadFile` 호출, 로딩 상태 시 인디케이터 표시 [FR-071]
- [ ] T017 [US1] E2E test for playback flow in `e2e/playback.spec.ts` — 파일 업로드 → 디코딩 → 재생 → Seeking → 정지 → 재업로드 전체 흐름 [FR-072]

### Implementation for User Story 1

- [ ] T018 [US1] Implement AudioEngine core in `src/engine/AudioEngine.ts` — `AudioContext` 생성, `decodeAudioData()` 래퍼, 노드 그래프 연결 (`Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination`), `dispose()` 리소스 해제 [FR-001, FR-002, FR-023, FR-024]
- [ ] T019 [US1] Implement AudioContext policy handling in `src/engine/AudioEngine.ts` — `state === 'suspended'` 감지, `resume()` 호출을 사용자 제스처에 연결 [FR-060]
- [ ] T020 [US1] Implement Zustand store — playback state in `src/store/useAudioStore.ts` — `playbackState`, `currentTime`, `duration`, `isLoading`, `error` 상태 + `loadFile`, `play`, `pause`, `seek`, `reset` 액션. 액션 내에서 `AudioEngine` 메서드 호출 [FR-050, FR-051]
- [ ] T021 [US1] Implement useAnimationFrame hook in `src/hooks/useAnimationFrame.ts` — `requestAnimationFrame` 래퍼, callback ref 패턴, 탭 비활성화 복귀 시 `AudioContext.currentTime` 기반 재동기화 [FR-012]
- [ ] T022 [P] [US1] Implement FileUploader component in `src/components/audio/FileUploader.tsx` — `<input type="file">` + 드래그앤드롭 영역, accept=`audio/*`, 스토어 `loadFile` 액션 호출, 로딩 스피너, 에러 메시지 표시 [FR-001, FR-003, FR-061]
- [ ] T023 [P] [US1] Implement PlaybackControls component in `src/components/audio/PlaybackControls.tsx` — 재생/정지 버튼, `playbackState` 구독하여 아이콘 전환, 스토어 `play`/`pause` 호출 [FR-010]
- [ ] T024 [US1] Implement Timeline + Playhead component in `src/components/audio/Timeline.tsx` — 타임라인 바 클릭 → offset 계산 → 스토어 `seek` 호출, `useAnimationFrame` 훅으로 Playhead 60fps 동기화, `currentTime`/`duration` 표시 [FR-011, FR-012]
- [ ] T025 [US1] Implement playback end handling in `src/engine/AudioEngine.ts` — `AudioBufferSourceNode.onended` 콜백 → 스토어 `reset` 액션 (Playhead 초기화, 상태 `stopped`) [FR-013]
- [ ] T026 [US1] Integrate US1 components into page in `src/app/page.tsx` — `FileUploader` + `PlaybackControls` + `Timeline` 배치, 기본 레이아웃

**Checkpoint**: User Story 1의 6개 Acceptance Scenarios 전체 통과. SC-001(3초), SC-002(±16ms), SC-007(메모리 누수). `e2e/playback.spec.ts` green.

---

## Phase 4: User Story 2 + 3 — 필터 + 시각화 (Priority: P2 + P3)

**Goal**: Low-cut 필터 실시간 제어 + Fabfilter Pro-Q 스타일 Pre/Post 3-레이어 스펙트럼 시각화. 필터의 청각적 피드백(P2)과 시각적 피드백(P3)을 동시에 제공하여 Fabfilter 경험을 완성한다.

**Independent Test**: Cutoff 노브를 20Hz→500Hz로 올리면 저음이 귀로 잘려나가고, Canvas에서 Post 곡선만 저음 영역이 낮아지며 Pre 곡선은 유지되는지 확인.

### Tests for User Story 2 + 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US2] Unit test for FilterEngine in `src/engine/__tests__/FilterEngine.test.ts` — 특정 주파수 입력 시 감쇄율 이론치 ±1dB 검증 (SC-006), `setTargetAtTime` Smoothing time constant 범위 검증 [FR-070]
- [ ] T028 [P] [US3] Unit test for frequency utils in `src/utils/__tests__/frequency.test.ts` — Hz→로그 X좌표 변환 정확도, dB→Y좌표 정확도, 로그 주파수 배열(20Hz~20kHz) 분포 검증 [FR-070]
- [ ] T029 [P] [US3] Unit test for smoothing utils in `src/utils/__tests__/smoothing.test.ts` — EMA smoothing 계수별 수렴 속도 검증, 극단 입력(NaN, Infinity) 안전성 [FR-070]
- [ ] T030 [P] [US2] Component test for Knob in `src/components/ui/__tests__/Knob.test.tsx` — 드래그 이벤트 → 스토어 `setCutoff` 호출, 값 범위 클램핑(20Hz~20kHz) [FR-071]
- [ ] T031 [P] [US3] Component test for SpectrumCanvas in `src/components/audio/__tests__/SpectrumCanvas.test.tsx` — Canvas ref 존재, `requestAnimationFrame` 호출 확인 [FR-071]
- [ ] T032 [US2] E2E test for filter interaction in `e2e/filter.spec.ts` — Cutoff 조작 → 오디오 변화 확인, 급격한 파라미터 변경 시 팝 노이즈 없음 [FR-072]
- [ ] T033 [US3] E2E test for visualization in `e2e/visualization.spec.ts` — Canvas 요소 존재, Pre/Post 스펙트럼 렌더링 확인 (Canvas pixel 검사), Cutoff 변경 시 Post 곡선 변화 [FR-072]
- [ ] T034 [US3] E2E test for performance in `e2e/performance.spec.ts` — 재생 + 시각화 활성 상태에서 메인 스레드 점유율 15% 이하 측정 (SC-004), 메모리 누수 검증 (SC-007) [FR-072]

### Implementation for User Story 2 (Filter)

- [ ] T035 [US2] Implement FilterEngine in `src/engine/FilterEngine.ts` — `BiquadFilterNode` 생성(`highpass`), `setCutoff(hz)` with `setTargetAtTime` Smoothing, `setQ(value)`, `getFrequencyResponse(freqArray)` 래퍼 [FR-020, FR-021]
- [ ] T036 [US2] Implement GainNode control in `src/engine/AudioEngine.ts` — `setGain(value)` with `setTargetAtTime` Smoothing, 0~1 범위 클램핑 [FR-022]
- [ ] T037 [US2] Extend Zustand store — filter state in `src/store/useAudioStore.ts` — `cutoffHz` (default: 20), `gain` (default: 1) 상태 + `setCutoff`, `setGain` 액션 → `FilterEngine`/`AudioEngine` 메서드 호출 [FR-050]
- [ ] T038 [P] [US2] Implement Knob component in `src/components/ui/Knob.tsx` — 원형 드래그 인터랙션 (수직 드래그→값 변경), Framer Motion `motion.div` 회전 애니메이션, min/max/step props, 현재 값 표시 라벨
- [ ] T039 [US2] Implement FilterControls panel in `src/components/audio/FilterControls.tsx` — Cutoff Knob (20Hz~20kHz, 로그 스케일) + Gain Knob (0~1, 선형) + 수치 readout, 스토어 `setCutoff`/`setGain` 연결 [FR-020, FR-022]

### Implementation for User Story 3 (Visualization)

- [ ] T040 [US3] Implement AnalyserBridge in `src/engine/AnalyserBridge.ts` — Pre/Post `AnalyserNode` 참조 보유, `getPreFrequencyData(): Float32Array`, `getPostFrequencyData(): Float32Array`, `fftSize` 설정 [FR-024]
- [ ] T041 [P] [US3] Implement frequency utils in `src/utils/frequency.ts` — `hzToLogX(hz, width): number`, `dbToY(db, height, minDb, maxDb): number`, `createLogFrequencyArray(startHz, endHz, count): Float32Array` [FR-030]
- [ ] T042 [P] [US3] Implement smoothing utils in `src/utils/smoothing.ts` — `applyEMA(current: Float32Array, previous: Float32Array, alpha: number): Float32Array` (exponential moving average) [FR-031]
- [ ] T043 [US3] Implement useSpectrumData hook in `src/hooks/useSpectrumData.ts` — `AnalyserBridge` → `getPreFrequencyData()`/`getPostFrequencyData()` → Smoothing 적용 → `{ preData, postData }` 반환. `useAnimationFrame` 내에서 매 프레임 호출 [FR-030]
- [ ] T044 [US3] Implement SpectrumCanvas component in `src/components/audio/SpectrumCanvas.tsx` — 단일 Canvas, `useSpectrumData` 구독, 3-레이어 합성 렌더링 [FR-030, FR-031, FR-032]:
  - Layer 1: Pre-EQ spectrum (ghost, `globalAlpha: 0.3`, 어두운 색)
  - Layer 2: Filter response curve (`getFrequencyResponse()`, 영역 채우기)
  - Layer 3: Post-EQ spectrum (primary, `globalAlpha: 1.0`, 밝은 색)
  - X축: 로그 스케일 20Hz~20kHz, Y축: dB
- [ ] T045 [P] [US3] Implement PeakLED component in `src/components/ui/PeakLED.tsx` — Post-EQ `AnalyserNode` 시간 도메인 데이터에서 피크 > 1.0 감지 → Framer Motion 빨간 LED 페이드, 자동 리셋 타이머 [FR-033]
- [ ] T046 [US2+US3] Integrate Filter + Visualization into page in `src/app/page.tsx` — `SpectrumCanvas` + `FilterControls` + `PeakLED` 배치, 기존 US1 컴포넌트와 조합

**Checkpoint**: User Story 2의 4개 + User Story 3의 5개 Acceptance Scenarios 전체 통과. SC-003(50ms), SC-004(15%), SC-005(팝 없음), SC-006(±1dB). `e2e/filter.spec.ts` + `e2e/visualization.spec.ts` + `e2e/performance.spec.ts` green.

---

## Phase 5: User Story 4 — 노드 그래프 가시화 (Priority: P4)

**Goal**: React Flow 기반 인터랙티브 오디오 노드 그래프. 신호 흐름 방향을 엣지 애니메이션으로 표현하고, 노드 안에 실시간 파라미터 값을 표시한다.

**Independent Test**: 노드 그래프 패널을 열면 6개 노드가 좌→우로 연결되어 표시되고, 재생 시 엣지 애니메이션이 활성화되는지 확인.

### Tests for User Story 4 ⚠️

- [ ] T047 [P] [US4] Component test for AudioNodeGraph in `src/components/graph/__tests__/AudioNodeGraph.test.tsx` — 노드 6개 (`Source`, `Analyser(Pre)`, `Filter`, `Gain`, `Analyser(Post)`, `Destination`) 렌더링, 엣지 5개 연결 [FR-071]
- [ ] T048 [P] [US4] Component test for FilterNode in `src/components/graph/__tests__/FilterNode.test.tsx` — 스토어 `cutoffHz` 변경 시 노드 내 표시 값 업데이트 [FR-071]

### Implementation for User Story 4

- [ ] T049 [P] [US4] Implement SourceNode in `src/components/graph/nodes/SourceNode.tsx` — 파일명 표시, `playbackState` 구독하여 재생/정지 아이콘 [FR-040]
- [ ] T050 [P] [US4] Implement FilterNode in `src/components/graph/nodes/FilterNode.tsx` — `cutoffHz` 실시간 표시, highpass 라벨 [FR-040, FR-042]
- [ ] T051 [P] [US4] Implement GainNodeDisplay in `src/components/graph/nodes/GainNodeDisplay.tsx` — `gain` 값 실시간 표시, dB 변환 [FR-040, FR-042]
- [ ] T052 [P] [US4] Implement AnalyserNodeDisplay in `src/components/graph/nodes/AnalyserNodeDisplay.tsx` — Pre/Post 라벨, 미니 레벨 바 (MAY) [FR-040]
- [ ] T053 [P] [US4] Implement DestinationNode in `src/components/graph/nodes/DestinationNode.tsx` — 스피커 아이콘 [FR-040]
- [ ] T054 [US4] Implement SignalFlowEdge in `src/components/graph/edges/SignalFlowEdge.tsx` — `animated` prop, `playbackState === 'playing'`일 때만 애니메이션 활성화 [FR-041]
- [ ] T055 [US4] Implement AudioNodeGraph in `src/components/graph/AudioNodeGraph.tsx` — React Flow `<ReactFlow>` 초기화, 6개 노드 정의 (수동 좌→우 좌표 배치), 5개 엣지 연결, 커스텀 nodeTypes/edgeTypes 등록, MiniMap/Controls (선택) [FR-040]
- [ ] T056 [US4] Implement AppShell layout in `src/components/layout/AppShell.tsx` — 상단: SpectrumCanvas, 중단: FilterControls + PlaybackControls + Timeline, 하단: AudioNodeGraph (접이식 패널). 반응형 Tailwind 레이아웃
- [ ] T057 [US4] Integrate AppShell into page — `src/app/page.tsx`에서 AppShell로 전체 교체, 모든 컴포넌트 통합

**Checkpoint**: User Story 4의 4개 Acceptance Scenarios 통과. 노드 그래프 DOM 렌더링이 메인 스레드 15% 예산 내.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 스토리에 걸친 품질 개선, 접근성, 최종 검증

- [ ] T058 [P] Keyboard accessibility
  - 전역 키보드 단축키 `src/hooks/useGlobalKeyboard.ts` — Space 재생/정지, ←/→ ±5초 seek, Shift+←/→ ±15초 seek. `window.addEventListener("keydown")` 패턴, INPUT/TEXTAREA/slider 포커스 시 무시
  - Timeline `role="slider"` + `aria-valuemin/max/now/text` + `onKeyDown` + `tabIndex` 추가. `SEEK_STEP`/`SEEK_STEP_SHIFT` 상수를 useGlobalKeyboard와 공유
  - SpectrumCanvas `role="img"` + `aria-label` 추가
  - PeakLED `aria-label` 추가, `focus:outline-none` 제거
  - 전역 `:focus-visible` 스타일 (`globals.css`) — 시안 링 + 글로우, React Flow 노드 제외
- [ ] T059 [P] Responsive layout tuning — 그래프 패널 `h-[140px] sm:h-[180px]` 반응형 높이, Play 버튼 `h-11 w-11` (44px WCAG 터치 타겟)
- [ ] T060 [P] Error boundary — `src/app/error.tsx` Next.js App Router error boundary, Fabfilter 스타일 에러 UI + `reset()` 재시도
- [ ] T061 Performance audit — 기존 zero-allocation 패턴 검증 (AnalyserBridge 버퍼 재사용, Timeline/PeakLED ref 직접 DOM 업데이트), SC-004 E2E 통과
- [ ] T061-R [P] Refactor: `src/utils/formatting.ts` 공통 유틸 추출 — `formatHz`, `gainToDb`, `formatDb`, `formatTime`. FilterControls, FilterNode, GainNodeDisplay, Timeline 중복 제거
- [ ] T061-R [P] Refactor: SpectrumCanvas 드로잉 로직 분리 — `src/hooks/useSpectrumRenderer.ts` (273줄 → 62줄 컴포넌트 + 225줄 훅)
- [ ] T062 Cross-browser validation — `AudioEngine.ts`에 `globalThis.AudioContext ?? webkitAudioContext` 폴백 (Safari 호환)
- [ ] T063 Run full E2E suite — Vitest 13 files / 182 tests + Playwright 4 files / 26 tests = 총 208 tests green
  - `e2e/playback.spec.ts` 셀렉터 수정: Phase 5 노드 그래프 추가로 `getByText("filename")`이 SourceNode와 FileUploader 두 곳에 매칭 → `getByRole("button", { name })` 패턴으로 전환, `.tabular-nums` → `.text-right.tabular-nums`로 구체화

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)                    ← 즉시 시작 가능
  │
  ▼
Phase 2 (Foundation)               ← Setup 완료 후. 모든 US를 BLOCK
  │
  ▼
Phase 3 (US1: Playback — P1)      ← Foundation 완료 후. MVP.
  │
  ▼
Phase 4 (US2+US3: Filter+Viz)     ← US1 완료 후 (AudioEngine 필요)
  │
  ▼
Phase 5 (US4: Node Graph)         ← US2+US3 완료 후 (전체 노드 존재해야 가시화 의미 있음)
  │
  ▼
Phase 6 (Polish)                   ← 모든 US 완료 후
```

### User Story Dependencies

- **US1 (P1)**: Foundation 완료 후 즉시 시작. 다른 US에 의존하지 않음.
- **US2 (P2)**: US1의 `AudioEngine` + `useAudioStore` 필요. US1 완료 후 시작.
- **US3 (P3)**: US2의 `FilterEngine` + `AnalyserBridge` 필요. US2와 동일 Phase에서 병행.
- **US4 (P4)**: US1~3의 모든 노드가 존재해야 의미 있는 그래프. Phase 4 완료 후 시작.

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Engine (`src/engine/`) before Store (`src/store/`)
3. Store before Components (`src/components/`)
4. Utils (`src/utils/`) can parallel with Engine
5. Hooks (`src/hooks/`) after Engine, before Components
6. Integration (page.tsx) after all components ready

### Parallel Opportunities

**Phase 2 (Foundation)**:

```
T005 (scaffolding) → then in parallel:
  T006 (shared types) | T007 (engine types) | T008 (store scaffold)
  T009 (Vitest)       | T010 (Playwright)
```

**Phase 3 (US1) — Tests**:

```
T013 (AudioEngine test) | T014 (store test) | T015 (PlaybackControls test) | T016 (FileUploader test)
```

**Phase 3 (US1) — Implementation**:

```
T018 (AudioEngine) → T019 (AudioContext policy) → T020 (store) → T021 (useAnimationFrame)
                                                                         │
T022 (FileUploader) ─ parallel ─ T023 (PlaybackControls)                 │
                                                                         ▼
                                                               T024 (Timeline) → T025 (onended) → T026 (integrate)
```

**Phase 4 (US2+US3) — Tests**:

```
T027 (FilterEngine) | T028 (frequency) | T029 (smoothing) | T030 (Knob) | T031 (SpectrumCanvas)
```

**Phase 4 (US2+US3) — Implementation**:

```
T035 (FilterEngine) ─ parallel ─ T041 (frequency utils) ─ parallel ─ T042 (smoothing utils)
T036 (GainNode)     ─ parallel ─ T040 (AnalyserBridge)
        │                                │
        ▼                                ▼
T037 (store extend) ──────────→ T043 (useSpectrumData hook)
        │                                │
        ▼                                ▼
T038 (Knob) ─ parallel ─ T045 (PeakLED)
        │                                │
        ▼                                ▼
T039 (FilterControls) ──────→ T044 (SpectrumCanvas) → T046 (integrate)
```

**Phase 5 (US4) — Implementation**:

```
T049 (SourceNode) | T050 (FilterNode) | T051 (GainNode) | T052 (AnalyserNode) | T053 (DestinationNode)
                                       ↓ (all complete)
                              T054 (SignalFlowEdge) → T055 (AudioNodeGraph) → T056 (AppShell) → T057 (integrate)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundation
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: `e2e/playback.spec.ts` green, SC-001/SC-002/SC-007 통과
5. Deploy/Demo — "웹 오디오 플레이어"

### Fabfilter Experience (User Story 1 + 2 + 3)

1. Phase 1~3 완료 (MVP)
2. Phase 4: Filter + Visualization
3. **STOP and VALIDATE**: 전체 E2E suite green, SC-003~SC-006 통과
4. Deploy/Demo — "Fabfilter 스타일 오디오 프로세서"

### Full Product (All User Stories)

1. Phase 1~4 완료
2. Phase 5: Node Graph
3. Phase 6: Polish
4. **FINAL VALIDATION**: 전체 9개 SC 통과, cross-browser 확인

---

## Notes

- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red → Green → Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution Check: 매 Phase 시작 전 `01-constitution.md` 원칙 준수 확인
