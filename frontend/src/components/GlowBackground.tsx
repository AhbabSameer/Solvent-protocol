"use client";

import { useAnime } from "@/hooks/useAnime";

function Blob({
  className,
  size,
  color,
  driftX,
  driftY,
  duration,
}: {
  className: string;
  size: number;
  color: string;
  driftX: [number, number];
  driftY: [number, number];
  duration: number;
}) {
  const ref = useAnime<HTMLDivElement>(
    {
      translateX: driftX,
      translateY: driftY,
      duration,
      loop: true,
      alternate: true,
      ease: "inOutSine",
    },
    [],
  );

  return (
    <div
      ref={ref}
      className={`absolute rounded-full blur-3xl ${className}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

/**
 * Ambient glowing blobs behind hero content. Earlier attempts (a rotating CSS cube, then a
 * faceted SVG gem) anchored to one edge as a discrete "figure" and looked awkward/out of place.
 * This is a full-bleed background layer instead — always clipped to the parent section's
 * `overflow-hidden`, so it can never spill out or read as stuck in a corner.
 */
export function GlowBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <Blob
        className="-top-40 -left-32"
        size={480}
        color="rgba(182,255,60,0.35)"
        driftX={[-20, 20]}
        driftY={[-15, 15]}
        duration={9000}
      />
      <Blob
        className="top-1/4 -right-40"
        size={420}
        color="rgba(182,255,60,0.22)"
        driftX={[15, -15]}
        driftY={[20, -20]}
        duration={11000}
      />
      <Blob
        className="bottom-[-12rem] left-1/3"
        size={520}
        color="rgba(140,140,255,0.16)"
        driftX={[-10, 10]}
        driftY={[10, -10]}
        duration={13000}
      />
    </div>
  );
}
