import { questionsFor, legacyIntakeVersion, intakeVersion, questionTitle, fieldLabel, fieldApplies, type Answers } from "../../lib/platform/intake/model";

export function InterviewQuestion({ index, answers, errors, change, classes = {}, questionnaireVersion = legacyIntakeVersion }: { index: number; answers: Answers; errors: Record<string, string>; change: (key: string, value: string | string[]) => void; classes?: Record<string,string>; questionnaireVersion?: string }) {
  return <>{questionsFor(questionnaireVersion)[index].fields.filter(f => fieldApplies(f, answers)).map(field => {
    const id = `intake-${field.key}`, error = errors[field.key], description = [field.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
    const label = fieldLabel(field, answers), value = answers[field.key];
    const repeated = label.replace(/ \(optional\)$/i, "") === questionTitle(index, answers, "FREE_REVIEW", questionnaireVersion);
    return <div className={classes.field} key={field.key}>
      {field.choices ? <fieldset aria-describedby={description} aria-invalid={!!error}>
        <legend className={repeated ? classes.visuallyHidden : undefined}>{label}</legend>
        {field.choices.map(option => {
          const selected = field.kind === "multiple" ? Array.isArray(value) && value.includes(option) : value === option;
          return <label className={classes.choice} key={option}><input type={field.kind === "multiple" ? "checkbox" : "radio"} name={field.key} value={option} checked={selected}
            disabled={questionnaireVersion === intakeVersion && field.key === "secondaryResponses" && option !== "Something else" && option === answers.primaryResponse || field.kind === "multiple" && !selected && Array.isArray(value) && !!field.max && value.length >= field.max}
            onChange={() => change(field.key, field.kind === "multiple" ? selected ? (value as string[]).filter(v => v !== option) : [...(Array.isArray(value) ? value : []), option] : option)} /><span>{option}</span></label>;
        })}
      </fieldset> : <><label className={repeated ? classes.visuallyHidden : undefined} htmlFor={id}>{label}</label>{repeated && !field.required && <p className={classes.hint}>Optional</p>}{field.kind === "textarea" ?
        <textarea id={id} name={field.key} rows={4} maxLength={field.max ?? 1500} value={typeof value === "string" ? value : ""} aria-required={!!field.required} aria-invalid={!!error} aria-describedby={description} onChange={e => change(field.key, e.target.value)} /> :
        <input id={id} name={field.key} type={field.kind === "email" || field.kind === "url" ? field.kind : "text"} autoComplete={field.key === "email" ? "email" : field.key === "contactName" ? "name" : field.key === "phone" ? "tel" : "off"}
          maxLength={field.max ?? 1500} value={typeof value === "string" ? value : ""} aria-required={!!field.required} aria-invalid={!!error} aria-describedby={description} onChange={e => change(field.key, e.target.value)} />}</>}
      {field.hint && <p className={classes.hint} id={`${id}-hint`}>{field.hint}</p>}
      {error && <p className={classes.error} id={`${id}-error`}>{error}</p>}
    </div>;
  })}</>;
}
