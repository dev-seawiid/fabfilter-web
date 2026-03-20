# Feature Specification: Fabfilter Web Audio Processor

**Feature Branch**: `main`
**Created**: 2026-03-20
**Status**: Draft
**Input**: Fabfilter 스타일의 브라우저 기반 오디오 프로세서 — Low-cut 필터, 실시간 FFT 시각화, 노드 그래프 가시화

## User Scenarios & Testing _(mandatory)_

<!--
  각 User Story는 독립적으로 구현·테스트·배포 가능한 MVP 슬라이스이다.
  P1만 구현해도 "오디오 파일을 재생할 수 있는 웹 플레이어"가 동작해야 한다.
  Constitution Principle I(Audio-First), II(Single Source of Truth) 준수.
-->

### User Story 1 — 오디오 파일 업로드 및 재생 (Priority: P1)

사용자는 로컬 오디오 파일(.wav, .mp3, .flac 등)을 업로드하고, 브라우저에서 즉시 재생·정지·탐색할 수 있다. 타임라인 위의 Playhead가 현재 재생 위치를 실시간으로 표시한다.

**Why this priority**: 모든 후속 기능(필터, 시각화, 노드 그래프)은 오디오 재생이 동작해야 의미가 있다. 이 스토리가 프로젝트의 기반(foundation)이다.

**Independent Test**: 파일을 업로드하고 재생 버튼을 눌러 소리가 출력되는지, 타임라인을 클릭하여 원하는 위치로 이동하는지 확인. 이것만으로 "웹 오디오 플레이어"라는 독립적 가치를 전달한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 페이지에 접속한 상태, **When** 오디오 파일(.wav, .mp3, .flac)을 파일 입력에 드롭/선택, **Then** 파일이 `ArrayBuffer`로 읽힌 후 `decodeAudioData`를 통해 디코딩되고, 디코딩 중 로딩 인디케이터가 표시된다.
2. **Given** 오디오 파일이 디코딩 완료된 상태, **When** 재생 버튼을 클릭, **Then** 오디오가 즉시 재생되고 Playhead가 60fps로 현재 위치를 표시한다.
3. **Given** 오디오가 재생 중인 상태, **When** 정지 버튼을 클릭, **Then** 오디오가 즉시 정지하고 Playhead가 현재 위치에서 멈춘다.
4. **Given** 오디오가 재생 중인 상태, **When** 타임라인의 임의 지점을 클릭, **Then** 해당 offset부터 오디오가 즉시 재개되고 Playhead가 해당 위치로 점프한다.
5. **Given** 오디오 재생이 끝까지 도달한 상태, **When** 재생이 종료, **Then** Playhead가 처음으로 복귀하고 재생 상태가 정지(stopped)로 초기화된다.
6. **Given** 이미 파일이 로드된 상태, **When** 새로운 파일을 업로드, **Then** 기존 `AudioContext`와 `AudioBufferSourceNode`가 명시적으로 해제되고 새 파일이 로드된다 (메모리 누수 없음).

---

### User Story 2 — Low-cut 필터 실시간 제어 (Priority: P2)

사용자는 Low-cut(High-pass) 필터의 Cutoff 주파수를 노브 또는 슬라이더로 실시간 조절하고, 필터를 통과한 오디오를 즉시 들을 수 있다. 볼륨(Gain)도 정밀하게 제어할 수 있다.

**Why this priority**: Fabfilter의 핵심 가치는 "오디오 필터링"이다. 재생(P1) 위에 필터를 추가해야 프로젝트의 정체성이 완성된다. P1 없이는 동작할 수 없으므로 P2이다.

**Independent Test**: 오디오를 재생한 상태에서 Cutoff 노브를 20Hz → 500Hz로 올리면 저음이 잘려나가는 것을 귀로 확인. Gain 노브로 볼륨을 조절할 수 있는지 확인.

**Acceptance Scenarios**:

