"use client";

import { useEffect, useState } from "react";
import type { WorkingCopy } from "@/types/content";
import { readPreview } from "@/lib/editor/browser-storage";
import { PageRenderer } from "./page-renderer";

export function WorkingPreview() {
  const [snapshot, setSnapshot] = useState<WorkingCopy | null>(null);
  const [message, setMessage] = useState("Loading preview…");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const preview = readPreview(localStorage);
        setSnapshot(preview);
        if (!preview) setMessage("No preview copy is available. Open Preview from the editor.");
      } catch {
        setMessage("The local preview could not be read. Open Preview again from the editor.");
      }
    });
    return () => { active = false; };
  }, []);
  return snapshot ? <PageRenderer snapshot={snapshot} /> : <main><p>{message}</p></main>;
}
