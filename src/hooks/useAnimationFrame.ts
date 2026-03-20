import { useEffect, useRef } from "react";

/**
 * requestAnimationFrame 래퍼 훅.
 *
 * - callback ref 패턴으로 최신 콜백을 항상 참조
 * - active가 false이면 루프 중지 (리소스 절약)
 * - 탭 비활성화 후 복귀 시 자동으로 루프 재개
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  active: boolean,
) {
  const callbackRef = useRef(callback);
  const rafIdRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!active) {
      previousTimeRef.current = 0;
      return;
    }

    function animate(time: number) {
      if (previousTimeRef.current !== 0) {
        const deltaTime = time - previousTimeRef.current;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      rafIdRef.current = requestAnimationFrame(animate);
    }

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      previousTimeRef.current = 0;
    };
  }, [active]);
}
