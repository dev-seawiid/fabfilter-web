<div align="center">

# FabFilter Web

**Browser-based audio processor with real-time spectrum visualization**

[FabFilter](https://www.fabfilter.com/) 스타일의 오디오 프로세서를 Web Audio API로 구현한 프로젝트입니다.
<br/>오디오 신호 흐름, 실시간 FFT 스펙트럼 분석, 인터랙티브 노드 그래프를 브라우저에서 체험할 수 있습니다.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-native-orange)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Vitest](https://img.shields.io/badge/Vitest-passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

</div>

---

## Highlights

- **Web Audio API** — 외부 오디오 라이브러리 없이 네이티브 API만으로 신호 처리 파이프라인 구축
- **60fps Canvas 시각화** — `requestAnimationFrame` + Canvas 2D로 메인 스레드 점유율 0.65% 유지하며 실시간 FFT 렌더링 (React 렌더 사이클 완전 우회)
- **Audio-First 아키텍처** — 오디오 엔진(`engine/`)을 React에서 완전 분리, Zustand 단일 스토어로 상태 동기화
- **3-Layer 테스트 전략** — Unit(Vitest) · Component(Testing Library) · E2E(Playwright) 계층별 테스트
- **접근성 & 크로스 브라우저** — WCAG 키보드 내비게이션, Safari `webkitAudioContext` 폴백, iOS 제스처 지원

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (UI Layer)                       │
│                                                                 │
│  ┌──────────┐  ┌───────────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Spectrum  │  │  AudioNode    │  │  Knob    │  │ Timeline  │  │
│  │ Canvas   │  │  Graph (Flow) │  │ Controls │  │ (60fps)   │  │
│  └────┬─────┘  └───────┬───────┘  └────┬─────┘  └─────┬─────┘  │
│       │                │               │               │        │
│       └────────────────┴───────┬───────┴───────────────┘        │
│                                │                                │
│                    ┌───────────▼───────────┐                    │
│                    │   Zustand Store (SSOT) │                    │
│                    │   useAudioStore        │                    │
│                    └───────────┬────────────┘                    │
│                                │                                │
├────────────────────────────────┼────────────────────────────────┤
│                        Engine Layer                             │
│                                │                                │
│          ┌─────────────────────▼──────────────────────┐         │
│          │              AudioEngine                    │         │
│          │                                             │         │
│          │  Source → Analyser(Pre) → BiquadFilter      │         │
│          │            → Gain → Analyser(Post)          │         │
│          │              → Destination                  │         │
│          └─────────────────────────────────────────────┘         │
│                                                                 │
│                        Web Audio API                            │
└─────────────────────────────────────────────────────────────────┘
```

> **설계 원칙**: UI 레이어는 순수한 뷰 역할만 수행합니다. 모든 오디오 상태는 Zustand 스토어를 단일 진실 공급원(SSOT)으로 사용하며, 컴포넌트는 셀렉터를 통해 필요한 상태만 구독합니다. 오디오 엔진은 React에 의존하지 않는 순수 TypeScript 모듈로, 프레임워크 교체 시에도 재사용 가능합니다.

---

## Features

### Audio Processing

| 기능 | 설명 | 기술 |
|------|------|------|
| **파일 디코딩** | 오디오 파일 업로드 → `decodeAudioData()` → AudioBuffer | Web Audio API |
| **실시간 필터링** | BiquadFilter (Highpass) Cutoff/Gain 실시간 제어 | `AudioParam.setTargetAtTime()` |
| **클릭 방지** | 파라미터 변경 시 15ms 시간 상수로 exponential smoothing | AudioParam scheduling |
| **클리핑 감지** | Post-EQ 신호가 0dB 초과 시 Peak LED 점등 | AnalyserNode frequency data |

### Visualization

| 기능 | 설명 | 기술 |
|------|------|------|
| **3-Layer 스펙트럼** | Pre-EQ(ghost) + Filter Response + Post-EQ(primary) 합성 | Canvas 2D, `getFloatFrequencyData()` |
| **로그 주파수 축** | 20Hz~20kHz 로그 스케일 (인간 청각 인지 반영) | 커스텀 Hz↔log 변환 |
| **EMA 스무딩** | 프레임 간 지터 제거 (alpha=0.3, ~5프레임 수렴) | Exponential Moving Average |
| **노드 그래프** | Web Audio 신호 흐름을 React Flow로 시각화 | @xyflow/react |

### Performance

| 지표 | 목표 | 달성 |
|------|------|------|
| 파일 업로드 → 재생 | < 3초 | ✓ |
| Playhead 정확도 | ± 16ms (1 frame @ 60fps) | ✓ |
| 파라미터 반응 지연 | ≤ 50ms | ✓ |
| 메인 스레드 점유율 | < 15% (실측 0.65%) | ✓ |
| FPS | 60.7fps (Long Task 0개) | ✓ |
| 메모리 안정성 | 단조 증가 없음 (Heap 0MB 증가/3초) | ✓ |

---

## Tech Stack

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| **Framework** | Next.js 16 (App Router) | SSR 지원, React Compiler, Turbopack |
| **Language** | TypeScript 5.9 (strict) | 오디오 파라미터 타입 안전성 |
| **State** | Zustand | React 외부(AudioEngine)에서도 접근 가능, 최소 보일러플레이트 |
| **Visualization** | Canvas 2D | FFT 원시 데이터 직접 렌더링, 외부 라이브러리 오버헤드 제거 |
| **Node Graph** | React Flow (@xyflow/react) | 노드가 React 컴포넌트 → 라이브 파라미터 표시 가능 |
| **Animation** | Framer Motion | UI 요소 전환 애니메이션 (Canvas와 관심사 분리) |
| **Unit Test** | Vitest + Testing Library | 컴포넌트·엔진·유틸리티 계층별 테스트 |
| **E2E Test** | Playwright | 실제 브라우저 AudioContext, Canvas 렌더링, 성능 검증 |
| **Styling** | Tailwind CSS 4 | 유틸리티 기반, 디자인 시스템과의 일관성 |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 9+

### Installation

```bash
# Clone
git clone https://github.com/seawiid/fabfilter-web.git
cd fabfilter-web

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

### Scripts

```bash
pnpm dev          # 개발 서버 (Turbopack)
pnpm build        # 프로덕션 빌드
pnpm lint         # ESLint 검사
pnpm test         # Vitest 단위·컴포넌트 테스트
pnpm test:e2e     # Playwright E2E 테스트
```

---

## Project Structure

```
src/
├── engine/           # Web Audio API 래퍼 (React 무관)
│   ├── AudioEngine   #   오디오 컨텍스트·노드 그래프·재생 제어
│   ├── FilterEngine  #   BiquadFilter 파라미터·스무딩
│   └── AnalyserBridge#   Pre/Post FFT 데이터 추출
│
├── store/            # Zustand 단일 스토어 (SSOT)
│   └── useAudioStore #   재생 상태, 필터 파라미터, 액션
│
├── components/
│   ├── audio/        # 재생 컨트롤, 타임라인, 스펙트럼, 파일 업로드
│   ├── graph/        # React Flow 노드 그래프 (6 노드, 애니메이션 엣지)
│   ├── ui/           # Knob, PeakLED 등 공용 UI
│   └── layout/       # AppShell 레이아웃
│
├── hooks/            # 커스텀 훅
│   ├── useAnimationFrame    # rAF 루프 래퍼 + 게이팅
│   ├── useSpectrumRenderer  # FFT 수집 → EMA 스무딩 → Canvas 3-Layer 드로잉 (React 우회)
│   ├── usePeakDetector      # 클리핑 감지 (조건부 emit)
│   └── useGlobalKeyboard    # 전역 단축키
│
├── utils/            # 순수 함수 유틸리티
│   ├── frequency     #   Hz↔log 변환, dB↔Y 매핑
│   ├── smoothing     #   EMA 알고리즘
│   └── formatting    #   Hz·dB·시간 포맷팅
│
└── types/            # 공유 타입 정의
```

---

## Testing

3-Layer 테스트 전략으로 각 계층의 관심사를 분리합니다.

```
┌─────────────────────────────────────────┐
│           E2E (Playwright)              │  ← 실제 브라우저, AudioContext
│  재생 플로우 · 필터 인터랙션 · 성능 예산    │
├─────────────────────────────────────────┤
│        Component (Vitest + RTL)         │  ← jsdom, AudioContext mock
│  UI 렌더링 · 이벤트 핸들링 · 스토어 연동    │
├─────────────────────────────────────────┤
│           Unit (Vitest)                 │  ← 순수 함수, mock 환경
│  엔진 수학 · 스토어 액션 · 유틸리티        │
└─────────────────────────────────────────┘
```

### 주요 테스트 영역

- **AudioEngine** — 노드 연결 순서, 리소스 해제, 컨텍스트 정책
- **FilterEngine** — 이론값 대비 ±1dB 감쇠 정확도, 스무딩 파라미터 검증
- **SpectrumCanvas** — Canvas 존재, 오버레이 상태 전환, ResizeObserver 연결/해제
- **E2E Performance** — Long Task 0개, FPS 30+, 파일 교체 시 메모리 해제, 스펙트럼 잔상 없음
- **E2E Visualization** — 스펙트럼 실시간 업데이트 검증 (화이트 노이즈 기반 스냅샷 비교)

---

## Key Design Decisions

### Why native Web Audio API over audio libraries?

`BiquadFilterNode.getFrequencyResponse()`와 `AnalyserNode.getFloatFrequencyData()`가 이미 원시 데이터를 제공합니다. [wavesurfer.js](https://wavesurfer.xyz/)나 [audiomotion-analyzer](https://audiomotion.dev/)는 범용 시각화에 최적화되어 있지만, FabFilter 특유의 3-Layer 합성(Pre-EQ ghost + Filter Response + Post-EQ)과 커스텀 스무딩을 구현하기에는 오히려 추상화가 방해됩니다.

### Why Zustand over Redux or Context?

AudioEngine은 React 컴포넌트 트리 바깥에서 동작합니다. Zustand는 React 외부에서도 `getState()`/`setState()`로 스토어에 접근할 수 있어, 오디오 엔진과 UI 간 동기화에 적합합니다. Redux의 보일러플레이트나 Context의 리렌더링 문제 없이 셀렉터 기반 구독이 가능합니다. AudioEngine 인스턴스는 `globalThis`에 저장하여 Next.js HMR에서도 싱글턴을 보장합니다.

### Why Canvas 2D over SVG or WebGL?

60fps FFT 렌더링에서 SVG는 DOM 노드 수 폭발로 성능 병목이 발생합니다. WebGL은 단순한 2D 스펙트럼에 과도한 복잡성을 추가합니다. Canvas 2D는 `drawImage`, `fillRect` 수준의 API로 충분하며, 메인 스레드 예산 15% 이내를 달성했습니다.

> 각 결정의 상세한 평가는 [`docs/adr/`](docs/adr/) 디렉토리의 Architecture Decision Records를 참고하세요.

---

## Browser Support

| Browser | 지원 | 비고 |
|---------|------|------|
| Chrome 90+ | ✓ | 기본 지원 |
| Firefox 90+ | ✓ | 기본 지원 |
| Safari 15+ | ✓ | `webkitAudioContext` 폴백 |
| iOS Safari | ✓ | 사용자 제스처로 AudioContext resume |
| Edge 90+ | ✓ | Chromium 기반 |

---

## Documentation

| 문서 | 설명 |
|------|------|
| [`docs/01-constitution.md`](docs/01-constitution.md) | 아키텍처 원칙 & 거버넌스 |
| [`docs/02-specify.md`](docs/02-specify.md) | 사용자 스토리 & 인수 시나리오 |
| [`docs/03-plan.md`](docs/03-plan.md) | 6-Phase 구현 계획 |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`docs/review/`](docs/review/) | Phase별 코드 품질 감사 (9차, 최신: 스펙트럼 렌더러 리팩토링) |
| [`docs/guide-performance-testing-mcp.md`](docs/guide-performance-testing-mcp.md) | Chrome DevTools MCP 성능 테스트 가이드 |

---

## License

MIT

