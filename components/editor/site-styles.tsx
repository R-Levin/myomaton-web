"use client";

import { useId, useRef } from "react";
import {
  baseTextSizeOptions, bodyFontOptions, contentWidthOptions, headingFontOptions,
  headingScaleOptions, spacingOptions, textContrast,
} from "@/lib/site-theme";
import { useSiteTheme } from "./site-theme-provider";
import styles from "./editor.module.css";

function StyleSelect<T extends string>({ name, label, value, options, onChange }: {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className={styles.field}>
      {label}
      <select name={name} value={value} onChange={(event) => {
        const option = options.find(({ value }) => value === event.target.value);
        if (option) onChange(option.value);
      }}>
        {options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

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
        <p className={styles.note}>Changes apply to every block in your working copy. Use Save Draft to keep them, then Publish to update the public site.</p>
        <fieldset className={styles.styleGroup}>
          <legend>Typography</legend>
          <p className={styles.groupHelp}>Set the reading size and how much emphasis headings receive.</p>
          <div className={styles.styleGrid}>
            <StyleSelect name="headingFont" label="Heading font" value={theme.headingFont} options={headingFontOptions}
              onChange={(headingFont) => setTheme((current) => ({ ...current, headingFont }))} />
            <StyleSelect name="bodyFont" label="Body font" value={theme.bodyFont} options={bodyFontOptions}
              onChange={(bodyFont) => setTheme((current) => ({ ...current, bodyFont }))} />
            <StyleSelect name="baseTextSize" label="Base text size" value={theme.baseTextSize} options={baseTextSizeOptions}
              onChange={(baseTextSize) => setTheme((current) => ({ ...current, baseTextSize }))} />
            <StyleSelect name="headingScale" label="Heading scale" value={theme.headingScale} options={headingScaleOptions}
              onChange={(headingScale) => setTheme((current) => ({ ...current, headingScale }))} />
          </div>
        </fieldset>
        <fieldset className={styles.styleGroup}>
          <legend>Colors</legend>
          <p className={styles.groupHelp}>Accent colors highlight section details and buttons.</p>
          <div className={styles.colorGrid}>
            {([
              ["accentColor", "Accent color"],
              ["backgroundColor", "Background color"],
              ["textColor", "Text color"],
            ] as const).map(([key, label]) => (
              <label className={styles.field} key={key}>
                {label}
                <input type="color" name={key} value={theme[key]}
                  onChange={(event) => setTheme((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
          {textContrast(theme) < 4.5 && <p className={styles.contrastNote} role="status">Text may be difficult to read. Try a stronger contrast between text and background.</p>}
        </fieldset>
        <fieldset className={styles.styleGroup}>
          <legend>Layout</legend>
          <p className={styles.groupHelp}>Set the default reading width and breathing room. Block choices adjust these defaults. Widths adapt to smaller screens.</p>
          <div className={styles.styleGrid}>
            <StyleSelect name="contentWidth" label="Content width" value={theme.contentWidth} options={contentWidthOptions}
              onChange={(contentWidth) => setTheme((current) => ({ ...current, contentWidth }))} />
            <StyleSelect name="sectionSpacing" label="Section spacing" value={theme.sectionSpacing} options={spacingOptions}
              onChange={(sectionSpacing) => setTheme((current) => ({ ...current, sectionSpacing }))} />
          </div>
        </fieldset>
        <form method="dialog" className={styles.dialogActions}>
          <button className={styles.button} type="submit">Done</button>
        </form>
      </dialog>
    </>
  );
}
