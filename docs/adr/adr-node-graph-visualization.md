# ADR: 노드 그래프 시각화 라이브러리 선택

- **Status**: Accepted
- **Date**: 2026-03-20
- **Context**: Fabfilter Web Requirements §3 — 노드 그래프 가시화 (Observability)

## Decision

**React Flow (`@xyflow/react`)** 를 사용하여 Web Audio API 노드 그래프를 시각화한다.
레이아웃이 필요한 경우 **dagre** (~8 kB gzip)를 보조 레이아웃 엔진으로 사용한다.

## Context

Requirements §3에서 `Source → Filter → Analyzer → Destination`으로 이어지는 오디오 노드 간의 연결 상태와 데이터 흐름을 사용자가 직관적으로 파악할 수 있어야 한다고 명시했다. 이를 위해 노드 그래프 시각화 라이브러리를 평가했다.

### 요구 조건

- React/Next.js 네이티브 통합
- 노드 안에 커스텀 React 컴포넌트(노브, 슬라이더, 미터) 삽입 가능
- 엣지 애니메이션으로 신호 흐름 방향 표시
- 4~8개 노드 규모에 적합한 경량 솔루션
- MIT 라이선스

## Evaluated Options

### 1. React Flow (`@xyflow/react`) — SELECTED

| Metric               | Value              |
| -------------------- | ------------------ |
| npm weekly downloads | ~3,240,000         |
| GitHub stars         | 35,716             |
| Last publish         | 2026-02 (v12.10.1) |
| Bundle size          | ~85-95 kB min+gzip |
| License              | MIT                |

**선택 사유**:

- **공식 Web Audio API 튜토리얼 존재** — 정확히 우리의 유스케이스를 다룸
- 노드가 표준 React 컴포넌트 → FabFilter 스타일 노브, 미터를 노드 안에 직접 삽입 가능
- `animated` prop으로 엣지 신호 흐름 애니메이션 즉시 적용
- 내장 MiniMap, Controls, Background 컴포넌트
- 3.2M 주간 다운로드, 활발한 유지보수
- 퍼스트 클래스 TypeScript 지원, React 훅 API (`useNodes`, `useEdges`, `useReactFlow`)

**제한 사항**:

- 내장 자동 레이아웃 없음 → dagre 또는 수동 좌표로 보완
- DOM 기반 렌더링 → 수백 개 노드에서는 성능 이슈 (우리의 4~8개 노드에서는 무관)

### 2. D3.js

| Metric               | Value                                       |
| -------------------- | ------------------------------------------- |
| npm weekly downloads | ~7,285,000                                  |
| GitHub stars         | 112,572                                     |
| Last publish         | 2024-03 (v7.9.0)                            |
| Bundle size          | ~90 kB min+gzip (full) / ~7 kB (d3-force만) |
| License              | ISC                                         |

**제외 사유**:

- DOM 직접 조작 → React의 가상 DOM과 충돌하여 통합이 불안정
- 노드 그래프 UI를 처음부터 직접 구현해야 함 (드래그, 연결, 선택 로직 전부)
- 4~8개 노드 UI를 만들기 위해 투입해야 할 코드량이 과도
- 저수준 시각화 툴킷이지 노드 그래프 솔루션이 아님

### 3. vis-network

| Metric               | Value                |
| -------------------- | -------------------- |
| npm weekly downloads | ~441,000             |
| GitHub stars         | 3,539                |
| Last publish         | 2025-09 (v10.0.2)    |
| Bundle size          | ~150-180 kB min+gzip |
| License              | Apache-2.0 / MIT     |

**제외 사유**:

- Canvas 기반 렌더링 → 노드 안에 React 컴포넌트(노브, 슬라이더) 삽입 불가
- React 통합이 ref 기반 래퍼 수준으로 불안정
- 엣지 애니메이션 미지원
- 번들 사이즈 대비 제공하는 커스터마이징이 제한적

### 4. Cytoscape.js

