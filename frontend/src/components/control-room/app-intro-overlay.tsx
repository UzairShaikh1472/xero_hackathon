import { useEffect, useState } from "react";
import { UpFlowBrand } from "@/components/control-room/upflow-logo";

const INTRO_KEY = "upflow-home-intro-v2";

export function AppIntroOverlay() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seen = window.sessionStorage.getItem(INTRO_KEY);
    if (seen === "1") return;

    setVisible(true);
    window.sessionStorage.setItem(INTRO_KEY, "1");

    const fadeTimer = window.setTimeout(() => setFadeOut(true), 2200);
    const hideTimer = window.setTimeout(() => setVisible(false), 2900);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[rgba(242,248,255,0.84)] backdrop-blur-2xl transition-opacity duration-700"
      style={{ opacity: fadeOut ? 0 : 1 }}
    >
      <div className="relative flex items-center justify-center">
        <span
          className="absolute h-44 w-44 rounded-full border border-cyan-300/35"
          style={{ animation: "pulseRing 2.5s ease-out infinite" }}
        />
        <span
          className="absolute h-64 w-64 rounded-full border border-sky-300/20"
          style={{ animation: "pulseRing 2.5s ease-out 0.4s infinite" }}
        />

        <div className="absolute inset-y-0 left-[-108px] flex items-center gap-3 opacity-80">
          {[0, 1, 2].map((item) => (
            <span
              key={`left-${item}`}
              className="block h-28 w-2.5 rounded-full bg-gradient-to-b from-cyan-300/25 via-sky-400/70 to-cyan-200/20"
              style={{
                animation: `waveFloat ${2.6 + item * 0.24}s ease-in-out ${item * 0.1}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-y-0 right-[-108px] flex items-center gap-3 opacity-80">
          {[0, 1, 2].map((item) => (
            <span
              key={`right-${item}`}
              className="block h-28 w-2.5 rounded-full bg-gradient-to-b from-cyan-300/25 via-sky-400/70 to-cyan-200/20"
              style={{
                animation: `waveFloat ${2.8 + item * 0.22}s ease-in-out ${item * 0.16}s infinite`,
              }}
            />
          ))}
        </div>

        <div
          className="relative rounded-full border border-white/90 bg-white/88 px-10 py-6 text-center backdrop-blur-xl"
          style={{ boxShadow: "var(--shadow-neon)" }}
        >
          <div className="text-[0.68rem] uppercase tracking-[0.34em] text-sky-700/65">
            Welcome
          </div>
          <div className="mt-3 flex justify-center">
            <UpFlowBrand size={44} textClassName="text-5xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
