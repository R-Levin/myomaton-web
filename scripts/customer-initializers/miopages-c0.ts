import frozen from "./miopages-c0-baseline.json";
import reviewed from "./miopages-c0-manifest.json";
import { initializeCustomer, type CustomerManifest, type CustomerState } from "../../lib/platform/customer-initialization";
import type { Pool } from "pg";
export const baseline = frozen as CustomerState;
export const manifest = reviewed as CustomerManifest;
export function initializeMioPages(pool: Pick<Pool,"connect">, options:{failAfter?:number}={}) {
  return initializeCustomer(pool,manifest,baseline,options);
}
