import { customerTables, type CustomerState } from "./customer-initialization";
export type CustomerTarget = { organizationId: string; webPresenceId: string; managedSiteId: string };
// Ownership closure includes inactive rows and all siblings, not only visible Pages.
export function customerGraph(state: CustomerState, target: CustomerTarget): CustomerState {
  const sites = new Set(state.managed_sites.filter(r=>r.web_presence_id===target.webPresenceId).map(r=>r.id));
  const pages = new Set(state.pages.filter(r=>sites.has(r.managed_site_id)).map(r=>r.id));
  const navs = new Set(state.navigations.filter(r=>r.web_presence_id===target.webPresenceId).map(r=>r.id));
  return Object.fromEntries(customerTables.map(table=>[table,state[table].filter(r=>table==="organizations" ? r.id===target.organizationId
    : table==="web_presences" ? r.id===target.webPresenceId : table==="pages" ? pages.has(r.id) : table==="sections" ? pages.has(r.page_id)
    : table==="navigation_items" ? navs.has(r.navigation_id) : r.web_presence_id===target.webPresenceId)]));
}
export function otherCustomerState(state: CustomerState, target: CustomerTarget): CustomerState {
  const graph=customerGraph(state,target);
  return { migrations: state.migrations, ...Object.fromEntries(customerTables.map(t=>[t,state[t].filter(r=>!graph[t].includes(r))])) };
}
