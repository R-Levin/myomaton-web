import { useEffect, useState } from "react";
import styles from "../../components/intake/interview.module.css";
import { prospectPriorities } from "../../lib/platform/intake/adaptive";
import { prospectDirection } from "../../lib/platform/intake/prospect-direction";
import { interviewDirection } from "../../lib/platform/intake/interview-direction";
import type { IntakeView } from "../../lib/platform/intake/service";

type Operations = Awaited<ReturnType<typeof import("../../lib/platform/contact/protected-inquiry").protectedInquiry>>;
type JourneyView = IntakeView & { interviewEnabled?: boolean; operations?: Operations | null };
async function request(endpoint: string, operation?: object): Promise<JourneyView | null> {
  const response = await fetch(endpoint, {
    method: operation ? "POST" : "GET", cache: "no-store",
    headers: { "X-Intake-Request": "1", ...(operation && { "Content-Type": "application/json" }) },
    ...(operation && { body: JSON.stringify(operation) }),
  });
  if (response.status === 401) throw Error("local_access_required");
  if (response.status === 409) throw Error("This draft changed. Reload before saving a different answer.");
  if (!response.ok) throw Error("Core could not confirm the request. Your selection is still on screen.");
  const data = await response.json();
  if (data.state === "not_started") return null;
  if (data.prepared?.scenario !== "c0") throw Error("The retained MioPages draft is unavailable.");
  return data;
}

