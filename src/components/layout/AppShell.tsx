export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      {/* 상단: SpectrumCanvas (Phase 4) */}
      <section className="flex flex-1 items-center justify-center">
        <h1 className="text-4xl font-bold tracking-tight">Fabfilter Web</h1>
      </section>

      {/* 중단: Controls (Phase 3~4) */}
      <section className="border-t border-neutral-800 p-4">
        <p className="text-center text-sm text-neutral-500">
          Audio controls will appear here
        </p>
      </section>
    </div>
  );
}
