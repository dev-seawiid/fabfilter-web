# 🎧 Fabfilter Web체크리스트

## 1. 데이터 수집 및 바이너리 핸들링 (Data Ingestion)

- [ ] **대용량 파일 디코딩**: `input(file)`로 받은 데이터를 `ArrayBuffer`로 읽고, `decodeAudioData`를 통해 오디오 샘플로 변환하는 파이프라인이 안정적인가?
- [ ] **메모리 클린업**: 새로운 파일을 업로드할 때 기존 `AudioContext`와 `AudioBufferSourceNode`를 명시적으로 해제/정지하여 메모리 누수를 방지했는가?
- [ ] **로딩 상태 관리**: 디코딩 중 UI가 멈추지 않도록 비동기 처리를 구현하고, 사용자에게 진행 상태를 시각적으로 전달하는가?

## 2. 실시간 타임라인 및 재생 제어 (Playback & Seeking)

- [ ] **정밀한 재생/정지**: `AudioContext.resume/suspend` 또는 `SourceNode.start/stop`을 사용하여 지연 없는 재생 컨트롤을 구현했는가?
- [ ] **원하는 위치로 이동 (Seeking)**: 타임라인 클릭 시 현재 재생 시간을 계산하고, 해당 offset 지점부터 오디오가 즉시 재개되도록 설계했는가?
- [ ] **UI-오디오 시간 동기화**: `AudioContext.currentTime`과 `requestAnimationFrame`을 결합하여 현재 재생 위치 표시 바(Playhead)가 60fps로 매끄럽게 이동하는가?
- [ ] **루프(Loop) 및 끝점 처리**: 오디오 재생이 끝났을 때 상태를 초기화하거나 자동으로 처음으로 돌아가는 대응 로직이 있는가?

## 3. 고정밀 오디오 엔진 및 노드 가시화 (Engine & Node Graph)

- [ ] **표준 필터 노드 설계**: `BiquadFilterNode`의 `highpass` 타입을 활용해 Low-cut을 구현하고, Cutoff 주파수 조절이 실시간으로 가능한가?
- [ ] **노드 그래프 가시화 (Observability)**: `Source -> Filter -> Analyzer -> Destination`으로 이어지는 노드 간의 연결 상태와 데이터 흐름을 사용자가 직관적으로 파악할 수 있는가?
- [ ] **디지털 노이즈(Pop) 방지**: 필터 값 변경이나 Seeking 시 파라미터가 급격히 변하지 않도록 `setTargetAtTime` 등 Smoothing을 적용했는가?
- [ ] **신호 경로 제어(Gain)**: 출력 단계의 `GainNode`를 통해 전체 볼륨을 정밀하게 제어하고 모니터링하는가?

## 4. 실시간 시각화 및 분석 (Visual Analytics)

- [ ] **60fps FFT 분석기**: `AnalyserNode`를 활용해 재생 중인 파일의 주파수 데이터를 실시간으로 추출하는가?
- [ ] **Fabfilter 스타일 응답 곡선**: FFT 로우 데이터를 가공(Smoothing)하여 필터 적용 영역의 감쇄 현상을 부드러운 곡선으로 렌더링하는가?
- [ ] **임계치 피크 모니터링**: 오디오 신호가 0dB을 초과하여 Clipping 위험이 있을 때 시각적 경고(Peak LED)를 즉각 노출하는가?

## 5. 성능 최적화 및 안정성 (Performance & Reliability)

- [ ] **브라우저 렌더링 최적화**: FFT 시각화, 노드 그래프, 타임라인 드로잉 부하가 메인 스레드 점유율을 15% 이하로 유지하는가?
- [ ] **자동화된 수학적 검증**: `Vitest`를 활용해 특정 주파수 입력 시 필터의 감쇄율이 이론적 수치와 일치하는지 단위 테스트를 수행하는가?
- [ ] **상태 정합성 확보**: 재생 상태, 현재 시간, 필터 파라미터가 단일 소스(Single Source of Truth)로 관리되어 UI와 엔진 간 불일치가 없는가?
