"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

/**
 * Attach to a container element; its direct children fade/slide in, staggered, the first time
 * the container enters the viewport. Fires once (observer disconnects after triggering).
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;

    for (const child of children) {
      child.style.opacity = "0";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          animate(children, {
            opacity: [0, 1],
            translateY: [32, 0],
            delay: stagger(90),
            duration: 700,
            ease: "outExpo",
          });
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
