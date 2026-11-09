import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { InterviewQuestion } from "../../components/intake/question";
import styles from "../../components/intake/interview.module.css";
import { currentScreenAnswers, fieldApplies, fieldLabel, IntakeError, normalizeAnswers, questionErrors, questionsFor, type Answers } from "../../lib/platform/intake/model";
import { onboardingVersion, unknownAnswer } from "../../lib/platform/intake/onboarding";
import type { IntakeView } from "../../lib/platform/intake/service";

const questions = questionsFor(onboardingVersion);
const importantGaps = new Set(["proof", "hasDependencies", "publicDestination", "keepFromSite"]);
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(new Date(value));

async function request(operation?: Record<string, unknown>): Promise<IntakeView | null> {
  const response = await fetch("/api/onboarding", { method: operation ? "POST" : "GET", cache: "no-store", headers: { "X-Intake-Request": "1", ...(operation && { "Content-Type": "application/json" }) }, ...(operation && { body: JSON.stringify(operation) }) });
  const data = await response.json();
  if (!response.ok) throw new IntakeError(data.error, response.status, data.fieldErrors);
  return data.state === "not_started" ? null : data;
}

function Understanding({ view }: { view: IntakeView }) {
  const fields = questions.flatMap(q => q.fields).filter(field => fieldApplies(field, view.answers));
  const hasAnswer = (key: string) => Boolean(view.answers[key]) && view.answers[key] !== unknownAnswer;
  const source = (key: string) => view.provenance?.[key];
  const facts = fields.filter(field => hasAnswer(field.key));
  const gaps = fields.filter(field => view.answers[field.key] === unknownAnswer || !hasAnswer(field.key) && (field.required || importantGaps.has(field.key)));
  return <>
    <h2>Here is what we understand about your business</h2>
    <p>{view.submission ? `Saved for Operator review on ${date(view.submission.submittedAt)}.` : "Review this draft before sending it for Operator review. You can go back and correct any answer."} Prior approvals apply to their source records. New answers are supplied for review.</p>
    <dl>{facts.map(field => <div className={styles.field} key={field.key}><dt><strong>{fieldLabel(field, view.answers)}</strong></dt><dd>{String(view.answers[field.key])}<br />
      <small>{source(field.key)?.source === "c0-discovery" ? "Previously approved C0 source" : "New rehearsal response · awaiting confirmation"}{source(field.key) && ` · ${date(source(field.key)!.suppliedAt)}`}</small></dd></div>)}</dl>
    <h3>Open questions</h3>{gaps.length ? <ul>{gaps.map(field => <li key={field.key}>{fieldLabel(field, view.answers)}</li>)}</ul> : <p>No gaps were flagged by these questions.</p>}
    {view.submission && <><h3>Next step for the Operator</h3><p>Review the new information and resolve material gaps before requesting confirmation of the business understanding.</p>
      <details><summary>Submission reference</summary><p className={styles.hint}>{view.submission.digest}</p></details></>}
  </>;
}

