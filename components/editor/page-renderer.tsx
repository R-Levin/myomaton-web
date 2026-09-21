"use client";

import { Render } from "@puckeditor/core";
import { editorConfig } from "@/lib/editor/config";
import type { WorkingCopy } from "@/types/content";
import { SiteThemeProvider } from "./site-theme-provider";

// Preview and public rendering use exactly the editor's registered blocks and root.
export function PageRenderer({ snapshot }: { snapshot: WorkingCopy }) {
  return (
    <SiteThemeProvider theme={snapshot.theme}>
      <Render config={editorConfig} data={snapshot.page} />
    </SiteThemeProvider>
  );
}
