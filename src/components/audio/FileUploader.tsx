"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";

const ACCEPTED_FORMATS = "audio/wav,audio/mpeg,audio/flac,audio/*";

const uploadIcon = (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-text-muted"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const spinnerIcon = (
  <div className="text-accent-cyan animate-spin">
    <svg width="32" height="32" viewBox="0 0 32 32">
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="60 20"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

const compactUploadIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-text-secondary group-hover:text-accent-cyan transition-colors"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export default function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isLoading = useAudioStore((s) => s.isLoading);
  const error = useAudioStore((s) => s.error);
  const fileMetadata = useAudioStore((s) => s.fileMetadata);
  const loadFile = useAudioStore((s) => s.loadFile);

  const handleFile = useCallback(
    (file: File) => {
      loadFile(file);
    },
    [loadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // 파일이 이미 로드된 상태 — 컴팩트 파일 정보 표시
  if (fileMetadata && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => inputRef.current?.click()}
          className="group border-surface-600 bg-surface-800 hover:border-accent-cyan/40 hover:bg-surface-700 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors"
        >
          {compactUploadIcon}
          <span className="text-text-secondary group-hover:text-text-primary">
            {fileMetadata.name}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          onChange={handleChange}
          className="hidden"
        />
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: isDragOver
            ? "var(--color-accent-cyan)"
            : "var(--color-surface-600)",
          backgroundColor: isDragOver
            ? "rgba(0, 229, 255, 0.04)"
            : "transparent",
        }}
        transition={{ duration: 0.15 }}
        className="border-surface-600 hover:border-surface-500 relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-8 py-12 transition-colors"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              {spinnerIcon}
              <span className="text-text-secondary text-xs">Decoding...</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              {uploadIcon}
              <div className="text-center">
                <p className="text-text-secondary text-sm">
                  Drop audio file or{" "}
                  <span className="text-accent-cyan">browse</span>
                </p>
                <p className="text-text-muted mt-1 text-xs">
                  .wav .mp3 .flac supported
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-accent-magenta mt-2 text-center text-xs"
        >
          {error}
        </motion.p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
