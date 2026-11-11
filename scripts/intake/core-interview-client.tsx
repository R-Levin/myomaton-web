import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "../../components/intake/interview.module.css";
import type { CoreInterviewView } from "./core-interview";

const endpoint = "/api/core-interview";
const labels: Record<string, string> = { c0: "MioPages C0", c2: "Fictional C2 tree service", startup: "Hypothetical mobile bicycle startup" };
type User = { principal: string; label: string; cases: string[] };
const pathLabel = (path: string) => path.endsWith("/review") ? "Free Review-led" : "Direct start";
const sourceLabel = (kind: string, id: string) => id.startsWith("market-") ? "Market research observation" :
  kind === "owner-confirmed" ? "Prepared business fact" : kind === "website-observation" ? "Existing website observation" :
    kind === "historical-review-answer" ? "Retained Free Review interview" : "Retained Free Review assessment";

async function request<T>(path = "", operation?: object): Promise<T> {
  const response = await fetch(endpoint + path, {
    method: operation ? "POST" : "GET", cache: "no-store",
    headers: { "X-Intake-Request": "1", ...(operation && { "Content-Type": "application/json" }) },
    ...(operation && { body: JSON.stringify(operation) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function Interview({ view }: { view: CoreInterviewView }) {
  const assessment = view.readiness[0];
  const last = view.state.turns.at(-1);
  const evidence = new Map(view.evidence.map(item => [item.id, item]));
  return <>
    <h2>What we already know</h2>
    <ul>{view.evidence.filter(item => !item.id.startsWith("market-")).map(item => <li key={item.id} className={styles.field}>
      {item.statement}<br /><small>{sourceLabel(item.kind, item.id)} · {item.at} · {item.reference}</small>
    </li>)}</ul>
    <details><summary>Market research and sources</summary>
      <ul>{view.evidence.filter(item => item.id.startsWith("market-")).map(item => <li key={item.id}>
        {item.statement}<br /><small>{item.reference} · {item.at}</small>
      </li>)}</ul>
    </details>
    <h2>Interview and saved answers</h2>
    <ol>{view.state.turns.map((turn, index) => <li key={turn.id} className={styles.field}>
      <strong>{index === 0 ? "Question from the earlier AI research proof" : turn.question ? "Local follow-up" : "Local answer review"}</strong>
      {turn.question && <p>{turn.question}</p>}
      <p>Why it matters. {turn.rationale}</p>
      <details><summary>Evidence used</summary><ul>{turn.sourceIds.map(id => <li key={id}>
        {evidence.get(id)?.reference ?? "Saved customer answer from the previous turn"}
      </li>)}</ul></details>
      {turn.answer && <p><strong>Saved answer.</strong> {turn.answer.text ?? "I don’t know yet."}</p>}
      {turn.answerReview && <p><strong>What we learned.</strong> {turn.answerReview.topic}{turn.answerReview.excerpt && <> · <q>{turn.answerReview.excerpt}</q></>}</p>}
    </li>)}</ol>
    <h2>Assessment</h2>
    <p><strong>{assessment.status === "planning-review" ? "Ready for planning review" : "Decision still open"}</strong></p>
    {assessment.recommendation && <p>{assessment.recommendation}</p>}
    {assessment.evidenceNeeded && <p><strong>Still unresolved.</strong> {assessment.evidenceNeeded}</p>}
    {last?.answer && <p>The latest answer is saved and awaits review.</p>}
    <p className={styles.hint}>Saved replies are draft evidence. An Operator must review proposed changes before any knowledge or publication approval.</p>
  </>;
}

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return code === "invalid_code" ? "That sign-in code was refused. Use the code from this rehearsal’s terminal."
    : code === "invalid_answer" ? "Use plain text of up to 900 characters."
    : code === "draft_changed" ? "The draft changed in another tab. Reload to continue with the latest saved version."
    : "The action could not finish. Reload to check what was saved before trying again.";
}

async function readSession() {
  const user = await request<User | null>();
  const desired = new URLSearchParams(location.search).get("interview") ?? "";
  const selected = user && /^(c0|c2|startup)\/(review|direct)$/.test(desired) &&
    (user.principal === "operator" ? user.cases.includes(desired) : desired.startsWith(user.principal + "/")) ? desired : "";
  const view = selected ? await request<CoreInterviewView | null>("/" + selected) : null;
  return { user, selected, view };
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<CoreInterviewView | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const operator = user?.principal === "operator";
  const adopt = (state: Awaited<ReturnType<typeof readSession>>) => {
    setUser(state.user);
    setSelected(state.selected);
    setView(state.view);
  };
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(messageFor(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    readSession().then(adopt).catch(error => setMessage(messageFor(error))).finally(() => setBusy(false));
  }, []);
  async function choose(value: string) {
    history.replaceState(null, "", value ? "?interview=" + encodeURIComponent(value) : location.pathname);
    setSelected(value);
    setView(null);
    if (value) setView(await request<CoreInterviewView | null>("/" + value));
  }
  const last = view?.state.turns.at(-1);
  const update = async (operation: object) => request<CoreInterviewView>("/" + selected, operation);
  const canReview = !!last?.answer && (view?.state.turns.length ?? 0) < 3;
  async function save(answer: string | null) {
    if (!view || !last) return;
    const saved = await update({ operation: "answer", version: view.version, questionId: last.id, answer });
    setView(saved);
    if (saved.state.turns.length < 3) setView(await update({ operation: "continue", version: saved.version }));
  }
  return <div className={styles.shell}>
    <header><strong>MioPages</strong><span>Local Core interview</span></header>
    <main className={styles.card} aria-busy={busy}>
      <h1>{user ? user.label : "Sign in to your interview"}</h1>
      <p className={styles.hint}>Disposable development data. The first question comes from the earlier live AI proof. Follow-ups and answer review run locally without sending your text to an AI provider.</p>
      {!user && <form onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget, code = new FormData(form).get("code");
        void perform(async () => { await request("", { operation: "login", code }); form.reset(); adopt(await readSession()); });
      }}>
        <div className={styles.field}><label htmlFor="access-code">Rehearsal sign-in code</label>
          <input id="access-code" name="code" type="password" autoComplete="off" maxLength={64} required /></div>
        <button disabled={busy}>Sign in</button>
      </form>}
      {user && <>
        <button className={styles.secondary} disabled={busy} onClick={() => void perform(async () => {
          await request("", { operation: "logout" }); await choose(""); adopt(await readSession());
        })}>Sign out</button>
        <h2>{operator ? "Saved customer interviews" : "Choose how you started"}</h2>
        {operator && !user.cases.length && <p>No customer has opened an interview yet. Reload after a customer starts.</p>}
        <div className={styles.actions}>{(operator ? user.cases : [user.principal + "/review", user.principal + "/direct"]).map(key =>
          <button key={key} type="button" disabled={busy} className={selected === key ? undefined : styles.secondary}
            aria-pressed={selected === key} onClick={() => void perform(() => choose(key))}>
            {operator ? labels[key.split("/")[0]] + " · " : ""}{pathLabel(key)}
          </button>)}</div>
        {selected && !view && !operator && <div>
          <p>{selected.endsWith("/review") ? "Continue from a completed rehearsal Free Review and its carried-forward evidence." : "Start with the available business knowledge and website observations."} Both routes use the same interview.</p>
          <button disabled={busy} onClick={() => void perform(async () => setView(await update({ operation: "begin" })))}>Open interview</button>
        </div>}
        {view && <>
          {operator && <p className={styles.hint}>Read-only Operator review of the same saved customer evidence.</p>}
          <Interview view={view} />
          {!operator && last?.question && !last.answer && view.state.turns.length < 3 && <form key={last.id} onSubmit={event => {
            event.preventDefault();
            const answer = String(new FormData(event.currentTarget).get("answer") ?? "");
            void perform(() => save(answer));
          }}>
            <div className={styles.field}><label htmlFor="interview-answer">Your answer</label>
              <textarea id="interview-answer" name="answer" rows={4} maxLength={900} required /></div>
            <div className={styles.actions}><button disabled={busy}>Save and review answer</button>
              <button disabled={busy} className={styles.secondary} type="button" onClick={() => void perform(() => save(null))}>I don’t know yet</button></div>
          </form>}
          {!operator && view.state.turns.length === 3 && last?.question && <p>Operator review is the next step for this unresolved decision.</p>}
          {!operator && canReview && <button disabled={busy} onClick={() => void perform(async () =>
            setView(await update({ operation: "continue", version: view.version })))}>Review saved answer</button>}
        </>}
      </>}
      {message && <p role="alert" className={styles.error}>{message}</p>}
    </main>
  </div>;
}

createRoot(document.getElementById("onboarding")!).render(<App />);
