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
