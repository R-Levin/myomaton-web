"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { heroMotion, serializeMotionEvents } from "../../lib/platform/visual-direction/motion";

// Hero timing belongs to initial CSS, never a post-paint JavaScript reset.
// This boundary only serializes optional policy-permitted downstream entries.
export function PageMotion({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!enabled || !element || !window.matchMedia) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const heroes = element.querySelectorAll<HTMLElement>('[data-motion-entrance="initial"]');
    const consumers = element.querySelectorAll("[data-motion-slot]:not(.managed-site-section-hero) > .managed-site-section-inner");
    if (!consumers.length) return;
    const animations: Animation[] = [];
    let stopped = false;
    let observer: IntersectionObserver | undefined;
    const parts = [...heroes].flatMap(hero => [...hero.querySelectorAll<HTMLElement>("[data-hero-part]")]);
    const reservations = parts.flatMap(part => typeof part.getAnimations === "function" ? part.getAnimations() : []);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let release: (() => void) | undefined;
    let queue: Promise<unknown> = parts.every(part => typeof part.getAnimations === "function")
      ? Promise.all(reservations.map(animation => animation.finished.catch(() => undefined)))
      : new Promise<void>(resolve => { release = resolve; timer = setTimeout(resolve, heroes.length * 1400); });
    // Hero path never reads or requires IntersectionObserver.
    if (consumers.length && window.IntersectionObserver) {
      const seen = new WeakSet<Element>();
      observer = new window.IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target); observer?.unobserve(entry.target);
          queue = queue.then(() => serializeMotionEvents([], () => {
            if (entry.target.matches(":focus-within") || typeof entry.target.animate !== "function") return;
            const animation = entry.target.animate([{ opacity: .35, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }],
              { duration: 460, easing: heroMotion.easing, iterations: 1 });
            animations.push(animation); return animation;
          }, () => stopped || preference.matches)).catch(() => undefined);
        }
      }, { threshold: .1 });
      consumers.forEach(node => observer!.observe(node));
    }
    const stop = () => { stopped = true; observer?.disconnect(); animations.forEach(animation => animation.cancel()); if (timer) clearTimeout(timer); release?.(); };
    preference.addEventListener("change", stop);
    return () => { stop(); preference.removeEventListener("change", stop); };
  }, [enabled]);
  return <main ref={root}>{children}</main>;
}
