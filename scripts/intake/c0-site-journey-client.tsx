import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "../../components/intake/interview.module.css";
import { prospectPriorities } from "../../lib/platform/intake/adaptive";
import { prospectDirection } from "../../lib/platform/intake/prospect-direction";
import type { IntakeView } from "../../lib/platform/intake/service";

async function request(operation?: object): Promise<IntakeView | null> {
  const response = await fetch("/api/onboarding", {
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

function Journey() {
  const [view, setView] = useState<IntakeView | null>(null);
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [code, setCode] = useState("");
  const [page, setPage] = useState<"home" | "service">("home");
  const [prior, setPrior] = useState<ReturnType<typeof prospectDirection>>(null);
  const direction = view && prospectDirection(view.answers);
  const sourceDirection = view && prospectDirection({ visitorRoute: view.answers.visitorRoute });

  function adopt(next: IntakeView | null) {
    setView(next);
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
  useEffect(() => { request().then(adopt).catch(failed).finally(() => setBusy(false)); }, []);
  async function unlock() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/onboarding/access", { method: "POST",
        headers: { "X-Intake-Request": "1", "X-Local-Access": code.trim() } });
      if (!response.ok) throw Error("Use the access code from your current PowerShell window.");
      adopt(await request());
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
      const next = await request(operation);
      if (!next) throw Error("No saved draft was returned.");
      if (view) setPrior(direction);
      adopt(next);
      setMessage(view ? "Saved. Your earlier answers are still available below." : "Your retained answers are ready.");
    } catch (reason) { failed(reason); }
    finally { setBusy(false); }
  }

  return <div className={styles.shell}>
    <header><strong>MioPages</strong><span>Private local development</span></header>
    <main className={styles.card} aria-busy={busy}>
      <h1>Review your Web Presence</h1>
      {locked ? <form onSubmit={event => { event.preventDefault(); void unlock(); }}>
        <div className={styles.field}><label htmlFor="access-code">Local access code</label>
          <input id="access-code" type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} /></div>
        <button disabled={busy || !code}>Open private review</button>
      </form> : !view ? <>
        <p>Continue with the business information you already provided.</p>
        <button disabled={busy || error} onClick={() => void run({ operation: "begin" })}>Resume retained onboarding</button>
      </> : <>
        <h2>What we understand</h2>
        <p>MioPages is transitioning to one managed Web Presence service, with Launch followed by Ongoing care. Earlier site observations and Review material are kept with their original sources.</p>
        {view.prepared && <p className={styles.hint}>{view.prepared.reviewGap}</p>}
        {view.prepared?.sources.map(source => <details key={source.id}>
          <summary>{source.title} · {source.kind}</summary>
          <p>{source.reference}</p>
          {source.entries.map(item => <p key={item.label}><strong>{item.label}</strong> {item.value}</p>)}
        </details>)}
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
        {direction && <>
          <h2>Draft assessment and direction</h2>
          <p>{direction.finding}</p>
          {(prior ?? sourceDirection) && (prior ?? sourceDirection)?.primary.action !== direction.primary.action &&
            <p>Primary action changed from <strong>{(prior ?? sourceDirection)?.primary.action}</strong> to <strong>{direction.primary.action}</strong>.</p>}
          <h2>Review the site proposal</h2>
          <p>Editorial proposal for review. Links and inquiry delivery still need verification.</p>
          {view.planningEvidence && <details><summary>Proposal evidence</summary>
            <p>Draft version {view.planningEvidence.version} · {view.planningEvidence.evidenceDigest}</p>
          </details>}
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
          <p>Lead notifications, visitor measurement and business outcomes have no verified results in this review.</p>
        </>}
        <details><summary>Earlier saved responses · awaiting review</summary>
          {Object.entries(view.answers).filter(([key]) => key !== "sitePriority" && key !== "rehearsalCommitment").map(([key, value]) => {
            const labels: Record<string, string> = { sourceDecision: "Understanding", sourceCorrection: "Correction", foundationGoal: "Goal",
              workIncluded: "Included work", workExcluded: "Excluded work", visitorRoute: "Visitor action", reviewHandoff: "Review handoff",
              conversationHandoff: "Conversation handoff", publicRoute: "Proposed destination", proof: "Proof", siteDisposition: "Existing site",
              siteItem: "Item", additionalEvidence: "Additional evidence" };
            const evidence = view.provenance?.[key];
            return <p key={key}><strong>{labels[key] ?? key}</strong> {value}
              {evidence && <><br /><small>Saved {evidence.suppliedAt.slice(0, 10)} · {evidence.confirmation === "prior-approved"
                ? "Earlier approved source" : "Owner response awaiting review"}</small></>}</p>;
          })}
        </details>
      </>}
      {!view && message && <p role={error ? "alert" : "status"}>{message}</p>}
    </main>
  </div>;
}

createRoot(document.getElementById("onboarding")!).render(<Journey />);