| Metric               | Value             |
| -------------------- | ----------------- |
| npm weekly downloads | ~3,581,000        |
| GitHub stars         | 10,900            |
| Last publish         | 2025-08 (v3.33.1) |
| Bundle size          | ~110 kB min+gzip  |
| License              | MIT               |

**제외 사유**:

- Canvas 기반 → 노드 안에 React 컴포넌트 삽입 불가
- 그래프 분석/바이오인포매틱스 도구로 설계됨, 인터랙티브 오디오 UI에 부적합
- CSS-like DSL로 스타일링 → React props/Tailwind와 이질적
- 자동 레이아웃은 우수하나 우리의 핵심 요구사항(커스텀 노드 UI)을 충족하지 못함

### 5. ELK.js

| Metric               | Value                |
| -------------------- | -------------------- |
| npm weekly downloads | ~1,324,000           |
| GitHub stars         | 2,475                |
| Last publish         | 2026-03 (v0.11.1)    |
| Bundle size          | ~600 kB - 1.3 MB min |
| License              | EPL-2.0              |

**제외 사유**:

- 레이아웃 알고리즘 전용 → 렌더링 기능 없음
- 번들 사이즈가 600 kB~1.3 MB로 과도 (4~8개 노드에 정당화 불가)
- EPL-2.0 라이선스의 copyleft 요소
- dagre (~8 kB)가 동일한 역할을 충분히 수행

### 6. Rete.js

| Metric               | Value                    |
| -------------------- | ------------------------ |
| npm weekly downloads | ~27,000                  |
| GitHub stars         | 11,939                   |
| Last publish         | 2025-06 (v2.0.6)         |
| Bundle size          | 226 kB (코어) + 플러그인 |
| License              | MIT                      |

**제외 사유**:

- 내장 데이터플로우 엔진은 흥미롭지만, 우리는 이미 `engine/`에서 Web Audio API를 직접 제어
- React 플러그인이 styled-components에 의존 → Tailwind CSS 스택과 충돌
- 최소 5개 플러그인 설치 필요 (area, react, connection, render-utils, arrange)
- 커뮤니티 규모(주간 27K)가 React Flow(3.2M) 대비 현저히 작음
- 문서 품질이 React Flow에 비해 부족

## Rationale

1. **React Flow의 Web Audio API 튜토리얼**이 우리의 유스케이스와 정확히 일치한다. 오디오 노드(소스, 필터, 게인, 출력)를 React 컴포넌트로 만들어 그래프에 배치하는 패턴이 이미 검증되어 있다.

2. **커스텀 노드 = React 컴포넌트**라는 설계가 핵심이다. 노드 안에 Zustand 스토어를 구독하는 노브나 미터를 넣으면, 노드 그래프가 단순한 시각화를 넘어 **인터랙티브 컨트롤 패널**이 된다.

3. **4~8개 노드에서는 자동 레이아웃이 필수가 아니다.** 오디오 시그널 체인은 대부분 선형(좌→우)이므로, 수동 좌표 배치 또는 dagre의 간단한 계층형 레이아웃으로 충분하다.

4. **Constitution의 기존 원칙과 정합**:
   - Audio-First: React Flow는 시각화만 담당, 오디오 로직은 `engine/`에 유지
   - Single Source of Truth: 노드 상태를 Zustand 스토어에서 관리하고 React Flow에 전달
   - 60fps Visual Fidelity: 노드 그래프는 60fps 실시간 렌더링이 불필요 (정적 토폴로지), Canvas 시각화와 역할 분리 명확

## References

- [React Flow — Web Audio API Tutorial](https://reactflow.dev/learn/tutorials/react-flow-and-the-web-audio-api)
- [React Flow GitHub](https://github.com/xyflow/xyflow)
- [dagre GitHub](https://github.com/dagrejs/dagre)
- [Cytoscape.js GitHub](https://github.com/cytoscape/cytoscape.js)
- [Rete.js GitHub](https://github.com/retejs/rete)
