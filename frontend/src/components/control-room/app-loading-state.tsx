export function AppLoadingState() {
  return (
    <div className="flex min-h-[52vh] flex-col items-center justify-center px-6">
      <div className="relative flex items-center justify-center">
        <span
          className="absolute size-28 rounded-full border border-cyan-300/35"
          style={{ animation: "pulseRing 2.6s ease-out infinite" }}
        />
        <span
          className="absolute size-40 rounded-full border border-sky-300/25"
          style={{ animation: "pulseRing 2.6s ease-out 0.65s infinite" }}
        />
        <div
          className="relative rounded-full border border-white/70 bg-white/80 px-8 py-5 text-center shadow-xl backdrop-blur-xl"
          style={{ boxShadow: "var(--shadow-neon)", animation: "waveFloat 3.2s ease-in-out infinite" }}
        >
          <div className="text-[0.68rem] uppercase tracking-[0.34em] text-sky-700/70">
            Loading
          </div>
          <div className="mt-2 font-serif text-4xl text-primary">UpFlow</div>
        </div>
      </div>

      <p className="mt-8 max-w-sm text-center text-sm text-muted-foreground">
        Pulling the latest Xero signals and preparing the control room.
      </p>
    </div>
  );
}
