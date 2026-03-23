"use client";

import { useEffect } from "react";

/**
 * T060: Next.js App Router error boundary.
 *
 * AudioEngine 예외, React 렌더링 에러 등 모든 미처리 에러를 포착한다.
 * Fabfilter 스타일 다크 UI로 에러 상태를 표시하고, 재시도 버튼을 제공한다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Fabfilter Web] Unhandled error:", error);
  }, [error]);

  return (
    <div className="bg-surface-950 flex h-screen flex-col items-center justify-center gap-6 px-6">
      {/* 에러 아이콘 */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <span className="text-2xl">⚠</span>
      </div>

      {/* 메시지 */}
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <h2 className="text-text-primary text-lg font-medium">
          Something went wrong
        </h2>
        <p className="text-text-muted text-sm">
          {error.message || "An unexpected error occurred in the audio engine."}
        </p>
        {error.digest && (
          <code className="text-text-muted mt-1 text-xs opacity-50">
            {error.digest}
          </code>
        )}
      </div>

      {/* 재시도 */}
      <button
        type="button"
        onClick={reset}
        className="border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 rounded-lg border px-6 py-2 text-sm transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
