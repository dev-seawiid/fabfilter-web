# Review 008: Phase 5 Graph Test Quality Audit

**Date**: 2026-03-23
**Scope**: `src/components/graph/__tests__/` — 의미 없는 테스트 제거, 누락 커버리지 보강
**Reference**: Vercel React Best Practices (Testing: 행동 기반 검증, 구현 세부사항 금지)
**Status**: Complete

---

## 감사 기준

- **행동 테스트**: 사용자가 보는 텍스트, 상호작용 결과를 검증
- **구현 세부사항 금지**: 라이브러리 내부 CSS 클래스, DOM 속성을 검증하지 않음
- **커버리지**: 조건부 렌더링, 파생 값 계산, 상태 반응 등 핵심 로직

---

## 발견 및 수정 결과

### 1. 의미 없는 테스트 제거

| # | 파일 | 테스트명 | 문제 | 조치 |
|---|------|----------|------|------|
| 1 | `AudioNodeGraph.test.tsx` | "6개의 react-flow__node가 렌더링된다" | React Flow 내부 CSS 클래스 `.react-flow__node`를 카운트. 라이브러리 버전 업데이트 시 깨질 수 있으나 앱 동작에는 무관 | **삭제** |
| 2 | `AudioNodeGraph.test.tsx` | "올바른 노드 타입이 렌더링된다" | `.react-flow__node-source`, `.react-flow__node-filter` 등 라이브러리 내부 타입 클래스를 검증 | **삭제** |
| 3 | `AudioNodeGraph.test.tsx` | "올바른 노드 ID가 data-id로 설정된다" | `[data-id]` 속성은 React Flow가 내부적으로 관리하는 DOM 속성 | **삭제** |
| 4 | `AudioNodeGraph.test.tsx` | "노드에 draggable 클래스가 없다" | `.draggable` CSS 클래스 부재를 검증. React Flow의 `nodesDraggable={false}` 설정이 내부적으로 어떤 클래스를 생성하는지에 의존 | **삭제** |

**이유**: React Flow의 내부 구현(CSS 클래스명, DOM 속성)은 라이브러리의 private API입니다. 이를 테스트하면 라이브러리 업데이트 시 테스트가 깨지지만 앱의 실제 동작에는 문제가 없습니다. 우리가 검증해야 할 것은 "Source, Filter, Gain 등 6개 노드 라벨이 화면에 표시되는가"이며, 이는 이미 "노드 6개 렌더링" 섹션에서 커버합니다.

### 2. 누락된 테스트 커버리지 보강

#### GainNodeDisplay.test.tsx (신규, 5개)

| # | 테스트명 | 검증 내용 |
|---|----------|-----------|
| 5 | "기본 gain=1일 때 100%가 표시된다" | 퍼센트 변환 (`Math.round(gain * 100)`) |
| 6 | "기본 gain=1일 때 0.0dB가 표시된다" | dB 변환 (`20 * Math.log10(1)` = 0dB) |
| 7 | "gain=0.5일 때 50%와 -6.0dB가 표시된다" | dB 계산 정확성 (`20 * Math.log10(0.5)` ≈ -6.02) |
| 8 | "gain=0일 때 0%와 -∞dB가 표시된다" | **엣지 케이스**: `Math.log10(0)` = `-Infinity` → `-∞dB` 문자열 |
| 9 | "Gain 라벨이 표시된다" | 기본 렌더링 검증 |

**이유**: `GainNodeDisplay`는 `gain → dB` 변환 로직을 포함하며, 특히 `gain=0` 시 `-Infinity` 처리는 반드시 검증해야 하는 엣지 케이스입니다.

#### SourceNode.test.tsx (신규, 6개)

| # | 테스트명 | 검증 내용 |
|---|----------|-----------|
| 10 | "stopped 상태에서 ■ 아이콘이 표시된다" | 상태별 아이콘 조건부 렌더링 |
| 11 | "playing 상태에서 ▶ 아이콘이 표시된다" | store 변경 시 실시간 반응 |
| 12 | "idle 상태에서 ○ 아이콘이 표시된다" | 3번째 조건 분기 검증 |
| 13 | "파일명이 표시된다" | 기본 렌더링 |
| 14 | "14자 초과 파일명은 잘린다" | `truncate()` 함수 동작 (`"very-long-fil…"`) |
| 15 | "파일이 없으면 — 가 표시된다" | `fileMetadata: null` 시 fallback |

**이유**: `SourceNode`는 `playbackState`에 따른 3방향 조건 분기와 `truncate()` 유틸 로직을 포함합니다. 특히 `null` fileMetadata 처리는 앱 초기 상태에서 반드시 동작해야 합니다.

---

## 수정 요약

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| graph 테스트 수 | 27 | 34 (-4 삭제, +11 추가) |
| 라이브러리 구현 테스트 | 4 | 0 |
| GainNodeDisplay 커버리지 | 없음 | dB 변환 + 엣지 케이스 |
| SourceNode 커버리지 | 없음 | 상태 아이콘 + truncation + null 처리 |

### 수정된 파일 목록

| 파일 | 수정 내용 |
|------|-----------|
| `src/components/graph/__tests__/AudioNodeGraph.test.tsx` | React Flow 내부 구현 테스트 4개 삭제 |
| `src/components/graph/__tests__/GainNodeDisplay.test.tsx` | 신규 — dB 변환, -∞dB 엣지 케이스 (5개) |
| `src/components/graph/__tests__/SourceNode.test.tsx` | 신규 — 상태 아이콘, truncation, null fallback (6개) |