1. **Given** 오디오가 재생 중인 상태, **When** Cutoff 노브를 20Hz에서 500Hz로 조절, **Then** `BiquadFilterNode(highpass)`의 frequency가 실시간으로 변경되어 500Hz 이하의 저주파가 감쇄된다.
2. **Given** 필터가 적용된 상태, **When** Cutoff 값이 급격히 변경(예: 20Hz → 2000Hz 즉시 드래그), **Then** `setTargetAtTime` Smoothing이 적용되어 팝/클릭 노이즈가 발생하지 않는다.
3. **Given** 오디오가 재생 중인 상태, **When** Gain 노브를 조절, **Then** `GainNode`의 gain 값이 0~1 범위에서 정밀하게 변경되어 볼륨이 즉시 반영된다.
4. **Given** 재생 중 Seeking이 발생하는 상태, **When** 타임라인을 클릭하여 위치 이동, **Then** 필터 파라미터가 유지된 채로 새 위치에서 재생이 시작되고, Smoothing이 적용되어 팝 노이즈가 없다.

---

### User Story 3 — Pre/Post 스펙트럼 비교 및 응답 곡선 시각화 (Priority: P3)

사용자는 하나의 Canvas 위에서 필터 적용 전(Pre-EQ)과 적용 후(Post-EQ)의 주파수 스펙트럼을 동시에 비교하고, 필터 응답 곡선을 오버레이하여 필터가 신호에 미치는 영향을 시각적으로 즉시 파악할 수 있다. Fabfilter Pro-Q 스타일의 3-레이어 합성 시각화이다.

**Why this priority**: 시각적 피드백은 필터 조작의 결과를 "보여주는" 역할이다. 필터(P2) 없이는 보여줄 곡선이 없으므로 P3이다. 하지만 Pre/Post 비교야말로 Fabfilter 경험의 핵심이므로 P4보다 우선한다.

**Independent Test**: 오디오 재생 + 필터 적용 상태에서 Canvas에 Pre(어두운 곡선)와 Post(밝은 곡선) 스펙트럼이 동시에 표시되는지, Cutoff를 올리면 Post 곡선만 저음 영역이 낮아지고 Pre 곡선은 변하지 않는지 육안 확인.

**Acceptance Scenarios**:

1. **Given** 오디오가 재생 중이고 필터가 비활성(Cutoff 20Hz) 상태, **When** Canvas 영역을 관찰, **Then** Pre-EQ 스펙트럼(ghost/어두운 색)과 Post-EQ 스펙트럼(primary/밝은 색)이 거의 동일한 곡선으로 겹쳐 표시된다. 두 곡선 모두 로그 스케일 X축(20Hz~20kHz) 위에 60fps로 업데이트된다.
2. **Given** 오디오가 재생 중인 상태, **When** Cutoff를 20Hz → 500Hz로 올리면, **Then** Pre-EQ 스펙트럼(ghost)은 변하지 않고, Post-EQ 스펙트럼(primary)의 500Hz 이하 영역이 감쇄되어, 두 곡선의 차이가 시각적으로 즉시 드러난다.
3. **Given** 필터가 적용된 상태, **When** Canvas를 관찰, **Then** 필터 응답 곡선(`BiquadFilterNode.getFrequencyResponse()`)이 세 번째 레이어로 오버레이되어 필터의 전달 함수 모양(감쇄 기울기, Cutoff 지점)을 선 또는 영역으로 표시한다.
4. **Given** 오디오 신호가 0dB을 초과하는 상태, **When** Post-EQ AnalyserNode에서 Clipping이 감지, **Then** Peak LED 경고가 즉시 표시되어 사용자에게 Clipping 위험을 알린다.
5. **Given** Pre/Post 스펙트럼 + 응답 곡선 + 타임라인이 동시에 렌더링되는 상태, **When** 성능을 측정, **Then** Canvas 드로잉 부하가 메인 스레드 점유율 15% 이하를 유지한다 (AnalyserNode 2개의 `getFloatFrequencyData()` 호출 포함).

---

### User Story 4 — 오디오 노드 그래프 가시화 (Priority: P4)

사용자는 `Source → Filter → Analyzer → Destination`으로 이어지는 Web Audio API 노드의 연결 상태와 신호 흐름 방향을 인터랙티브 노드 그래프로 확인할 수 있다.

