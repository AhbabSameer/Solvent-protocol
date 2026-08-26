"use client";

import { useEffect, useRef, type DependencyList } from "react";
import { animate, type AnimationParams } from "animejs";

/**
 * Runs a one-off anime.js animation against a ref'd element whenever `deps` change,
 * pausing the previous instance on re-run/unmount so effects never stack.
 */
export function useAnime<T extends Element>(
  params: AnimationParams,
  deps: DependencyList = [],
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = animate(el, params);
    return () => {
      instance.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
