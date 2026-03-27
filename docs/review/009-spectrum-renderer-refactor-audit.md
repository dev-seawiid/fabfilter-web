# Review 009: Spectrum Renderer 리팩토링 — React 렌더 사이클 제거

- **Phase**: Post-Phase 6 (성능 최적화)
- **Date**: 2026-03-27
- **Scope**: useSpectrumData, useSpectrumRenderer, AnalyserBridge, FilterEngine, Knob, useAudioStore

## 발견된 문제들

### 1. useSpectrumRenderer가 useEffect로 Canvas를 그리고 있었음 (HIGH)

**증상**: 재생 중 JS Heap이 18.9MB → 53.2MB로 지속 상승, DOM Nodes 347 → 2,050으로 6배 증가.

**원인**: `useSpectrumData`가 `useSyncExternalStore`를 통해 매 프레임 새 snapshot 객체를 React에 전달 → React가 `SpectrumCanvas` 컴포넌트를 60fps로 리렌더링 → `useEffect`에서 Canvas 드로잉 실행. 매 프레임 React fiber 노드가 생성되어 Heap과 DOM Nodes가 누적됨.

**이전 데이터 흐름**:
```
rAF → useSpectrumData → useSyncExternalStore → React 리렌더 → useEffect → Canvas
```

**수정**: `useSpectrumData`와 `useSpectrumRenderer`를 하나로 통합. rAF 콜백 안에서 FFT 수집 → EMA 스무딩 → Canvas 드로잉을 모두 처리하여 React 렌더 사이클을 완전히 우회.

**수정 후 데이터 흐름**:
```
rAF → FFT 수집 + 스무딩 + Canvas 드로잉 (React 우회)
```

**결과**:
- Long Task: 0개 (이전: 측정 불가)
- FPS: 60.7fps
- JS Heap 증가: 0MB / 3초 (이전: 1.56MB/초)
- 1st party Scripting: 0.68% (이전: 5.9%)

### 2. FilterEngine.getFrequencyResponse()가 매 프레임 Float32Array를 할당 (MEDIUM)

**증상**: Zero-Allocation 패턴을 포트폴리오에서 주장했으나, `getFrequencyResponse()` 내부에서 매 호출 `new Float32Array(256)` 2개를 생성하고 있었음.

**수정**: `magBuffer`와 `phaseBuffer`를 `new Float32Array(0)`으로 사전 할당하고, 크기가 다를 때만 재할당하도록 변경.

### 3. AnalyserBridge.getData()가 매 프레임 래퍼 객체를 할당 (MEDIUM)

**증상**: `{ pre, post }` 래퍼 객체를 매 프레임 새로 생성.

**수정**: `dataResult` 객체를 생성자에서 사전 할당하고, `getData()` 호출 시 동일 참조를 반환.

### 4. Q 노브가 시각적으로 움직이지 않는 버그 (HIGH)

**증상**: Q 노브를 드래그하면 값(0.1~18)은 변경되지만, 노브의 시각적 위치(SVG 아크)가 항상 최소 위치에 고정됨.

**원인**: `Knob.tsx`의 `LOG_FLOOR`가 20으로 하드코딩되어 있어, Q 노브(`min=0.1, max=18, logarithmic=true`)에서 `effectiveMin = Math.max(0.1, 20) = 20`이 됨. `effectiveMin(20) > max(18)`이므로 `valueToNormalized()`가 항상 0을 반환.

**수정**: `Math.max(min, LOG_FLOOR)` → `min > 0 ? min : LOG_FLOOR`. `LOG_FLOOR`는 `min=0`(Cutoff 노브)일 때만 적용되도록 변경.

**테스트 추가**: Q 노브 범위(`min=0.1, max=18, logarithmic=true`)에서 min값일 때 아크 없음, max값일 때 풀 아크, 중간값일 때 아크 존재를 검증하는 테스트 추가.

