"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { Puck } from "@puckeditor/core";
import { editorConfig } from "@/lib/editor/config";
import { initialEditorData } from "@/lib/editor/initial-data";
import { defaultSiteTheme } from "@/lib/site-theme";
import { parseHomepageContent, parsePageData, sameWorkingCopy } from "@/lib/content/validation";
import { readRecovery, RECOVERY_KEY, writePreview, writeRecovery } from "@/lib/editor/browser-storage";
import type { HomepageContent, RecoverySnapshot, WorkingCopy } from "@/types/content";
import type { SiteTheme } from "@/types/site-theme";
import type { EditorData } from "@/types/editor";
import { PreviewFrame, SiteThemeProvider } from "./site-theme-provider";
import { SiteStyles } from "./site-styles";
import styles from "./editor.module.css";

const overrides = { headerActions: () => <></>, iframe: PreviewFrame };

async function updateContent(method: "PUT" | "POST", body: unknown): Promise<HomepageContent> {
  const response = await fetch("/api/editor/home", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request failed.");
  return parseHomepageContent(result);
}

export function SiteEditor({ initialContent }: { initialContent: HomepageContent }) {
  const [content, setContent] = useState(initialContent);
  const [working, setWorking] = useState<WorkingCopy>(() => initialContent.draft?.snapshot ?? {
    page: initialEditorData, theme: defaultSiteTheme,
  });
  const [seed, setSeed] = useState(working.page);
  const [editorKey, setEditorKey] = useState(0);
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = !content.draft || !sameWorkingCopy(working, content.draft.snapshot);
  const latest = useRef({ working, dirty, savedAt: content.draft?.savedAt ?? null });

  useEffect(() => {
    latest.current = { working, dirty, savedAt: content.draft?.savedAt ?? null };
  }, [working, dirty, content.draft]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try { setRecovery(readRecovery(localStorage, initialContent.draft)); }
      catch { setError("Recovery storage is unavailable or invalid. Save Draft explicitly to preserve your work."); }
      setReady(true);
    });
    return () => { active = false; };
  }, [initialContent.draft]);

  useEffect(() => {
    if (!ready || recovery) return;
    const capture = () => {
      const current = latest.current;
      try {
        if (current.dirty) writeRecovery(localStorage, current.working, current.savedAt);
        else localStorage.removeItem(RECOVERY_KEY);
      } catch { setError("Recovery storage is unavailable. Save Draft explicitly to preserve your work."); }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") capture(); };
    const onLeave = (event: BeforeUnloadEvent) => {
      capture();
      if (latest.current.dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    const timer = window.setInterval(capture, 5000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", capture);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", capture);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [ready, recovery]);

  const onPageChange = useCallback((page: EditorData) => {
    setWorking((current) => ({ ...current, page: parsePageData(page) }));
  }, []);
  const setTheme = useCallback((action: SetStateAction<SiteTheme>) => {
    setWorking((current) => ({ ...current, theme: typeof action === "function" ? action(current.theme) : action }));
  }, []);

  async function saveDraft() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const saved = await updateContent("PUT", { snapshot: working, expectedSavedAt: content.draft?.savedAt ?? null });
      setContent(saved);
      try {
        if (sameWorkingCopy(latest.current.working, working)) localStorage.removeItem(RECOVERY_KEY);
        else writeRecovery(localStorage, latest.current.working, saved.draft!.savedAt);
      } catch { setError("Draft saved, but browser recovery storage could not be updated."); }
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (busy || dirty || !content.draft) return;
    setBusy(true); setError("");
    try { setContent(await updateContent("POST", { expectedSavedAt: content.draft.savedAt })); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function discardRecovery() {
    try { localStorage.removeItem(RECOVERY_KEY); setRecovery(null); }
    catch { setError("Could not discard recovery storage. Check browser storage permissions."); }
  }

  return (
    <SiteThemeProvider theme={working.theme} setTheme={setTheme}>
      <div className={styles.shell}>
        <div className={styles.toolbar} aria-label="Homepage workflow">
          <div className={styles.controls}>
            <button className={styles.button} disabled={busy || !ready || !!recovery || !dirty} onClick={saveDraft}>Save Draft</button>
            <a className={styles.button} href="/preview/home" target="_blank" rel="noopener noreferrer" aria-disabled={!ready || !!recovery} onClick={(event) => {
              if (!ready || recovery) { event.preventDefault(); return; }
              try { writePreview(localStorage, working); }
              catch { event.preventDefault(); setError("Preview storage is unavailable. No draft or published content was changed."); }
            }}>Preview</a>
            <button className={styles.button} disabled={busy || !ready || !!recovery || dirty || !content.draft} onClick={publish} title={dirty ? "Save Draft before publishing" : undefined}>Publish</button>
            <SiteStyles disabled={!ready || !!recovery} />
          </div>
          <div className={styles.status} aria-live="polite">
            <strong>{dirty ? "Unsaved changes" : "Saved Draft"}</strong>
            <span>{content.draft ? <>Saved: <time dateTime={content.draft.savedAt}>{content.draft.savedAt}</time></> : "No saved draft"}</span>
            <span>{content.published ? <>Published: <time dateTime={content.published.publishedAt}>{content.published.publishedAt}</time></> : "Not published"}</span>
            {busy && <span>Working…</span>}
          </div>
          {dirty && <p className={styles.hint}>Save Draft before publishing. Recovery copies do not save or publish your work.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
        {!ready ? <p className={styles.notice}>Checking for a recovery copy…</p> : recovery ? (
          <section className={styles.notice} aria-labelledby="recovery-title">
            <h2 id="recovery-title">A newer recovery copy is available</h2>
            <p>Captured {recovery.capturedAt}. It has not been saved or published.</p>
            <div className={styles.controls}>
              <button className={styles.button} onClick={() => {
                setWorking(recovery.snapshot); setSeed(recovery.snapshot.page);
                setEditorKey((key) => key + 1); setRecovery(null);
              }}>Restore recovery copy</button>
              <button className={styles.button} onClick={discardRecovery}>Discard recovery copy</button>
            </div>
          </section>
        ) : <Puck key={editorKey} config={editorConfig} data={seed} onChange={onPageChange}
          headerTitle="Myomaton" headerPath="/editor" overrides={overrides} />}
      </div>
    </SiteThemeProvider>
  );
}
