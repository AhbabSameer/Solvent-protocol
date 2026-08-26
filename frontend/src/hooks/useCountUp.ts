"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";

/**
 * Tweens a numeric display value toward `target` with anime.js (v4 renamed `easing` -> `ease`
 * and easing names dropped the "ease" prefix, e.g. "outExpo" not "easeOutExpo" — don't revert this).
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = useState(target);
  const stateRef = useRef({ value: target });

  useEffect(() => {
    const state = stateRef.current;
    const instance = animate(state, {
      value: target,
      duration: durationMs,
      ease: "outExpo",
      onUpdate: () => setDisplay(state.value),
    });

    return () => {
      instance.pause();
    };
  }, [target, durationMs]);

  return display;
}
