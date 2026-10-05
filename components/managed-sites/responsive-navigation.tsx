"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Only disclosure state is client-owned; the navigation tree remains a
// server-rendered child, with one set of links at every viewport size.
export function ResponsiveNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const button = useRef<HTMLButtonElement>(null);
  return <div ref={container} className="managed-site-primary-menu" data-open={open} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      setOpen(false); button.current?.focus(); event.stopPropagation();
    }
  }}>
    <button ref={button} type="button" className="managed-site-menu-toggle"
      aria-label={open ? "Close primary navigation menu" : "Primary navigation menu"} aria-expanded={open} aria-controls={id}
      onKeyDown={event => {
        if (event.key === "ArrowDown") {
          event.preventDefault(); setOpen(true);
          requestAnimationFrame(() => panel.current?.querySelector<HTMLAnchorElement>("a")?.focus());
        }
      }}
      onClick={() => setOpen(!open)}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={open ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 17h16"} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>{open ? "Close" : "Menu"}</span>
    </button>
    <div ref={panel} id={id} className="managed-site-menu-panel" onClick={event => {
      if ((event.target as Element).closest("a")) { setOpen(false); button.current?.focus(); }
    }}>{children}</div>
  </div>;
}