**Why this priority**: 노드 그래프는 Observability 기능으로, 필터와 시각화가 동작한 후에 "어떻게 연결되어 있는가"를 보여주는 보조 뷰이다. 핵심 오디오 경험(P1~P3)이 완성된 후 추가한다.

**Independent Test**: 페이지에서 노드 그래프 패널을 열면 현재 오디오 체인의 노드들이 좌→우로 연결된 플로우 다이어그램으로 표시되는지, 엣지 애니메이션으로 신호 방향을 확인할 수 있는지 검증.

**Acceptance Scenarios**:

1. **Given** 오디오 파일이 로드된 상태, **When** 노드 그래프 패널을 활성화, **Then** React Flow 기반의 노드 그래프에 `SourceNode`, `AnalyserNode(Pre)`, `BiquadFilterNode`, `GainNode`, `AnalyserNode(Post)`, `Destination`이 좌→우 방향으로 연결되어 표시된다.
2. **Given** 노드 그래프가 표시된 상태, **When** 오디오가 재생 중, **Then** 엣지에 애니메이션(`animated` prop)이 적용되어 신호 흐름 방향이 시각적으로 전달된다.
3. **Given** 노드 그래프의 Filter 노드를 관찰하는 상태, **When** Cutoff 노브를 조절, **Then** 노드 안에 표시된 현재 Cutoff 주파수 값이 실시간으로 업데이트된다.
4. **Given** 노드 그래프가 렌더링된 상태, **When** 성능을 측정, **Then** 노드 그래프 DOM 렌더링이 전체 시각화 성능 예산(메인 스레드 15%) 내에서 처리된다.

---

### Edge Cases

- **지원하지 않는 파일 형식**: 브라우저가 디코딩할 수 없는 포맷(예: .ogg on Safari)을 업로드하면 어떻게 되는가? → 명확한 에러 메시지 표시, `decodeAudioData` reject 핸들링
- **매우 큰 파일**: 100MB+ 오디오 파일을 업로드하면 메모리가 부족해지는가? → 파일 크기 제한 또는 경고 표시 검토
- **빠른 연속 Seeking**: 1초 내에 타임라인을 10회 이상 클릭하면 `AudioBufferSourceNode` 생성/파괴가 정상적으로 처리되는가? → 디바운싱 또는 큐잉 전략
- **AudioContext 정책**: iOS Safari 등에서 사용자 제스처 없이 `AudioContext`가 suspended 상태일 때 적절한 resume 흐름을 제공하는가?
- **탭 비활성화**: 브라우저 탭이 백그라운드로 전환되면 `requestAnimationFrame`이 중단되는데, 오디오 재생은 계속되고 탭 복귀 시 Playhead가 정확한 위치로 동기화되는가?
- **Cutoff 극단값**: Cutoff를 20Hz(최소) 또는 20,000Hz(최대)로 설정하면 필터가 안정적으로 동작하는가?
- **Gain 0 상태에서 Clipping 감지**: Gain이 0일 때 Peak LED가 잘못 표시되지 않는가? → Clipping 감지는 Post-EQ AnalyserNode(GainNode 이후)에서 수행
- **AnalyserNode 2개의 성능 비용**: Pre/Post 두 AnalyserNode에서 매 프레임 `getFloatFrequencyData()`를 호출하는 비용이 15% 메인 스레드 예산 내에서 처리 가능한가?
- **동시 파라미터 변경**: Cutoff와 Gain을 동시에 빠르게 조절해도 Smoothing이 각 파라미터에 독립적으로 적용되는가?

## Requirements _(mandatory)_

### Functional Requirements

#### Data Ingestion (FR-00x)

- **FR-001**: 시스템은 `<input type="file">`을 통해 오디오 파일을 `ArrayBuffer`로 읽고, `AudioContext.decodeAudioData()`로 디코딩할 수 있어야 한다 (MUST).
- **FR-002**: 시스템은 새 파일 업로드 시 기존 `AudioContext`와 `AudioBufferSourceNode`를 명시적으로 해제하여 메모리 누수를 방지해야 한다 (MUST).
- **FR-003**: 시스템은 디코딩 중 비동기 처리를 통해 UI 블로킹을 방지하고, 로딩 상태를 시각적으로 표시해야 한다 (MUST).

