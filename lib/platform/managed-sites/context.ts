import "server-only";
import { db } from "../db/connection";
import { deploymentSelection } from "./deployment";
export async function deploymentContext() {
  const selected=deploymentSelection();
  const rows=await db.$client.query("SELECT w.primary_domain AS domain,m.name AS managed_site_name FROM managed_sites m JOIN web_presences w ON w.id=m.web_presence_id WHERE m.id=$1 AND w.id=$2 AND m.status='active' AND w.status='active'",[selected.managedSiteId,selected.webPresenceId]);
  if (rows.rows.length!==1) throw Error("Unavailable deployment context");
  return {...selected,domain:rows.rows[0].domain as string,managedSiteName:rows.rows[0].managed_site_name as string};
}
