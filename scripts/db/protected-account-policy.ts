import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

/** Reviewed source composition, shared by disposable verification and installer.
 * No execution, secrets, ownership changes or implicit migration at import. */
export async function protectedAccountSql() {
  const paths=["lib/platform/intake/protected-account-policy.sql","lib/platform/contact/outcomes.sql",
    "lib/platform/intake/protected-account-outcomes.sql","lib/platform/intake/protected-account-rollback.sql"];
  const files=await Promise.all(paths.map(async path=>({path,bytes:await readFile(path)})));
  const history=files[1].bytes.toString("utf8").replaceAll("REFERENCES web_presences(","REFERENCES public.web_presences(")
    .replaceAll("REFERENCES managed_sites(","REFERENCES public.managed_sites(").replaceAll("REFERENCES contact_submissions(","REFERENCES public.contact_submissions(");
  const forward=[files[0].bytes.toString("utf8"),"SET LOCAL search_path TO miopages_core_account,public;",history,
    files[2].bytes.toString("utf8")].join("\n");
  const rollback=files[3].bytes.toString("utf8");
  const hash=(s:Buffer|string)=>createHash("sha256").update(s).digest("hex");
  return {forward,rollback,forwardSha256:hash(forward),rollbackSha256:hash(rollback),
    sources:files.map(file=>({path:file.path,sha256:hash(file.bytes)}))};
}

/** The Account's Client people (Principal, Nov 25): a further proposed amendment with its own
 * identity, after the customer-mandate amendment. Never folded into the approved bytes. */
export async function protectedAccountPeopleSql() {
  const corrected=await protectedAccountCorrectedSql();
  const paths=["lib/platform/accounts/people.sql","lib/platform/intake/protected-account-people.sql"];
  const [table,policy]=await Promise.all(paths.map(path=>readFile(path)));
  const amendment=["SET LOCAL search_path TO miopages_core_account,public;",
    table.toString("utf8").replaceAll("REFERENCES web_presences(","REFERENCES public.web_presences("),policy.toString("utf8")].join("\n");
  const hash=(s:Buffer|string)=>createHash("sha256").update(s).digest("hex");
  const forward=corrected.forward+"\n"+amendment;
  return {...corrected,forward,correctedForwardSha256:corrected.forwardSha256,forwardSha256:hash(forward),amendmentSha256:hash(amendment),
    sources:[...corrected.sources,...paths.map((path,index)=>({path,sha256:hash([table,policy][index])}))]};
}

/** Separate proposed SQL identity. Never silently replace the approved bytes. */
export async function protectedAccountCorrectedSql() {
  const original=await protectedAccountSql(),path="lib/platform/intake/protected-account-customer-mandate.sql";
  const amendment=await readFile(path),forward=original.forward+"\n"+amendment.toString("utf8");
  return {...original,forward,originalForwardSha256:original.forwardSha256,
    forwardSha256:createHash("sha256").update(forward).digest("hex"),
    amendmentSha256:createHash("sha256").update(amendment).digest("hex"),
    sources:[...original.sources,{path,sha256:createHash("sha256").update(amendment).digest("hex")}]};
}