#### Playback & Seeking (FR-01x)

- **FR-010**: 시스템은 `AudioBufferSourceNode.start()`/`AudioContext.suspend()`를 사용하여 지연 없는 재생/정지 컨트롤을 제공해야 한다 (MUST).
- **FR-011**: 시스템은 타임라인 클릭 시 해당 offset부터 오디오를 즉시 재개해야 한다 (MUST).
- **FR-012**: 시스템은 `AudioContext.currentTime`과 `requestAnimationFrame`을 결합하여 Playhead를 60fps로 동기화해야 한다 (MUST).
- **FR-013**: 시스템은 재생 종료 시 상태를 초기화하거나 처음으로 복귀하는 로직을 포함해야 한다 (MUST).

#### Audio Engine (FR-02x)

- **FR-020**: 시스템은 `BiquadFilterNode(highpass)`를 통해 Low-cut 필터를 구현하고, Cutoff 주파수(20Hz~20kHz)를 실시간으로 조절할 수 있어야 한다 (MUST).
- **FR-021**: 시스템은 파라미터 변경 시 `AudioParam.setTargetAtTime()`을 활용한 Smoothing을 적용하여 팝/클릭 노이즈를 방지해야 한다 (MUST).
- **FR-022**: 시스템은 `GainNode`를 통해 최종 출력 볼륨을 0~1 범위에서 정밀하게 제어해야 한다 (MUST).
- **FR-023**: 오디오 그래프(`Source → Analyser(Pre) → Filter → Gain → Analyser(Post) → Destination`)는 `engine/` 모듈 내 단일 지점에서 관리되어야 한다 (MUST). _[Constitution I]_
- **FR-024**: 오디오 그래프는 Pre/Post 두 개의 `AnalyserNode`를 포함하여, 필터 적용 전후의 신호를 동시에 분석할 수 있어야 한다 (MUST). _[Constitution III]_

#### Visualization (FR-03x)

- **FR-030**: 시스템은 하나의 Canvas 위에 Fabfilter Pro-Q 스타일의 3-레이어 합성 시각화를 구현해야 한다 (MUST):
  - **Layer 1 — Pre-EQ 스펙트럼** (ghost/어두운 색): `AnalyserNode(Pre).getFloatFrequencyData()`로 필터 적용 전 원본 신호를 표시
  - **Layer 2 — Post-EQ 스펙트럼** (primary/밝은 색): `AnalyserNode(Post).getFloatFrequencyData()`로 필터 적용 후 처리된 신호를 표시
  - **Layer 3 — 필터 응답 곡선** (선/영역): `BiquadFilterNode.getFrequencyResponse()`로 필터 전달 함수를 오버레이
- **FR-031**: 시스템은 Pre/Post 두 FFT 데이터 모두에 Smoothing을 적용하여 Fabfilter 스타일의 부드러운 곡선을 렌더링해야 한다 (MUST).
- **FR-032**: Pre-EQ와 Post-EQ 스펙트럼은 색상 및 불투명도로 시각적으로 구분되어, 필터 적용 전후의 차이가 즉시 식별 가능해야 한다 (MUST).
- **FR-033**: 시스템은 Post-EQ `AnalyserNode`에서 오디오 신호가 0dB을 초과할 때 Clipping 경고(Peak LED)를 즉시 표시해야 한다 (MUST).

#### Node Graph (FR-04x)

- **FR-040**: 시스템은 React Flow(`@xyflow/react`)를 사용하여 오디오 노드 간 연결 상태를 시각적 그래프로 표시해야 한다 (SHOULD).
- **FR-041**: 노드 그래프의 엣지는 신호 흐름 방향을 애니메이션으로 표현해야 한다 (SHOULD).
- **FR-042**: 각 노드는 해당 오디오 파라미터의 현재 값을 실시간으로 표시해야 한다 (MAY).

#### State Management (FR-05x)

- **FR-050**: 재생 상태, 현재 시간, 필터 파라미터, 게인 값은 Zustand 스토어 하나에서 관리되어야 한다 (MUST). _[Constitution II]_
- **FR-051**: 컴포넌트는 `engine/`을 직접 import하지 않고, 스토어 액션을 통해 간접 제어해야 한다 (MUST). _[Constitution I, II]_

