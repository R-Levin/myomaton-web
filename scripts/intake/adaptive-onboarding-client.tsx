import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InterviewQuestion } from "../../components/intake/question";
import styles from "../../components/intake/interview.module.css";
import { adaptiveAssessmentStep, adaptiveFoundationErrors, adaptiveGaps, adaptiveOfferStep, adaptiveOnboardingVersion, adaptiveQuestions, adaptiveScopeStep, type PreparedUnderstanding } from "../../lib/platform/intake/adaptive";
import { currentScreenAnswers, fieldApplies, IntakeError, normalizeAnswers, questionErrors, type Answers } from "../../lib/platform/intake/model";
import type { IntakeView } from "../../lib/platform/intake/service";

const isC2 = location.pathname === "/onboarding/customer-2";
const endpoint = isC2 ? "/api/onboarding/customer-2" : "/api/onboarding";
const titles = ["Prepared understanding", "Fit and scope", "Offer and visitor decision", "Existing-site decisions", "Initial assessment"];
const rehearsals = [
  { path: "/onboarding", label: "Customer 0" },
  { path: "/onboarding/customer-2", label: "Fictional Customer 2" },
];

async function request(operation?: object): Promise<IntakeView | null> {
  const response = await fetch(endpoint, { method: operation ? "POST" : "GET", cache: "no-store",
    headers: { "X-Intake-Request": "1", ...(operation && { "Content-Type": "application/json" }) },
    ...(operation && { body: JSON.stringify(operation) }) });
  const data = await response.json();
  if (!response.ok) throw new IntakeError(data.error, response.status, data.fieldErrors);
  if (data.state === "not_started") return null;
  if (data.questionnaireVersion !== adaptiveOnboardingVersion || data.prepared?.scenario !== (isC2 ? "c2" : "c0")) throw new IntakeError("unavailable");
  return data;
}