export function Journey({ hosted = false }: { hosted?: boolean }) {
  const endpoint = hosted ? "/api/protected-core" : "/api/onboarding";
  const [view, setView] = useState<JourneyView | null>(null);
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [code, setCode] = useState("");
  const [page, setPage] = useState<"home" | "service">("home");
  const [answer, setAnswer] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [improvementPage, setImprovementPage] = useState("");
  const [deliveryInput, setDeliveryInput] = useState<{ packet: unknown; digest: string } | null>(null);
  const [prior, setPrior] = useState<ReturnType<typeof prospectDirection>>(null);
  const direction = view && prospectDirection(view.answers);
  const sourceDirection = view && prospectDirection({ visitorRoute: view.answers.visitorRoute });

  function adopt(next: JourneyView | null) {
    setView(next);
    setDeliveryInput(null);
    setPriority(String(next?.answers.sitePriority ?? ""));
  }
  function failed(reason: unknown) {
    if (reason instanceof Error && reason.message === "local_access_required") {
      setLocked(true);
      return;
    }
    setError(true);
    setMessage(reason instanceof Error ? reason.message : "Core could not confirm the request.");
  }
  useEffect(() => { request(endpoint).then(adopt).catch(failed).finally(() => setBusy(false)); }, [endpoint]);
  async function unlock() {
    setBusy(true);
    setMessage("");
    try {
      const response = hosted ? await fetch(endpoint, { method: "POST",
        headers: { "X-Intake-Request": "1", "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "sign-in", credential: code.trim() }) })
        : await fetch("/api/onboarding/access", { method: "POST",
          headers: { "X-Intake-Request": "1", "X-Local-Access": code.trim() } });
      if (!response.ok) throw Error(hosted ? "The Operator credential was refused." : "Use the access code from your current PowerShell window.");
      adopt(await request(endpoint));
      setLocked(false);
      setError(false);
      setCode("");
    } catch (reason) { failed(reason); }
    finally { setBusy(false); }
  }
  async function run(operation: object) {
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      const next = await request(endpoint, operation);
      if (!next) throw Error("No saved draft was returned.");
      if (view) setPrior(direction);
      adopt(next);
      if ("operation" in operation && ["interview-answer", "correct-interview-answer"].includes(String(operation.operation))) {
        setAnswer("");
        setCorrecting(false);
      }
      setMessage(next.interview?.failure && "operation" in operation && operation.operation === "interview-next"
        ? "Core could not save the model response. Your saved answer is still available."
        : view ? "Saved. Your earlier answers are still available below." : "Your retained answers are ready.");
    } catch (reason) { failed(reason); }
    finally { setBusy(false); }
  }

  const turn = view?.interview?.turns.at(-1);
  const finding = view?.interview?.turns.findLast(item => item.assessment);
  const lastAnswered = view?.interview?.turns.findLast(item => item.answer);
  const assessment = finding?.assessment;
  const evidenceDirection = interviewDirection(view?.interview?.turns ?? []);
  const reviewedPlan = view?.interview?.reviewedPlan;
  const plan = reviewedPlan && reviewedPlan.findingId === evidenceDirection?.findingId
    ? reviewedPlan.plan : evidenceDirection?.plan;
  return <div className={styles.shell}>
    <header><strong>MioPages</strong><span>{hosted ? "Protected Operator development" : "Private local development"}</span>
      {hosted && view && <button type="button" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const response = await fetch(endpoint, { method: "POST", headers: { "X-Intake-Request": "1", "X-Core-Operation": "logout" } });
          if (!response.ok) throw Error("Sign-out could not be confirmed.");
          adopt(null); setPrior(null); setLocked(true); setMessage(""); setError(false);
        } catch (reason) { failed(reason); }
        finally { setBusy(false); }
      }}>Sign out</button>}
    </header>
    <main className={styles.card} aria-busy={busy}>
      <h1>Review your Web Presence</h1>
      {locked ? <form onSubmit={event => { event.preventDefault(); void unlock(); }}>
        <div className={styles.field}><label htmlFor="access-code">{hosted ? "Operator credential" : "Local access code"}</label>
          <input id="access-code" type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} /></div>
        <button disabled={busy || !code}>{hosted ? "Sign in" : "Open private review"}</button>
      </form> : !view ? <>
        <p>Continue with the business information you already provided.</p>
        <button disabled={busy || error} onClick={() => void run({ operation: "begin" })}>Resume retained onboarding</button>
      </> : <>
        <h2>What we understand</h2>
        <p>MioPages is transitioning to one managed Web Presence service, with Launch followed by Ongoing care. Earlier site observations and Review material are kept with their original sources.</p>
        {view.prepared && <p className={styles.hint}>{view.prepared.reviewGap}</p>}
        {view.prepared?.sources.map(source => <details key={source.id}>
          <summary>{source.title} Â· {source.kind}</summary>
          <p>{source.reference}</p>
          {source.entries.map(item => <p key={item.label}><strong>{item.label}</strong> {item.value}</p>)}
        </details>)}
        {hosted && <section aria-label="Business interview">
          <h2>Business interview</h2>
          {!view.interviewEnabled ? <p>AI interview access is awaiting its evidence and budget configuration.</p> : <>
            {assessment && evidenceDirection && <div>
              <h3>What Core learned</h3>
              <p>{assessment.recommendation}</p>
              {assessment.evidenceNeeded && <p><strong>Still open</strong> {assessment.evidenceNeeded}</p>}
              <p className={styles.hint}>Evidence {finding?.sourceIds.map(id => id.endsWith(":answer") ? "Saved interview answer" :
                view.prepared?.sources.find(source => source.id === id)?.title ?? id).join(" Â· ")}</p>
            </div>}
            {turn?.question && <>
              <h3>{turn.question}</h3><p>{turn.rationale}</p>
              {turn.answer ? <p><strong>Saved answer</strong> {turn.answer.text}</p>
                : <form onSubmit={event => {
                  event.preventDefault();
                  void run({ operation: "interview-answer", version: view.version, questionId: turn.id, answer });
                }}>
                  <div className={styles.field}><label htmlFor="business-answer">Your answer</label>
                    <textarea id="business-answer" rows={4} maxLength={900} value={correcting ? "" : answer}
                      onChange={event => setAnswer(event.target.value)} disabled={busy || correcting} /></div>
                  <button disabled={busy || correcting || !answer.trim()}>Save answer</button>
                </form>}
            </>}
            {view.interview?.pending ? <p role="status">Core is waiting for the reserved generation to settle.</p>
              : (!turn || turn.answer) && <button disabled={busy} onClick={() => void run({
                operation: "interview-next", version: view.version,
              })}>{turn ? "Review answer and look for a follow-up" : "Find the next business question"}</button>}
            {view.interview?.failure?.reason && <p>Model response check {view.interview.failure.reason}</p>}
            {lastAnswered && !view.interview?.pending && (correcting ? <form onSubmit={event => {
              event.preventDefault();
              void run({ operation: "correct-interview-answer", version: view.version, questionId: lastAnswered.id, answer });
            }}>
              <label>Correct the last saved answer<textarea rows={4} maxLength={900} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
              <button disabled={busy || !answer.trim()}>Save correction</button>{" "}
              <button type="button" className={styles.secondary} onClick={() => { setCorrecting(false); setAnswer(""); }}>Cancel</button>
            </form> : <button type="button" className={styles.secondary} disabled={busy} onClick={() => {
              setAnswer(lastAnswered.answer?.text ?? "");
              setCorrecting(true);
            }}>Correct last saved answer</button>)}
            {view.interview?.turns.some(item => item.answer) && <details><summary>Interview history</summary>
              {view.interview.turns.filter(item => item.answer).map(item => <div key={item.id}>
                <p><strong>{item.question}</strong></p><p>{item.answer?.text}</p>
              </div>)}</details>}
          </>}
        </section>}
        <h2>Choose what the site should emphasize</h2>
        <p>Both paths can remain available. This decision changes what a prospect sees first on Home and Service.</p>
        <form onSubmit={event => {
          event.preventDefault();
          if (priority) void run({ operation: "site-priority", version: view.version, priority });
        }}>
          <fieldset className={styles.field}>
            <legend>Which prospect path should lead?</legend>
            {prospectPriorities.map(option => <label key={option} className={styles.choice}>
              <input type="radio" name="priority" value={option} checked={priority === option} disabled={busy}
                onChange={() => setPriority(option)} />{option}
            </label>)}
          </fieldset>
          <button disabled={busy || !priority}>Save site priority</button>
        </form>
        {message && <p role={error ? "alert" : "status"}>{message}</p>}
        {(direction || evidenceDirection) && <>
          <h2>Draft assessment and direction</h2>
          {direction && !plan && <p>{direction.finding}</p>}
          {direction && !plan && (prior ?? sourceDirection) && (prior ?? sourceDirection)?.primary.action !== direction.primary.action &&
            <p>Primary action changed from <strong>{(prior ?? sourceDirection)?.primary.action}</strong> to <strong>{direction.primary.action}</strong>.</p>}
          <h2>Review the site proposal</h2>
          <p>Editorial proposal for review. Links and inquiry delivery still need verification.</p>
          {evidenceDirection && <section aria-label="Evidence for this site decision">
            <h3>Direction from the interview</h3>
            <p>{evidenceDirection.recommendation}</p>
            {evidenceDirection.unresolved && <p><strong>Still to verify</strong> {evidenceDirection.unresolved}</p>}
            {plan && <form key={view.version} onSubmit={event => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              void run({ operation: "edit-presence-plan", version: view.version, findingId: evidenceDirection.findingId, plan: {
                ...plan, positioning: fields.get("positioning"), offering: fields.get("offering"), audience: fields.get("audience"),
                pages: plan.pages.map((item, index) => ({ ...item,
                  title: fields.get(`title-${index}`), purpose: fields.get(`purpose-${index}`), seoDescription: fields.get(`seo-${index}`), action: fields.get(`action-${index}`),
                  sections: item.sections.map((_section, sectionIndex) => ({
                    heading: fields.get(`heading-${index}-${sectionIndex}`), body: fields.get(`body-${index}-${sectionIndex}`),
                  })),
                })),
              } });
            }}>
              <div className={styles.field}>
                <label>Positioning<textarea name="positioning" defaultValue={plan.positioning} required maxLength={500} /></label>
                <label>Offering<textarea name="offering" defaultValue={plan.offering} required maxLength={500} /></label>
                <label>Audience<textarea name="audience" defaultValue={plan.audience} required maxLength={350} /></label>
              </div>
              {plan.pages.map((item, index) => <details key={item.path}>
                <summary>{item.title} Â· {item.path}</summary>
                <div className={styles.field}>
                  <label>Page purpose<textarea name={`purpose-${index}`} defaultValue={item.purpose} required maxLength={300} /></label>
                  <label>Page title<input name={`title-${index}`} defaultValue={item.title} required maxLength={100} /></label>
                  <label>Search description<input name={`seo-${index}`} defaultValue={item.seoDescription} required maxLength={160} /></label>
                  <label>Visitor action label<input name={`action-${index}`} defaultValue={item.action} required maxLength={100} /></label>
                  {item.sections.map((section, sectionIndex) => <div key={sectionIndex}>
                    <label>Section heading<input name={`heading-${index}-${sectionIndex}`} defaultValue={section.heading} required maxLength={160} /></label>
                    <label>Section content<textarea name={`body-${index}-${sectionIndex}`} defaultValue={section.body} required maxLength={1000} /></label>
                  </div>)}
                </div>
              </details>)}
              <button disabled={busy}>Save proposed page edits</button>
            </form>}
          </section>}
          {view.planningEvidence && <details><summary>Proposal evidence</summary>
            <p>Draft version {view.planningEvidence.version} Â· {view.planningEvidence.evidenceDigest}</p>
          </details>}
          {plan && <p>Independent review is required before preparing delivery. Proposed action destinations and new Page identities need to be resolved in Core.</p>}
          {hosted && plan && reviewedPlan?.findingId === evidenceDirection?.findingId && <section>
            <h3>Prepare for WordPress review</h3>
            <p>Review exact edited content and its evidence before creating Core Page proposals.</p>
            <button type="button" disabled={busy} onClick={async () => {
              setBusy(true); setError(false); setMessage("");
              try {
                const response = await fetch(endpoint, { method: "POST", cache: "no-store",
                  headers: { "X-Intake-Request": "1", "Content-Type": "application/json" },
                  body: JSON.stringify({ operation: "review-delivery-input", version: view.version }),
                });
                if (!response.ok) throw Error("Core could not verify the current review version. Reload before continuing.");
                setDeliveryInput(await response.json());
              } catch (error) { failed(error); }
              finally { setBusy(false); }
            }}>Prepare review package</button>
            {deliveryInput && <details open><summary>Exact review input</summary>
              <p>Digest {deliveryInput.digest}</p>
              <textarea readOnly aria-label="Private WordPress review input" rows={8} value={JSON.stringify(deliveryInput, null, 2)} />
            </details>}
          </section>}
          {!plan && direction && <>
          <nav aria-label="Proposed pages">
            <button type="button" className={styles.secondary} aria-pressed={page === "home"} onClick={() => setPage("home")}>Home</button>{" "}
            <button type="button" className={styles.secondary} aria-pressed={page === "service"} onClick={() => setPage("service")}>Service</button>
          </nav>
          <article>
            <h3>{direction[page].heading}</h3>
            <p>{direction[page].body}</p>
            <h4>{direction[page].nextStep.heading}</h4>
            <p>{direction[page].nextStep.body}</p>
            <p><strong>Proposed primary action</strong> {direction.primary.action}<br />
              <strong>Proposed secondary action</strong> {direction.secondary.action}</p>
          </article>
          <h2>Open before staging</h2>
          <p>{direction.open}</p>
          </>}

        </>}
        {hosted && <section aria-label="Ongoing service">
          <h2>Ongoing service</h2>
          {view.operations ? <>
            <p>Private draft revision {view.operations.draft.revision} · Synthetic development check</p>
            <dl>
              <dt>Accepted test inquiries</dt><dd>{view.operations.accepted}</dd>
              <dt>Notifications</dt><dd>Disabled</dd>
              <dt>Visitor activity</dt><dd>Unmeasured</dd>
              <dt>Customer outcomes</dt><dd>Unknown</dd>
            </dl>
            {view.operations.recommendation ? <>
              <h3>Recommended improvement</h3>
              <p>{view.operations.recommendation.proposal}</p>
              <p>{view.operations.recommendation.successCheck}</p>
              <p>{view.operations.recommendation.uncertainty}</p>
              {plan && evidenceDirection && <form onSubmit={event => {
                event.preventDefault();
                const section = view.operations?.recommendation?.suggestedSection;
                if (!section || !improvementPage) return;
                void run({ operation: "edit-presence-plan", version: view.version, findingId: evidenceDirection.findingId,
                  plan: { ...plan, pages: plan.pages.map(item => item.path === improvementPage
                    ? { ...item, sections: [...item.sections, section] } : item) },
                  improvementEvidence: view.operations?.recommendation?.evidenceId, improvementPage,
                });
              }}>
                <label>Proposed Page to improve<select value={improvementPage} onChange={event => setImprovementPage(event.target.value)}>
                  <option value="">Choose a Page</option>
                  {plan.pages.map(item => <option key={item.path} value={item.path}>{item.title}</option>)}
                </select></label>{" "}
                <button disabled={busy || !improvementPage}>Add to the draft for review</button>
              </form>}
              <details><summary>Inquiry evidence</summary><p>{view.operations.recommendation.evidenceId}</p>
                <p>Accepted {view.operations.recommendation.acceptedAt}</p><p>Draft {view.operations.draft.appliedDigest}</p>
              </details>
            </> : <button type="button" disabled={busy} onClick={() => void run({ operation: "accept-development-inquiry" })}>Record one test inquiry</button>}
          </> : <p>Protected inquiry and measurement access is unavailable for this development draft.</p>}
        </section>}
        <details><summary>Earlier saved responses Â· awaiting review</summary>
          {Object.entries(view.answers).filter(([key]) => key !== "sitePriority" && key !== "rehearsalCommitment").map(([key, value]) => {
            const labels: Record<string, string> = { sourceDecision: "Understanding", sourceCorrection: "Correction", foundationGoal: "Goal",
              workIncluded: "Included work", workExcluded: "Excluded work", visitorRoute: "Visitor action", reviewHandoff: "Review handoff",
              conversationHandoff: "Conversation handoff", publicRoute: "Proposed destination", proof: "Proof", siteDisposition: "Existing site",
              siteItem: "Item", additionalEvidence: "Additional evidence" };
            const evidence = view.provenance?.[key];
            return <p key={key}><strong>{labels[key] ?? key}</strong> {value}
              {evidence && <><br /><small>Saved {evidence.suppliedAt.slice(0, 10)} Â· {evidence.confirmation === "prior-approved"
                ? "Earlier approved source" : "Owner response awaiting review"}</small></>}</p>;
          })}
        </details>
      </>}
      {!view && message && <p role={error ? "alert" : "status"}>{message}</p>}
    </main>
  </div>;
}