#### Safety (FR-06x)

- **FR-060**: 시스템은 `AudioContext`가 브라우저 정책으로 suspended된 경우, 사용자 제스처를 통한 resume 흐름을 제공해야 한다 (MUST).
- **FR-061**: 시스템은 지원하지 않는 파일 형식에 대해 명확한 에러 메시지를 표시해야 한다 (MUST).

#### Testing (FR-07x)

- **FR-070**: Unit 테스트(Vitest)는 `engine/` 수학 로직, `store/` 액션, `utils/` 순수 함수를 커버해야 한다 (MUST). 매 커밋마다 실행한다. _[Constitution IV]_
- **FR-071**: Component 테스트(Vitest + @testing-library/react)는 UI 컴포넌트의 렌더링과 스토어 연결을 검증해야 한다 (MUST). `AudioContext`는 모킹한다. 매 커밋마다 실행한다. _[Constitution IV]_
- **FR-072**: E2E 테스트(Playwright)는 실제 브라우저에서 다음 항목을 검증해야 한다 (MUST). PR 단위로 실행한다. _[Constitution IV]_:
  - 오디오 파일 업로드 → 디코딩 → 재생의 전체 흐름
  - Playhead와 `AudioContext.currentTime`의 동기화 정확도
  - Canvas에 Pre/Post 스펙트럼이 렌더링되는지 시각적 검증
  - 메인 스레드 점유율이 15% 이하인지 `Performance API`로 측정
  - 파일 5회 연속 업로드/해제 후 `performance.memory` 기반 메모리 누수 감지
- **FR-073**: E2E 테스트는 Chromium 기반 브라우저에서 실행하며, `AudioContext` suspended 정책 및 사용자 제스처 resume 흐름을 포함해야 한다 (SHOULD).

### Key Entities

- **AudioEngine**: Web Audio API 그래프의 생성·연결·해제를 관리하는 순수 TypeScript 모듈. React에 의존하지 않는다. (`src/engine/`)
- **AudioStore**: 재생 상태(`playing`, `stopped`), 현재 시간(`currentTime`), 필터 파라미터(`cutoffHz`, `gain`), 파일 메타데이터를 보유하는 Zustand 스토어. (`src/store/`)
- **SpectrumRenderer**: Canvas 2D API를 사용하여 Pre/Post FFT 데이터(3-레이어)와 필터 응답 곡선을 합성 렌더링하는 모듈. (`src/components/audio/`)
- **NodeGraph**: React Flow 기반의 오디오 노드 토폴로지 시각화 컴포넌트. (`src/components/graph/`)

## Success Criteria _(mandatory)_

### Measurable Outcomes

| SC         | 기준                                                    | 검증 계층                             |
| ---------- | ------------------------------------------------------- | ------------------------------------- |
| **SC-001** | 오디오 파일 업로드 → 재생 버튼까지 3초 이내 (10MB 이하) | E2E (Playwright)                      |
| **SC-002** | Playhead와 실제 재생 시간 차이 ±16ms(1프레임) 이내      | E2E (Playwright)                      |
| **SC-003** | Cutoff 노브 파라미터 반영 지연 50ms 이하                | E2E (Playwright)                      |
| **SC-004** | 전체 Canvas/DOM 드로잉 메인 스레드 점유율 15% 이하      | E2E (Playwright + Performance API)    |
| **SC-005** | 파라미터 급변 시(20Hz→2kHz) 가청 팝/클릭 노이즈 없음    | 수동 QA + Unit (Smoothing 계수 검증)  |
| **SC-006** | 필터 감쇄율이 이론적 수치 대비 ±1dB 이내                | Unit (Vitest)                         |
| **SC-007** | 파일 5회 연속 업로드/해제 후 메모리 단조 증가 없음      | E2E (Playwright + performance.memory) |
| **SC-008** | Unit/Component 테스트가 매 커밋마다 통과                | CI (Vitest)                           |
| **SC-009** | E2E 테스트가 PR 단위로 통과                             | CI (Playwright)                       |
