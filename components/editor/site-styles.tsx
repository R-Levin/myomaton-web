"use client";

import { useId, useRef } from "react";
import { bodyFontOptions, headingFontOptions } from "@/lib/site-theme";
import { useSiteTheme } from "./site-theme-provider";
import styles from "./editor.module.css";

export function SiteStyles({ disabled = false }: { disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { theme, setTheme } = useSiteTheme();

  return (
    <>
      <button className={styles.button} type="button" disabled={disabled} onClick={() => dialog.current?.showModal()}>
        Site Styles
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>Site Styles</h2>
        <p className={styles.note}>Fonts apply to every block in your working copy. Use Save Draft to keep them, then Publish to update the public site.</p>
        <label className={styles.field}>
          Heading font
          <select
            value={theme.headingFont}
            onChange={(event) => {
              const option = headingFontOptions.find(({ value }) => value === event.target.value);
              if (option) setTheme((current) => ({ ...current, headingFont: option.value }));
            }}
          >
            {headingFontOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          Body font
          <select
            value={theme.bodyFont}
            onChange={(event) => {
              const option = bodyFontOptions.find(({ value }) => value === event.target.value);
              if (option) setTheme((current) => ({ ...current, bodyFont: option.value }));
            }}
          >
            {bodyFontOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <form method="dialog" className={styles.dialogActions}>
          <button className={styles.button} type="submit">Done</button>
        </form>
      </dialog>
    </>
  );
}
