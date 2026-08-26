"use client";

import type { ReactNode } from "react";
import { useAnime } from "@/hooks/useAnime";
import { GlowBackground } from "./GlowBackground";

export function Hero({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const headlineRef = useAnime<HTMLDivElement>(
    { opacity: [0, 1], translateY: [24, 0], duration: 800, ease: "outExpo" },
    [],
  );

  return (
    <section className="relative flex min-h-[70vh] flex-col justify-center gap-6 overflow-hidden px-6 py-24 sm:px-10">
      <GlowBackground />
      <div ref={headlineRef} className="max-w-2xl">
        <p className="mb-4 text-xs tracking-[0.3em] text-accent uppercase">
          {eyebrow}
        </p>
        <h1 className="display-hero text-5xl sm:text-7xl lg:text-8xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-6 max-w-xl text-lg text-muted">{subtitle}</p>
        ) : null}
        {action ? <div className="mt-10">{action}</div> : null}
      </div>
    </section>
  );
}
