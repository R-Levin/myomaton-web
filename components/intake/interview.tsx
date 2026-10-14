"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { questions, questionTitle, currentScreenAnswers, normalizeAnswers, validateComplete, questionErrors, IntakeError, reviewConfirmation, type Answers } from "../../lib/platform/intake/model";
import type { IntakeView } from "../../lib/platform/intake/service";
import styles from "./interview.module.css";
import { InterviewQuestion } from "./question";

async function request(operation?: Record<string, unknown>): Promise<IntakeView | { state: "not_started" }> {
  const response = await fetch("/api/intake", { method: operation ? "POST" : "GET", cache: "no-store", headers: { "X-Intake-Request": "1", ...(operation ? { "Content-Type": "application/json" } : {}) }, ...(operation ? { body: JSON.stringify(operation) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new IntakeError(result.error ?? "unavailable", response.status, result.fieldErrors ?? {});
  return result;
}
export function ReviewInterview() {
  const [view, setView] = useState<IntakeView | null>(null), [answers, setAnswers] = useState<Answers>({}), [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [errors, setErrors] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null), form = useRef<HTMLFormElement>(null);
  const [hasError, setHasError] = useState(false);
  function activeAnswers() {
    const current = form.current ? currentScreenAnswers(step, answers, new FormData(form.current)) : answers;
    // Retain captured/autofilled edits even when normalization refuses the save.
    setAnswers(current);
    return normalizeAnswers(current);
  }
  function adopt(v: IntakeView) { setView(v); setAnswers(v.answers); setStep(Math.min(v.step, questions.length - 1)); }
  function failed(error: unknown) {
    setHasError(true);
    const e = error instanceof IntakeError ? error : new IntakeError("unavailable"); setErrors(e.fields);
    setMessage(e.code === "draft_changed" ? "Your saved answers changed in another tab. Reload to use the latest saved progress." : e.code === "session_unavailable" ? "Your saved session is unavailable or expired. No new request has been created. Please use a new browser session to begin again." : e.code === "already_submitted" ? "This Review request was already received. Reload to see its confirmation." : e.code === "payload_too_large" ? "Please shorten the longer answers and try again. Your current answers remain here." : e.code === "rate_limited" ? "Please pause briefly before trying again. Your saved progress is safe." : Object.keys(e.fields).length ? "Please check the highlighted fields." : "We could not confirm this save. Your answers remain here; try again before leaving.");
  }
  useEffect(() => { let active = true; request().then(v => { if (active && v.state !== "not_started") adopt(v); }).catch(e => { if (active) failed(e); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function begin() {
    setBusy(true); setMessage("");
    try { const v = await request({ operation: "begin" }); if (v.state !== "not_started") adopt(v); }
    catch (e) { failed(e); } finally { setBusy(false); }
  }
  async function save(next: number, requireAnswer = false) {
    if (!view) return;
    setErrors({}); setMessage(""); setHasError(false);
    try {
      const normalized = activeAnswers(), fieldErrors = requireAnswer ? questionErrors(step, normalized) : {};
      if (Object.keys(fieldErrors).length) throw new IntakeError("incomplete", 400, fieldErrors);
      setBusy(true); const v = await request({ operation: "save", version: view.version, answers: normalized, step: next });
      if (v.state !== "not_started") adopt(v);
      if (next === step) setMessage("Saved. You can return in this browser for up to 30 days from when you began.");
      else heading.current?.focus();
    } catch (e) { failed(e); } finally { setBusy(false); }
  }
  async function submit() {
    if (!view) return; setBusy(true); setMessage(""); setErrors({}); setHasError(false);
    try {
      const normalized = activeAnswers(); validateComplete(normalized);
      const saved = await request({ operation: "save", version: view.version, answers: normalized, step });
      if (saved.state === "not_started") throw new IntakeError("session_unavailable");
      adopt(saved);
      const v = await request({ operation: "submit", version: saved.version }); if (v.state !== "not_started") { adopt(v); heading.current?.focus(); } }
    catch (e) { failed(e); } finally { setBusy(false); }
  }
  const submitted = view?.state === "needs_operator_review";
  function saveForShellLink() {
    // Native new-tab navigation leaves this form available even if validation/save fails.
    // Start capture/save before the browser follows the link; never delay native opening
    // until an asynchronous response (which can trigger popup blocking).
    if (view?.state === "draft" && !busy && !loading) void save(step);
  }
  function separateLink(href: string, label: string) {
    return <Link href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} onClick={saveForShellLink} onAuxClick={e => { if (e.button === 1) saveForShellLink(); }}>{label}</Link>;
  }
  return <div className={styles.shell}>
    <header>{separateLink("/", "MioPages")}{separateLink("/review", "About the Free Review")}</header>
    <main className={styles.card} aria-busy={loading || busy}>
      <h1 ref={heading} tabIndex={-1}>{submitted ? "Your information was received" : "Your Free Web Presence Review"}</h1>
      {!submitted && <p className={styles.hint}>You can look around MioPages while you complete your Review. Links from this page open separately, so your Review stays available here. Your saved progress is kept in this browser.</p>}
      {loading ? <p role="status">Checking saved progress…</p> : submitted ? <>{reviewConfirmation.map(p => <p key={p}>{p}</p>)}{separateLink("/", "Return to MioPages")}</> : !view ? <>
        <p>A few short answers help us understand your business and what would be most useful. This is a cost-free Review, with no paid commitment.</p>
        <p>Your answers are saved privately, and this browser can resume your session. Please do not include passwords, payment details or sensitive personal information.</p>
        <p>Drafts expire after 30 days; submitted information expires after 90 days. Resume works only in this browser, not through an emailed link or account.</p>
        <div className={styles.actions}><button type="button" onClick={begin} disabled={busy || !!message}>Begin my Review</button></div>
        {message && <button type="button" className={styles.secondary} onClick={() => window.location.reload()}>Retry loading saved progress</button>}
      </> : <>
        <p className={styles.progress}>{`Question ${step + 1} of ${questions.length}`}</p>
        <progress max={questions.length} value={step} aria-label="Review progress" />
        <form ref={form} noValidate onSubmit={e => { e.preventDefault(); if (step === questions.length - 1) void submit(); else void save(step + 1, true); }}>
          <h2>{questionTitle(step, answers)}</h2><InterviewQuestion classes={styles} index={step} answers={answers} errors={errors} change={(key, value) => { setAnswers(a => ({ ...a, [key]: value })); setErrors({}); setMessage(""); setHasError(false); }} />
          <div className={styles.actions}>
            {step > 0 && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void save(step - 1)}>Back</button>}
            <button type="submit" disabled={busy}>{busy ? "Saving…" : step === questions.length - 1 ? "Submit my Review" : "Continue"}</button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => void save(step)}>Save progress</button>
          </div>
          <p role={hasError ? "alert" : "status"} aria-live={hasError ? "assertive" : "polite"} className={hasError ? styles.error : styles.hint}>{message}</p>
          {step === questions.length - 1 && <p className={styles.hint}>You can go back to change an earlier answer before submitting. Submit my Review sends your answers for operator review; submitted answers cannot be edited.</p>}
          <p className={styles.hint}>Progress is saved when you select Continue, Back or Save progress. Unsaved changes are lost if you leave. Do not include passwords or payment details.</p>
        </form>
      </>}
      {!view && <p role={hasError ? "alert" : "status"} className={hasError ? styles.error : styles.hint}>{message}</p>}
    </main>
    <footer>{separateLink("/", "MioPages Home")}{separateLink("/review", "About the Free Review")}</footer>
  </div>;
}
