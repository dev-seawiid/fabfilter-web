# Review 006: Phase4 Test Integrity Audit

**Date**: 2026-03-23
**Scope**: Unit(vitest) + E2E(Playwright) 전체 — 의미 없는 테스트 제거, 가짜 통합 수정, 소스 버그 수정
**Status**: Complete

---

## 감사 기준

- **Vercel React Best Practices**: 구현 세부사항이 아닌 사용자 행동(behavior) 기반 테스트
- **테스트 독립성**: 테스트 간 부수 효과에 의존하지 않는 격리된 테스트
- **진짜 통합 테스트**: 실제 코드 경로를 타는 통합 검증
- **버그를 스펙으로 고정하지 않기**: 잘못된 동작을 테스트로 문서화하지 않음

---

## 발견 및 수정 결과

### 1. 의미 없는 테스트 제거

| #   | 파일                      | 테스트명                                    | 문제                                                                                                                            | 조치     |
| --- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `SpectrumCanvas.test.tsx` | "컨테이너 div가 렌더링된다"                 | wrapper 태그가 `DIV`인지 확인하는 구현 세부사항 테스트. `<section>`이나 `<article>`로 변경해도 기능에 문제 없으나 테스트가 깨짐 | **삭제** |
| 2   | `SpectrumCanvas.test.tsx` | "canvas에 getContext('2d')가 호출 가능하다" | `beforeEach`에서 설정한 mock이 null이 아닌지 확인하는 자기 참조 테스트. 컴포넌트의 실제 동작이 아닌 mock 설정을 검증            | **삭제** |

**이유**: Vercel React 베스트 프랙티스에 따르면 컴포넌트 테스트는 내부 DOM 구조가 아닌 사용자가 인지하는 결과(텍스트, 상호작용)를 검증해야 합니다. 태그명이나 mock 자체를 검증하는 테스트는 리팩토링 내성이 없고 실제 버그를 잡지 못합니다.

### 2. 가짜 통합 테스트 수정

| #   | 파일                    | 테스트명                             | 문제                                                                                                                                      | 조치                 |
| --- | ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 3   | `useAudioStore.test.ts` | "onEnded → store 리셋 통합 (FR-013)" | `useAudioStore.setState()`를 직접 호출하여 "통합"을 검증하는 척 했음. 실제 `engine.onEnded` → `source.onended` 콜백 경로를 전혀 타지 않음 | **실제 경로로 수정** |

**수정 전** (가짜 통합):

```ts
// setState를 직접 호출 — 이건 setState가 동작하는지 테스트하는 것
useAudioStore.setState({ playbackState: "stopped", currentTime: 0 });
```

**수정 후** (진짜 통합):

```ts
// engine의 source.onended를 트리거 → engine.onEndedCallback → store setState 경로 검증
const engine = useAudioStore.getState().getEngine();
const source = engine.graphNodes.source;
(source as unknown as { onended: (() => void) | null }).onended?.();
```

**이유**: 가짜 통합 테스트는 실제 코드 경로를 타지 않으면서 통합을 검증한다고 착각하게 만들어 가장 위험합니다. `getOrCreateEngine()`에서 등록한 `engine.onEnded()` 콜백이 실제로 store를 리셋하는지 검증해야 FR-013 요구사항이 진정으로 커버됩니다.

### 3. 버그 수정 + 테스트 수정

| #   | 파일                | 테스트명                                            | 문제                                                                                         | 조치                                       |
| --- | ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 4   | `frequency.ts`      | -                                                   | `createLogFrequencyArray(20, 20000, 1)`이 `NaN`을 반환하는 버그 (`(count-1)` = 0으로 나누기) | **함수 수정**: `count <= 1` 가드 추가      |
| 5   | `frequency.test.ts` | "count=1이면 step이 Infinity가 되어 NaN을 반환한다" | 버그를 스펙으로 고정하는 테스트                                                              | **수정**: `startHz` 반환을 기대하도록 변경 |

**수정 전** (버그를 문서화):

```ts
expect(arr[0]).toBeNaN(); // "이건 원래 이래요"
```

**수정 후** (올바른 동작):

```ts
// count=1이면 배열에 startHz 하나만 담겨야 한다
expect(arr[0]).toBeCloseTo(20, 1);
```

**이유**: 테스트가 버그를 "스펙"으로 고정하면 나중에 실제로 수정하려 할 때 "테스트가 깨진다"는 이유로 수정이 거부될 수 있습니다. 올바른 동작을 먼저 정의하고, 구현이 그에 맞게 동작하도록 해야 합니다.

### 4. 오해를 유발하는 테스트 개선

