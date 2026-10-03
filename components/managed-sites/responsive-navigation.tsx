"use client";

import { useId, useRef, useState, type ReactNode } from "react";

// Only disclosure state is client-owned; the navigation tree remains a
// server-rendered child, with one set of links at every viewport size.
export function ResponsiveNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  return <div className="managed-site-primary-menu" data-open={open} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      setOpen(false); button.current?.focus(); event.stopPropagation();
    }
  }}>
    <button ref={button} type="button" className="managed-site-menu-toggle"
      aria-label="Primary navigation menu" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(!open)}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>Menu</span>
    </button>
    <div id={id} className="managed-site-menu-panel" onClick={event => {
      if ((event.target as Element).closest("a")) setOpen(false);
    }}>{children}</div>
  </div>;
}
