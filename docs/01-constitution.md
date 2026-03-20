# Fabfilter Web Constitution

## Core Principles

### I. Audio-First Architecture

모든 기능은 **Web Audio API의 신호 흐름(Signal Flow)** 을 중심으로 설계한다.
UI는 오디오 엔진의 상태를 반영하는 뷰(View)일 뿐, 오디오 로직을 직접 제어하지 않는다.

- 오디오 그래프(`AudioContext → SourceNode → AnalyserNode(Pre) → BiquadFilterNode → GainNode → AnalyserNode(Post) → Destination`)는 단일 모듈에서 생성·관리한다. Pre/Post 두 개의 AnalyserNode를 통해 필터 적용 전후의 신호를 동시에 분석한다.
- 파라미터 변경은 반드시 `AudioParam` 스케줄링 메서드(`setTargetAtTime`, `linearRampToValueAtTime`)를 통해 수행하여 팝/클릭 노이즈를 방지한다.
- `AudioContext`와 `AudioBufferSourceNode`의 생명주기를 명시적으로 관리하여 메모리 누수를 차단한다.
- 노드 간 연결 상태와 데이터 흐름은 **React Flow**를 통해 시각적으로 가시화하여, 사용자가 신호 경로를 직관적으로 파악할 수 있도록 한다.

### II. Single Source of Truth (NON-NEGOTIABLE)

재생 상태, 현재 시간, 필터 파라미터, 게인 값 등 모든 오디오 상태는 **Zustand 스토어 하나**에서 관리한다.

- UI 컴포넌트는 스토어를 구독(subscribe)하여 상태를 읽고, 액션(action)을 통해 상태를 변경한다.
- 오디오 엔진은 스토어의 상태 변경을 감지하여 `AudioParam`을 동기화한다.
- 컴포넌트 로컬 state는 순수 UI 관심사(hover, focus, 드래그 중 임시 좌표 등)에만 사용한다.

### III. 60fps Visual Fidelity

시각화(FFT 스펙트럼, 타임라인 Playhead, 응답 곡선)는 **Canvas 2D API + requestAnimationFrame** 기반으로 구현한다.
노드 그래프(오디오 신호 흐름 토폴로지)는 **React Flow**로 구현한다.

- 스펙트럼 시각화는 Fabfilter Pro-Q 스타일의 **3-레이어 합성**으로 구현한다:
  - **Pre-EQ 스펙트럼** (어두운 색/ghost): `AnalyserNode(Pre)`에서 추출한 필터 적용 전 원본 신호
  - **Post-EQ 스펙트럼** (밝은 색/primary): `AnalyserNode(Post)`에서 추출한 필터 적용 후 처리된 신호
  - **필터 응답 곡선** (선/영역): `BiquadFilterNode.getFrequencyResponse()`로 계산한 필터 전달 함수
- 두 AnalyserNode 모두 `getFloatFrequencyData()`를 매 프레임 호출하여 실시간 주파수 데이터를 추출한다.
- Canvas 드로잉은 메인 스레드 점유율 15% 이하를 목표로 최적화한다.
- 모든 FFT 데이터에 Smoothing을 적용하여 Fabfilter 스타일의 부드러운 곡선으로 렌더링한다.
- 노드 그래프는 정적 토폴로지이므로 60fps 실시간 렌더링이 불필요하며, Canvas 시각화와 역할을 명확히 분리한다.
- Framer Motion은 Canvas 외부의 UI 애니메이션(노브 인터랙션, 패널 전환, 피크 경고 등)에 사용한다.

### IV. Three-Layer Testing Strategy

테스트는 검증 대상의 특성에 따라 **3계층**으로 분리한다. 각 계층은 실행 환경과 검증 범위가 다르다.

- **Unit (Vitest)**: `engine/` 수학 로직(필터 감쇄율, Smoothing 계수, 주파수 변환), `store/` 액션, `utils/` 순수 함수. 모킹된 환경에서 실행. 매 커밋마다 실행한다.
- **Component (Vitest + @testing-library/react)**: UI 컴포넌트의 렌더링, 이벤트 핸들링, 스토어 연결. `AudioContext`는 모킹한다. 매 커밋마다 실행한다.
- **E2E (Playwright)**: 실제 브라우저에서 오디오 재생, Canvas 렌더링, Playhead 동기화, 성능 예산(메인 스레드 15%), 메모리 누수를 검증한다. PR 단위로 실행한다.

Unit/Component에서 검증할 수 없는 항목 — `AudioContext` 타이밍, `requestAnimationFrame` 동기화, Canvas 시각적 정확성, `performance.memory` 기반 누수 감지 — 은 반드시 E2E 테스트로 커버한다.

Red → Green → Refactor 사이클을 따른다.

### V. Graceful Degradation & Safety

사용자 경험을 해치는 엣지 케이스를 사전에 방어한다.

- 오디오 신호가 0dB을 초과할 때 시각적 경고(Clipping Indicator)를 즉시 표시한다.
- 파일 디코딩 중 UI가 블로킹되지 않도록 비동기 처리하고, 로딩 상태를 시각적으로 전달한다.
- 재생 종료 시 상태를 초기화하거나 처음으로 복귀하는 대응 로직을 반드시 포함한다.
- `AudioContext`가 브라우저 정책으로 중단(suspended)된 경우 사용자 제스처를 통한 resume 흐름을 제공한다.

## Technology Stack