function Sources({ prepared }: { prepared: PreparedUnderstanding }) {
  const issue = prepared.reconciliation;
  return <>
    <p>{prepared.context}</p>
    <p><strong>Prepared summary</strong> · {prepared.summary}</p>
    <h3>What we brought forward</h3>
    {prepared.sources.map(source => <details key={source.id}>
      <summary>{source.title} · {source.kind}</summary>
      <p>{source.detail}</p><p className={styles.hint}>{source.reference}{source.date && " · " + source.date}</p>
      {source.entries.map(entry => <div key={entry.label} className={styles.field}><strong>{entry.label}</strong>
        {entry.value.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>)}
    </details>)}
    <h3>{issue.status === "conflict" ? "Source conflict" : "Needs confirmation"} · {issue.title}</h3>
    <p>{issue.detail}</p>
    <p className={styles.hint}>{prepared.sources.filter(source => issue.sources.includes(source.id)).map(source => source.title).join(" · ")}</p>
    <p>{prepared.reviewGap}</p>
  </>;
}

function Inventory({ prepared }: { prepared: PreparedUnderstanding }) {
  return <ul>{prepared.inventory.map(row => <li key={row.item}><strong>{row.disposition}</strong><br />{row.item}<br />
    <small>{row.reference}</small></li>)}</ul>;
}

function Assessment({ view, prepared }: { view: IntakeView; prepared: PreparedUnderstanding }) {
  const answers = view.answers;
  const gaps = adaptiveGaps(prepared, answers);
  const fields = adaptiveQuestions.flatMap(question => question.fields).filter(field =>
    field.key !== "rehearsalCommitment" && field.key !== "siteDisposition" && field.key !== "siteItem" && fieldApplies(field, answers) && answers[field.key]);
  return <>
    <h2>Initial assessment</h2>
    <p>{view.submission ? "Saved for Operator review as an immutable local rehearsal submission." : "Review this draft before submitting it for Operator review."} Build readiness and approval remain separate.</p>
    <details><summary>Source evidence and original differences</summary><Sources prepared={prepared} /></details>
    <h3>Your responses · awaiting Operator review</h3>
    <dl>{fields.map(field => <div className={styles.field} key={field.key}><dt><strong>{field.label}</strong></dt><dd>{answers[field.key]}</dd></div>)}</dl>
    <h3>Existing-site decisions carried forward</h3><Inventory prepared={prepared} />
    {answers.siteItem && <p><strong>{answers.siteDisposition}</strong> · {answers.siteItem} <small>Rehearsal response</small></p>}
    <h3>Proposed direction · for discussion</h3><p>{prepared.proposal}</p><p>{prepared.fit}</p>
    <h3>Open checks before a build</h3>{gaps.length ? <ul>{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul> : <p>No additional gaps surfaced in this slice. Operator review still applies.</p>}
    {view.submission && <details><summary>Submission reference</summary><p className={styles.hint}>{view.submission.digest}</p></details>}
  </>;
}

function AdaptiveOnboarding() {
  const [view, setView] = useState<IntakeView | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const step = view?.step ?? 0;
  const prepared = view?.prepared;
  function adopt(next: IntakeView | null) { setView(next); setAnswers(next?.answers ?? {}); }
  function report(value: unknown) {
    const issue = value instanceof IntakeError ? value : new IntakeError("unavailable");
    setError(true);
    setFields(issue.fields);
    setMessage(issue.code === "draft_changed" ? "Progress changed in another tab. Reload before continuing."
      : issue.code === "prepared_source_changed" ? "The source evidence changed. Ask the Operator to inspect this draft before continuing."
      : issue.code === "scope_review_required" ? "Review the updated fit and scope before changing deeper answers."
      : Object.keys(issue.fields).length ? "Please check the marked answers." : "The rehearsal could not confirm this request. Reload to check saved progress.");
  }
  useEffect(() => { request().then(adopt).catch(report).finally(() => setBusy(false)); }, []);
  async function perform(operation: object, saveHere = false) {
    setBusy(true); setError(false); setMessage(""); setFields({});
    try {
      adopt(await request(operation));
      if (saveHere) setMessage("Progress saved. You can reload or return in this browser while the rehearsal is running.");
      else document.getElementById("onboarding-title")?.focus();
    } catch (value) { report(value); }
    finally { setBusy(false); }
  }
  function save(next: number, form?: HTMLFormElement, validate = false) {
    if (!view) return;
    try {
      const current = form ? currentScreenAnswers(step, answers, new FormData(form), adaptiveOnboardingVersion) : answers;
      const normalized = normalizeAnswers(current, adaptiveOnboardingVersion);
      if (step === 0) delete normalized.rehearsalCommitment;
      const missing = validate ? { ...questionErrors(step, normalized, adaptiveOnboardingVersion),
        ...(step === 0 && prepared && adaptiveFoundationErrors(prepared, normalized)) } : {};
      if (Object.keys(missing).length) throw new IntakeError("incomplete", 400, missing);
      void perform({ operation: "save", version: view.version, answers: normalized, step: next }, next === step);
    } catch (value) { report(value); }
  }
  return <div className={styles.shell}>
    <header><strong>MioPages</strong><span>Local rehearsal · {isC2 ? "Fictional Customer 2" : "Customer 0"}</span></header>
    <main className={styles.card} aria-busy={busy}>
      <h1 id="onboarding-title" tabIndex={-1}>{prepared?.name ?? "Start with MioPages"}</h1>
      <nav aria-label="Choose rehearsal">{rehearsals.map(({ path, label }, index) => <span key={path}>
        {index > 0 && " · "}<a href={path} aria-current={location.pathname === path ? "page" : undefined}>{label}</a>
      </span>)}</nav>
      {!view || !prepared ? busy ? <p role="status">Checking for saved progress…</p> : <>
        <h2>Prepared onboarding rehearsal</h2>
        <p>Open a disposable local draft to check the information we already have. You can continue into the deeper interview after reviewing fit and scope.</p>
        <button type="button" disabled={error} onClick={() => void perform({ operation: "begin" })}>Open prepared interview</button>
      </> : <>
        <p className={styles.progress}>{titles[step]}</p>
        {step === adaptiveAssessmentStep ? <>
          <Assessment view={view} prepared={prepared} />
          {!view.submission && <div className={styles.actions}>
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => save(step - 1)}>Back to answers</button>
            <button type="button" disabled={busy} onClick={() => void perform({ operation: "submit", version: view.version })}>Submit for Operator review</button>
          </div>}
        </> : <form noValidate onSubmit={event => { event.preventDefault(); save(step + 1, event.currentTarget, true); }}>
          <h2>{adaptiveQuestions[step].title}</h2>
          {step === 0 && <><Sources prepared={prepared} />{prepared.foundationGap && <p>{prepared.foundationGap}</p>}</>}
          {step === adaptiveScopeStep && <><p>{prepared.scopeSummary}</p>
            {answers.foundationGoal && <p><strong>Your priority</strong> · {answers.foundationGoal}</p>}
            {answers.sourceCorrection && <p><strong>Your correction</strong> · {answers.sourceCorrection}</p>}
            <p>Continuing is a rehearsal checkpoint. It records no payment, agreement or live activation.</p></>}
          {step === adaptiveOfferStep && <><p>{prepared.offeringPrompt}</p><p>Leave details open if they still need verification.</p></>}
          {step === adaptiveAssessmentStep - 1 && <Inventory prepared={prepared} />}
          <InterviewQuestion index={step} questionnaireVersion={adaptiveOnboardingVersion} classes={styles} answers={answers} errors={fields}
            hiddenFields={prepared.foundationGap ? [] : ["foundationGoal"]}
            change={(key, value) => { setAnswers(previous => ({ ...previous, [key]: value })); setFields({}); setMessage(""); }} />
          <div className={styles.actions}>
            {step > 0 && <button className={styles.secondary} type="button" disabled={busy} onClick={event => save(step - 1, event.currentTarget.form!)}>Back</button>}
            <button type="submit" disabled={busy}>{step + 1 === adaptiveAssessmentStep ? "Read the assessment" : "Continue"}</button>
            <button className={styles.secondary} type="button" disabled={busy} onClick={event => save(step, event.currentTarget.form!)}>Save progress</button>
          </div>
        </form>}
      </>}
      {message && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.hint}>{message}</p>}
    </main>
  </div>;
}

createRoot(document.getElementById("onboarding")!).render(<AdaptiveOnboarding />);
