# ADR: 오디오 시각화 라이브러리 선택

- **Status**: Accepted
- **Date**: 2026-03-20
- **Context**: Fabfilter Web Constitution Principle III (60fps Visual Fidelity)

## Decision

외부 시각화 라이브러리를 사용하지 않고, **Web Audio API + Canvas 2D API를 직접 사용**하여 오디오 시각화를 구현한다.

## Context

Fabfilter 스타일의 EQ 시각화는 다음 세 가지를 하나의 Canvas 위에 합성해야 한다:

1. **실시간 FFT 스펙트럼** — `AnalyserNode.getFloatFrequencyData()`로 매 프레임 추출
2. **필터 응답 곡선** — `BiquadFilterNode.getFrequencyResponse()`로 계산
3. **커스텀 렌더링** — 로그 주파수 축(20Hz~20kHz), 그라데이션 필, 글로우 이펙트, 스무딩

기존 오픈소스 라이브러리가 이 요구사항을 충족하는지 평가했다.

## Evaluated Options

### 1. wavesurfer.js

| Metric               | Value             |
| -------------------- | ----------------- |
| npm weekly downloads | ~590,000          |
| GitHub stars         | 10,200            |
| Last publish         | 2026-03 (v7.12.4) |
| License              | BSD-3-Clause      |

**용도**: 파형 렌더링 + 재생 UI 특화 라이브러리.

**제외 사유**:

- 스펙트럼 곡선 / EQ 응답 곡선 렌더링 기능 없음
- 자체 `AudioContext` 생명주기를 관리하여 우리의 `engine/` 아키텍처와 충돌
- 파형 재생기가 주 목적이므로 프로젝트 요구사항과 불일치

### 2. audiomotion-analyzer

| Metric               | Value              |
| -------------------- | ------------------ |
| npm weekly downloads | ~6,000             |
| GitHub stars         | 879                |
| Last publish         | 2024 (v4.x stable) |
| License              | MIT                |

**용도**: 실시간 FFT 스펙트럼 분석기. 바 그래프, LED 스타일 시각화.

**제외 사유**:

- Canvas를 내부적으로 소유하여 커스텀 드로잉 불가
- 바 그래프 / LED 스타일만 지원 — Fabfilter의 부드러운 곡선 미지원
- 필터 응답 곡선 오버레이 기능 없음
- React 컴포넌트 아님 (수동 래핑 필요)

**참고 가치**: AnalyserNode 효율적 사용 패턴, 로그 주파수 비닝, 스무딩 알고리즘

### 3. DSSSP

| Metric               | Value            |
| -------------------- | ---------------- |
| npm weekly downloads | ~15              |
| GitHub stars         | 44               |
| Last publish         | 2025-02 (v0.6.0) |
| License              | AGPL-3.0         |

**용도**: Fabfilter 스타일에 가장 근접한 필터 응답 곡선 편집/시각화 React 라이브러리.

**제외 사유**:

- **AGPL-3.0 라이선스** — 전체 애플리케이션 오픈소스 공개 의무 발생
- SVG 기반 렌더링 — Constitution의 Canvas 2D 원칙과 충돌
- 실시간 FFT 스펙트럼 오버레이 미지원 (정적 필터 곡선만)
- 매우 초기 단계 (주간 다운로드 15건)

**참고 가치**: 필터 응답 곡선 수학, 인터랙티브 필터 노드 UX 패턴

### 4. weq8

| Metric               | Value            |
| -------------------- | ---------------- |
| npm weekly downloads | ~25              |
| GitHub stars         | 229              |
| Last publish         | 2022-11 (v0.2.0) |
| License              | ISC              |

**용도**: Ableton EQ Eight 스타일의 8밴드 파라메트릭 EQ. Web Component 기반.

**제외 사유**:

- 2022년 이후 유지보수 중단
- Web Component 기반 (React 아님)
- 시각화 기능이 제한적

**참고 가치**: BiquadFilterNode 뱅크 관리 패턴, 헤드리스 EQ 엔진 구조

### 5. react-audio-visualize

| Metric               | Value            |
| -------------------- | ---------------- |
| npm weekly downloads | ~50,000          |
| GitHub stars         | 180              |
| Last publish         | 2024-09 (v1.2.0) |
| License              | MIT              |

**용도**: 음성 녹음 UI용 간단한 바 차트 시각화 React 컴포넌트.

**제외 사유**: 프로페셔널 오디오 도구 수준의 시각화에 부적합. 스펙트럼 곡선, EQ 응답 렌더링 불가.

### 6. @foobar404/wave

| Metric               | Value            |
| -------------------- | ---------------- |
| npm weekly downloads | ~2,200           |
| GitHub stars         | 732              |
| Last publish         | 2022-03 (v2.0.0) |
| License              | MIT              |

**제외 사유**: 2022년 이후 방치. 프리셋 기반으로 커스텀 제어권 없음.

### 7. uPlot (고성능 Canvas 차트)

| Metric               | Value             |
| -------------------- | ----------------- |
| npm weekly downloads | ~666,000          |
| GitHub stars         | 10,000            |
| Last publish         | 2025-03 (v1.6.32) |
| License              | MIT               |

**용도**: 초고속 Canvas 2D 시계열 차트. 166,650 데이터 포인트를 25ms에 렌더링.

**제외 사유**:

- 시계열 대시보드 특화 — 로그 주파수 축 미지원
- 오디오 관련 기능 없음
- 축, 라벨, 인터랙션 모델이 오디오 UI에 부적합

**참고 가치**: Canvas 2D 고빈도 리드로우 최적화 기법, 데이터 데시메이션 패턴

## Rationale

1. **Web Audio API에 필요한 메서드가 이미 내장되어 있다**
   - `AnalyserNode.getFloatFrequencyData()` → 실시간 FFT
   - `BiquadFilterNode.getFrequencyResponse()` → 필터 응답 곡선
   - 외부 라이브러리가 이 API 위에 추가하는 가치가 거의 없다

2. **Fabfilter 미학은 직접 구현해야 한다**
   - 그라데이션 필, 글로우 이펙트, 커브 스무딩은 어떤 라이브러리도 제공하지 않음
   - 결국 Canvas 드로잉 로직을 직접 작성해야 하므로 라이브러리 래핑은 불필요한 계층

3. **아키텍처 충돌 위험**
   - 대부분의 라이브러리가 자체 AudioContext 또는 Canvas를 소유
   - `engine/ → store/ → components/` 구조에서 외부 라이브러리가 끼어들 자리가 없음

4. **구현 복잡도가 높지 않다**
   - FFT 스펙트럼 렌더링은 ~50줄의 Canvas 코드
   - 필터 응답 곡선은 Web Audio API 내장 메서드 + Canvas drawPath

## References

- [audiomotion-analyzer](https://github.com/hvianna/audioMotion-analyzer) — 스무딩 알고리즘 참고
- [DSSSP](https://github.com/NumberOneBot/dsssp) — 필터 응답 곡선 수학 참고
- [weq8](https://github.com/teropa/weq8) — BiquadFilterNode 뱅크 구조 참고
- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
