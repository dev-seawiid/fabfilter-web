# Review 002: Test Quality Audit

**Date**: 2026-03-20
**Scope**: Phase 1 (US1) 전체 테스트 코드 — Unit, Component, E2E
**Status**: Complete

---

## 발견 및 수정 결과

### 의미 없는/약한 테스트

| # | 파일 | 문제 | 상태 |
|---|------|------|------|
| 1 | `useAudioStore.test.ts` | 초기 상태 7개 테스트 → `toMatchObject` 1개로 통합 | DONE |
| 2 | `e2e/playback.spec.ts` "Seeking" | 실제 타임라인 클릭 + 시간 변경 검증으로 교체 | DONE |
| 3 | `e2e/playback.spec.ts` "재업로드" | Play 버튼 활성화 + 시간 0:00 리셋 검증 추가 | DONE |

### 핵심 경로 미검증 → 보강

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 4 | `loadFile` 에러 경로 | DONE | `FailingCtx` 서브클래스로 decodeAudioData reject 테스트 |
| 5 | `play` 에러 경로 | DONE | `FailingCtx` 서브클래스로 resume reject 테스트 |
| 6 | `getPlaybackInfo()` 정확성 | DONE | 초기값 + seek 후 반환값 검증 |
| 7 | `getCurrentTime()` 재생 중 계산 | DONE | 5개 시나리오: offset+elapsed, 경계값, 정지 후, 버퍼 없음 |
| 8 | `seek` 재생 중 동작 | DONE | stop→play 체인 + 새 SourceNode 생성 검증 |
| 9 | `onEnded` → store 리셋 통합 | DONE | setState 직접 호출로 통합 검증 |
| 10 | `dispose` 노드 disconnect 검증 | DONE | 4개 노드 disconnect + close + 재생 중 dispose |
| 11 | E2E: 실제 타임라인 클릭 Seeking | DONE | boundingBox 50% 클릭 + 시간 변경 확인 |
| 12 | E2E: 재생 완료 후 상태 초기화 | DONE | 1초 파일 재생 완료 → Play 복귀 + 0:00 리셋 |
| 13 | E2E: 재업로드 시 상태 리셋 강화 | DONE | seek 후 재업로드 → 0:00 리셋 + Play 활성화 |

### 테스팅 패턴 개선

| # | 항목 | 상태 |
|---|------|------|
| 14 | Framer Motion mock → 공유 `src/__mocks__/framer-motion.tsx` 추출 | DONE |
| 15 | `dispose` 테스트 설명-검증 불일치 → disconnect 4개 + close 분리 | DONE |
| 16 | `vitest/globals` tsconfig 타입 등록 (기존 tsc 에러 해소) | DONE |

### 실제 버그 발견

| 파일 | 버그 | 수정 |
|------|------|------|
| `AudioEngine.ts:stop()` | `isPlaying=false` 후 `getCurrentTime()` 호출 → 경과 시간 무시, 항상 이전 offset 반환 | 순서 교체: `getCurrentTime()` 먼저, `isPlaying=false` 나중 |

---

## 최종 테스트 현황

| 카테고리 | 파일 | 수정 전 | 수정 후 |
|----------|------|--------|--------|
| Engine Unit | `AudioEngine.test.ts` | 14 | 25 |
| Store Unit | `useAudioStore.test.ts` | 12 | 15 |
| Component | `PlaybackControls.test.tsx` | 6 | 7 |
| Component | `FileUploader.test.tsx` | 6 | 6 |
| E2E | `playback.spec.ts` | 5 | 7 |
| **합계** | | **43** | **60** |

**검증**: `vitest run` 59 passed, `tsc --noEmit` 0 errors, `eslint .` 0 errors