| #   | 파일                      | 테스트명                                      | 문제                                                                                                                                                       | 조치                                 |
| --- | ------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 6   | `FilterEngine.test.ts`    | "Highpass 감쇄율 이론치 전달 (SC-006)"        | describe/it 이름이 실제 물리학 검증처럼 오해 유발 | **테스트명·주석만 명확화** (assertion 구조 유지) |
| 7   | `SpectrumCanvas.test.tsx` | "언마운트 시 ResizeObserver가 disconnect된다" | `callsBefore` 패턴으로 이전 테스트 부수 효과에 의존                                                                                                        | **`mockClear()` 사용으로 격리 확보** |

**이유 (6번)**: 원래 assertion(dB 변환 검증)은 passthrough 가치가 있으므로 유지하되, describe/it 이름과 주석만 "passthrough 검증"임을 명확히 했습니다.

**이유 (7번)**: `callsBefore` 카운팅 패턴은 테스트 실행 순서에 의존하며, 테스트가 추가/삭제/재배치되면 깨질 수 있습니다. `mockClear()`로 카운터를 리셋하면 각 테스트가 독립적으로 동작합니다.

### 5. E2E 실패 수정 — Timeline DOM 동기화 (FR-002)

| #   | 파일                   | 테스트명                                          | 문제                                                              | 조치                   |
| --- | ---------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ---------------------- |
| 8   | `e2e/playback.spec.ts` | "새 파일 업로드 시 이전 상태가 리셋된다 (FR-002)" | 파일 재업로드 후 현재 시간이 `"0:01"`로 남아 있음 (`"0:00"` 기대) | **Timeline 소스 수정** |

**근본 원인**: Timeline은 성능을 위해 `ref.textContent`로 직접 DOM을 업데이트합니다 (re-render 0회 전략). 그런데 `syncDOM()`이 `textContent`를 수동으로 변경한 뒤, 새 파일이 로드되어 React가 재렌더하면 JSX의 `{formatTime(0)}`은 이전 렌더와 동일한 값이므로 React는 DOM 업데이트를 건너뜁니다. 수동으로 변경된 "0:01"이 방치되는 **escape hatch 충돌** 문제입니다.

**수정**:

- store의 `currentTime`을 구독하여 JSX 렌더에 반영: `{formatTime(currentTime)}`
- `currentTime` 변경 시 `useEffect`로 DOM ref도 동기화
- `currentTime`은 재생 중이 아닌 seek/pause/loadFile 시에만 변경되므로 성능 영향 없음

### 6. TypeScript 타입 에러 수정

| #   | 파일            | 문제                                                                                                                                                                                                  | 조치                                                 |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 9   | `Knob.test.tsx` | `renderKnob`의 overrides 타입이 `Partial<typeof defaultProps>`로 추론되어 `formatValue`, `logarithmic` 등 optional prop 전달 불가 + `onChange`의 `Mock`/`Function` 유니온으로 `.mock.calls` 접근 불가 | `Omit<Partial<KnobProps>, "onChange">` 타입으로 수정 |

---

## 수정 요약

| 구분                   | 변경 전 | 변경 후                                                    |
| ---------------------- | ------- | ---------------------------------------------------------- |
| Unit 테스트 수         | 150     | 148 (-2 삭제)                                              |
| E2E 테스트             | 1 실패  | 26 전체 통과                                               |
| 가짜 통합 테스트       | 1       | 0                                                          |
| 버그를 고정하는 테스트 | 1       | 0                                                          |
| 자기 참조 테스트       | 1       | 0                                                          |
| 구현 세부사항 테스트   | 1       | 0                                                          |
| tsc 에러               | 5       | 0                                                          |
| 소스 코드 버그 수정    | -       | `createLogFrequencyArray` count=1 NaN, Timeline DOM 동기화 |

### 수정된 파일 목록

| 파일                                                     | 수정 내용                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/utils/frequency.ts`                                 | `count <= 1` 가드 추가 (NaN 버그 수정)                              |
| `src/utils/__tests__/frequency.test.ts`                  | count=1 테스트를 올바른 기대값으로 변경                             |
| `src/components/audio/__tests__/SpectrumCanvas.test.tsx` | 의미 없는 2개 테스트 삭제, disconnect 격리 수정                     |
| `src/engine/__tests__/FilterEngine.test.ts`              | Highpass 테스트명·구조 명확화                                       |
| `src/store/__tests__/useAudioStore.test.ts`              | onEnded 가짜 통합 → 실제 engine 경로 검증                           |
| `src/components/ui/__tests__/Knob.test.tsx`              | `renderKnob` 타입을 `KnobProps` 기반으로 수정 (tsc 에러 해소)       |
| `src/components/audio/Timeline.tsx`                      | store `currentTime` 구독 + DOM 동기화 effect 추가 (e2e FR-002 수정) |
