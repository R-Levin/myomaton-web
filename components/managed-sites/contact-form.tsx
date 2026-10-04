"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { fieldLimits, type ContactDefinition, type FieldName } from "../../lib/platform/contact/model";

export function ContactForm({ definition, sectionId }: { definition: ContactDefinition; sectionId: string }) {
  const id = useId(), key = useRef<string | null>(null), feedback = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false), [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({}), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || success) return;
    setBusy(true); setErrors({}); setMessage("");
    const data = new FormData(event.currentTarget);
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        sectionId, definitionId: definition.id, version: definition.version, idempotencyKey: key.current,
        fields: Object.fromEntries(definition.fields.map(f => [f.key, data.get(f.key)])), website: data.get("website"),
      }) });
      const result = await response.json();
      if (response.ok && result.accepted === true) { setSuccess(true); setMessage(definition.successText); }
      else {
        const safeErrors: Partial<Record<FieldName, string>> = {};
        for (const f of definition.fields) if (typeof result.fieldErrors?.[f.key] === "string") safeErrors[f.key] = "Check this field and try again.";
        setErrors(safeErrors);
        setMessage(result.error === "definition_changed" ? "This form changed. Reload the page before submitting." : "Your message could not be confirmed. Check the form or try again later.");
      }
    } catch { setMessage("Your message could not be confirmed. Retry without changing the form to avoid duplication."); }
    finally { setBusy(false); requestAnimationFrame(() => feedback.current?.focus()); }
  }
  return <form className="managed-site-contact-form" onSubmit={submit} aria-busy={busy} aria-describedby={definition.privacyText ? `${id}-privacy` : undefined}>
    {definition.fields.map(f => <div key={f.key}>
      <label htmlFor={`${id}-${f.key}`}>{f.label}{f.required && <span> (required)</span>}</label>
      {f.key === "message"
        ? <textarea id={`${id}-${f.key}`} name={f.key} required={f.required} maxLength={fieldLimits[f.key]} disabled={success}
          aria-invalid={!!errors[f.key]} aria-describedby={errors[f.key] ? `${id}-${f.key}-error` : undefined} />
        : <input id={`${id}-${f.key}`} name={f.key} type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"}
          autoComplete={f.key === "phone" ? "tel" : f.key} required={f.required} maxLength={fieldLimits[f.key]} disabled={success}
          aria-invalid={!!errors[f.key]} aria-describedby={errors[f.key] ? `${id}-${f.key}-error` : undefined} />}
      {errors[f.key] && <p id={`${id}-${f.key}-error`}>Error: {errors[f.key]}</p>}
    </div>)}
    <div hidden aria-hidden="true"><label htmlFor={`${id}-website`}>Leave empty</label><input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" /></div>
    {definition.privacyText && <p id={`${id}-privacy`}>{definition.privacyText}</p>}
    <button type="submit" disabled={busy || success}>{busy ? "Sending…" : "Send message"}</button>
    <div ref={feedback} tabIndex={-1} role="status" aria-live="polite">{message}</div>
    <noscript>JavaScript is required to submit this form. Use an available contact method instead.</noscript>
  </form>;
}
