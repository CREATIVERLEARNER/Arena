import { StoreHeartbeat } from "@/components/StoreHeartbeat";

/**
 * Phase 1 placeholder — a first breath of the Void aesthetic.
 * The full dashboard shell (header / timer / tasks / sounds) arrives in Phase 2.
 */
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* Ambient glow — barely there, only hinting at what the timer will become */}
      <div
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,124,246,0.07)_0%,transparent_65%)]"
      />

      <p className="animate-fade-in font-mono text-[11px] tracking-[0.5em] text-faint uppercase">
        01 · Architecture
      </p>

      <h1 className="animate-rise mt-8 pl-[0.42em] text-center text-6xl font-light tracking-[0.42em] text-silver sm:text-7xl">
        VOID
      </h1>

      <p className="animate-fade-in mt-5 text-center text-sm font-light tracking-[0.25em] text-mist uppercase">
        Personal Study Sanctuary
      </p>

      <div className="animate-fade-in mt-16 flex flex-col items-center gap-2 text-center font-mono text-[11px] text-faint">
        <p>
          <span className="text-mist">Next.js 16</span> ·{" "}
          <span className="text-mist">TypeScript strict</span> ·{" "}
          <span className="text-mist">Tailwind 4</span> ·{" "}
          <span className="text-mist">Zustand 5</span>
        </p>
        <p className="text-ghost">Phase 2 brings the dashboard to life</p>
      </div>

      <StoreHeartbeat />
    </main>
  );
}