**왜 기존 테스트에서 잡히지 않았는가**:
- Knob 로그 스케일 테스트가 Cutoff 범위(`min=0, max=20000`)만 검증
- SpectrumCanvas 테스트는 `useSpectrumData`를 통째로 mock하여 실제 `useSyncExternalStore` 동작을 검증하지 않음
- E2E 테스트의 "Canvas 렌더링 확인"은 한 시점의 `filledRatio > 0`만 검증하여, Canvas가 첫 프레임에서 멈춰도 통과

### 5. AudioEngine 싱글턴이 HMR에서 깨질 수 있었음 (LOW)

**증상**: 개발 환경에서 HMR 시 모듈 스코프 `let engine = null`이 초기화되어, 이전 AudioContext가 해제되지 않은 채 새 인스턴스가 생성될 수 있었음.

**수정**: `globalThis`에 인스턴스를 저장하여 모듈 재평가와 무관하게 싱글턴 유지. Prisma 패턴의 클라이언트 사이드 등가물.

### 6. useSyncExternalStore와 mutable snapshot 비호환 (MEDIUM)

**증상**: Zero-Allocation을 위해 `spectrumSnapshot` 객체를 매 프레임 재사용(mutate)하도록 변경했더니, Canvas가 첫 프레임에서 멈춤.

**원인**: `useSyncExternalStore`는 `getSnapshot()`의 반환값을 `Object.is()`로 비교. 동일 객체를 mutate하면 참조가 같아 "변경 없음"으로 판단.

**학습**: React의 불변성 원칙과 외부 스토어 연결 시의 제약. 이 문제는 리팩토링(#1)에서 `useSyncExternalStore` 자체를 제거하여 근본적으로 해결됨.

### 7. E2E 테스트 — 스펙트럼 실시간 업데이트 검증 누락 (LOW)

**증상**: `useSyncExternalStore` 변경 감지 실패로 Canvas가 멈추는 버그를 E2E에서 잡지 못함.

**수정**: 화이트 노이즈 음원으로 300ms 간격의 두 Canvas 스냅샷을 비교하여, 스펙트럼이 정지 화면이 아닌 실시간 업데이트인지 검증하는 테스트 추가. 사인파(440Hz)는 스펙트럼이 일정하여 이 테스트에 부적합 → 화이트 노이즈 사용.

## 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/hooks/useSpectrumRenderer.ts` | useSpectrumData 의존 제거, rAF 안에서 FFT 수집 + Canvas 드로잉 통합 |
| `src/hooks/useSpectrumData.ts` | 더 이상 useSpectrumRenderer에서 import하지 않음 (향후 제거 가능) |
| `src/engine/FilterEngine.ts` | magBuffer/phaseBuffer 사전 할당 |
| `src/engine/AnalyserBridge.ts` | dataResult 객체 사전 할당 |
| `src/components/ui/Knob.tsx` | LOG_FLOOR 조건 수정 (min > 0 ? min : LOG_FLOOR) |
| `src/components/ui/__tests__/Knob.test.tsx` | Q 노브 시각 위치 테스트 추가 |
| `src/components/audio/__tests__/SpectrumCanvas.test.tsx` | useSpectrumRenderer mock으로 변경 |
| `src/store/useAudioStore.ts` | globalThis 싱글턴 패턴 적용 |
| `e2e/visualization.spec.ts` | 스펙트럼 실시간 업데이트 검증 테스트 + 화이트 노이즈 생성 함수 추가 |

## 성능 비교 (프로덕션 빌드, 화이트 노이즈 재생)

| 지표 | 리팩토링 전 | 리팩토링 후 |
|------|------------|------------|
| FPS | 측정 불가 (프레임 드롭) | 60.7fps |
| Long Task | 134.97ms (페이지 로드 시) | 0개 |
| JS Heap 증가율 | 1.56MB/초 | 0MB/3초 |
| 1st party Scripting | 5.9% | 0.68% |
| DOM Nodes 증가 | +1,703 (15초) | 안정 |