function C0Onboarding() {
  const [view, setView] = useState<IntakeView | null>(null), [answers, setAnswers] = useState<Answers>({});
  const [fit, setFit] = useState(false), [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(""), [errors, setErrors] = useState<Record<string, string>>({}), [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), form = useRef<HTMLFormElement>(null);
  const step = view?.step ?? 0;
  function adopt(next: IntakeView | null) { setView(next); setAnswers(next?.answers ?? {}); }
  function report(error: unknown) {
    const issue = error instanceof IntakeError ? error : new IntakeError("unavailable");
    setFailed(true); setErrors(issue.fields ?? {});
    setMessage(issue.code === "draft_changed" ? "Your saved answers changed in another tab. Reload to continue from the latest revision." : Object.keys(issue.fields ?? {}).length ? "Please check the marked answers." : "We could not confirm your request. Reload to check saved progress before trying again.");
  }
  useEffect(() => { request().then(adopt).catch(report).finally(() => setBusy(false)); }, []);
  async function perform(operation: Record<string, unknown>, saved = false) {
    setBusy(true); setFailed(false); setMessage(""); setErrors({});
    try { adopt(await request(operation)); if (saved) setMessage("Progress saved. You can close this tab and resume in this browser while the rehearsal is running."); else heading.current?.focus(); }
    catch (error) { report(error); } finally { setBusy(false); }
  }
  function save(next: number, requireAnswer = false) {
    if (!view) return;
    try {
      const current = step < questions.length && form.current ? currentScreenAnswers(step, answers, new FormData(form.current), onboardingVersion) : answers;
      setAnswers(current);
      const normalized = normalizeAnswers(current, onboardingVersion);
      const missing = requireAnswer ? questionErrors(step, normalized, onboardingVersion) : {};
      if (Object.keys(missing).length) throw new IntakeError("incomplete", 400, missing);
      void perform({ operation: "save", version: view.version, answers: normalized, step: next }, next === step);
    } catch (error) { report(error); }
  }
  return <div className={styles.shell}>
    <header><strong>MioPages</strong><span>Customer 0 · Local rehearsal</span></header>
    <main className={styles.card} aria-busy={busy}>
      <h1 ref={heading} tabIndex={-1}>Start with MioPages</h1>
      {!view && busy ? <p role="status">Checking for saved progress…</p> : !view ? <>
        <h2>{fit ? "Fit, scope and commitment" : "What we already know"}</h2>
        {fit ? <><p><strong>Proposed Standard Launch.</strong> Start with one managed presence, essential pages and a clear way for visitors to get in touch. Ongoing service carries that understanding into updates and improvements. Unusual integrations, extensive migration or extra complexity would need scope review.</p>
          <p><strong>Rehearsal-only commercial checkpoint.</strong> Continue to try the paid-onboarding questions as Customer 0. This step records no payment, agreement, or live customer activation.</p>
          <div className={styles.actions}><button type="button" onClick={() => void perform({ operation: "begin" })} disabled={busy || failed}>Continue with rehearsal authorization</button><button className={styles.secondary} type="button" onClick={() => setFit(false)}>Back</button></div></>
          : <><p>MioPages · miopages.com. This direct-start rehearsal carries forward the approved October 5–6 discovery summary. It starts with the business, audience, offer and service area already known. You can correct those answers.</p>
            <details><summary>Where that information came from</summary><p>The approved business brief is a synthesis of three discovery passes. The recovery audit retains prompts including <q>Who do you most want MioPages to attract first?</q> and <q>What happens after launch that makes the service worth keeping?</q>. The complete verbatim interview is unverified. The October 14 Free Review answers are a separate record.</p></details>
            <div className={styles.actions}><button type="button" onClick={() => setFit(true)} disabled={failed}>Review fit and scope</button></div></>}
      </> : view.submission || step === questions.length ? <>
        <Understanding view={view} />
        {!view.submission && <div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy} onClick={() => save(step - 1)}>Back to answers</button>
          <button type="button" disabled={busy} onClick={() => void perform({ operation: "submit", version: view.version })}>Submit for review</button></div>}
      </> : <>
        <p className={styles.progress}>Step {step + 1} of {questions.length}</p><progress max={questions.length} value={step + 1} aria-label="Onboarding progress" />
        <form ref={form} noValidate onSubmit={event => { event.preventDefault(); save(step + 1, true); }}>
          <h2>{questions[step].title}</h2>
          {questions[step].fields.filter(field => view.provenance?.[field.key]?.source === "c0-discovery").map(field => <p className={styles.hint} key={field.key}>{field.label} · Prefilled from approved C0 discovery, October 5–6, 2026. Edit if it needs correcting.</p>)}
          <InterviewQuestion index={step} questionnaireVersion={onboardingVersion} classes={styles} answers={answers} errors={errors} change={(key, value) => { setAnswers(previous => ({ ...previous, [key]: value })); setErrors({}); setMessage(""); setFailed(false); }} />
          <div className={styles.actions}>{step > 0 && <button type="button" className={styles.secondary} disabled={busy} onClick={() => save(step - 1)}>Back</button>}
            <button type="submit" disabled={busy}>{step + 1 === questions.length ? "Review my answers" : "Continue"}</button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => save(step)}>Save progress</button></div>
        </form>
      </>}
      {message && <p role={failed ? "alert" : "status"} className={failed ? styles.error : styles.hint}>{message}</p>}
      <details><summary>Need help?</summary><p>Choose “Not sure yet” where offered, or leave optional questions for later. Add a question in the last step so it is included in the Operator review. Leave passwords and payment details out.</p></details>
    </main>
  </div>;
}

createRoot(document.getElementById("onboarding")!).render(<C0Onboarding />);