| Category      | Technology                       | Version         | Purpose                                                  |
| ------------- | -------------------------------- | --------------- | -------------------------------------------------------- |
| Framework     | **Next.js**                      | latest          | App Router 기반 SPA, SSR/SSG 지원                        |
| Styling       | **Tailwind CSS**                 | latest          | 유틸리티 퍼스트 스타일링                                 |
| Animation     | **Framer Motion**                | latest          | UI 컴포넌트 애니메이션, 인터랙션 전환                    |
| State         | **Zustand**                      | latest          | 경량 전역 상태 관리 (오디오 ↔ UI 동기화)                 |
| Linting       | **ESLint**                       | latest          | 코드 품질 및 일관성                                      |
| Formatting    | **Prettier**                     | latest          | 코드 포맷팅 자동화                                       |
| Testing       | **Vitest**                       | latest          | Unit/Component 테스트 (오디오 엔진 수학, 스토어, UI)     |
| Testing       | **@testing-library/react**       | latest          | 컴포넌트 테스트 (Vitest 환경에서 실행)                   |
| Testing       | **Playwright**                   | latest          | E2E 테스트 (실제 브라우저: 오디오, Canvas, 성능, 메모리) |
| Node Graph    | **React Flow (`@xyflow/react`)** | latest          | 오디오 노드 그래프 가시화                                |
| Audio         | **Web Audio API**                | (브라우저 내장) | 오디오 디코딩, 필터링, 분석, 재생                        |
| Visualization | **Canvas 2D API**                | (브라우저 내장) | FFT 스펙트럼, 응답 곡선, 타임라인 렌더링                 |

### 라이브러리 선택 기준

- **Zustand 선택 이유**: 오디오 상태는 컴포넌트 트리 외부(AudioContext)에서도 읽고 써야 한다. Zustand는 React 외부에서도 `getState()`/`setState()`로 접근 가능하며, 보일러플레이트가 최소화되어 오디오 엔진 코드의 가독성을 유지한다.
- **Canvas 직접 사용 이유**: 60fps FFT 시각화는 DOM 기반 라이브러리의 오버헤드를 감당할 수 없다. Canvas 2D API를 직접 사용하여 드로잉 제어권을 확보한다.
- **Framer Motion 선택 이유**: Canvas 외부의 UI 요소(노브 회전, 패널 슬라이드, 피크 경고 페이드)에 선언적 애니메이션을 적용하여 코드 복잡도를 낮춘다.
- **React Flow 선택 이유**: 노드가 표준 React 컴포넌트이므로 노브, 미터 등 커스텀 UI를 노드 안에 직접 삽입할 수 있다. 공식 Web Audio API 튜토리얼이 존재하며, 4~8개 노드 규모에서 DOM 기반 렌더링의 성능 부담이 없다. ([ADR 참조](adr/adr-node-graph-visualization.md))

## Development Workflow

### 디렉토리 구조 원칙

```
src/
├── app/                  # Next.js App Router 페이지
├── components/
│   ├── ui/               # 범용 UI 컴포넌트 (Button, Slider 등)
│   ├── audio/            # 오디오 관련 UI (Waveform, Spectrum, Knob 등)
│   ├── graph/            # React Flow 노드 그래프 (커스텀 노드, 엣지)
│   └── layout/           # 레이아웃 컴포넌트
├── engine/               # Web Audio API 래퍼 (AudioContext, 필터, 분석기)
├── store/                # Zustand 스토어
├── hooks/                # 커스텀 React 훅
├── utils/                # 순수 유틸리티 함수
└── types/                # TypeScript 타입 정의
e2e/                      # Playwright E2E 테스트 (src/ 외부)
├── playback.spec.ts      # 파일 업로드, 재생, Seeking
├── filter.spec.ts        # 필터 조작, Smoothing 검증
├── visualization.spec.ts # Canvas 렌더링, Pre/Post 스펙트럼
└── performance.spec.ts   # 메인 스레드 점유율, 메모리 누수
```

- `engine/` 디렉토리는 React에 의존하지 않는다. 순수 TypeScript로 Web Audio API를 래핑한다.
- `store/`는 `engine/`과 `components/` 사이의 유일한 통신 채널이다.
- 컴포넌트는 `engine/`을 직접 import하지 않는다. 반드시 스토어 액션을 통해 간접 제어한다.

### 코드 품질 게이트

1. **ESLint**: `next lint` 통과 필수. 커스텀 규칙은 `.eslintrc`에 정의한다.
2. **Prettier**: 저장 시 자동 포맷팅. 설정은 `.prettierrc`에 정의한다.
3. **TypeScript**: `strict` 모드 활성화. `any` 타입 사용을 금지한다.
4. **Vitest**: Unit/Component 테스트가 매 커밋마다 통과해야 한다.
5. **Playwright**: E2E 테스트가 PR 단위로 통과해야 머지할 수 있다.

### 커밋 컨벤션

- Conventional Commits 형식을 따른다: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- 오디오 엔진 변경은 반드시 `engine` 스코프를 사용한다: `feat(engine): add low-cut filter smoothing`

## Governance

이 Constitution은 프로젝트의 모든 코드 리뷰 및 기술적 의사결정의 최상위 기준이다.

- 모든 PR은 이 Constitution의 원칙을 준수하는지 검증해야 한다.
- Constitution 수정은 문서화 + 승인 + 마이그레이션 계획을 요구한다.
- 원칙 간 충돌이 발생하면 **Audio-First > Single Source of Truth > 60fps Visual Fidelity** 순으로 우선한다.
- 복잡성 도입은 반드시 정당화되어야 한다 — YAGNI 원칙을 준수한다.

**Version**: 1.3.0 | **Ratified**: 2026-03-20 | **Last Amended**: 2026-03-20
