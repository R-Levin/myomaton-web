import type { Pool, PoolClient } from "pg";
import { fingerprint } from "../canonical/model";
import { validateFpo } from "../presentation/fpo";
import { validateDirection } from "../presentation/plan";
import { validatePalette } from "../presentation/tokens";
import { requireAssetUuid } from "../assets/model";
import { AcquisitionFailure, type NeedContext } from "./contracts";

export async function loadNeed(db: Pick<Pool | PoolClient,"query">, webPresenceId: string, sectionId: string): Promise<NeedContext> {
  const rows = await db.query(`SELECT s.*, p.id AS page_id,p.version AS page_version,p.slug,
    m.id AS managed_site_id,m.version AS site_version,m.configuration AS site_configuration,
    d.configuration AS design,d.version AS design_version
    FROM sections s JOIN pages p ON p.id=s.page_id JOIN managed_sites m ON m.id=p.managed_site_id
    JOIN web_presences w ON w.id=m.web_presence_id JOIN design_systems d ON d.web_presence_id=w.id
    WHERE s.id=$1 AND w.id=$2 AND s.type='hero' AND p.slug='/' AND s.status='active'
    AND p.status='active' AND m.status='active' AND w.status='active' AND d.status='active'`, [requireAssetUuid(sectionId),requireAssetUuid(webPresenceId)]);
  if (rows.rows.length !== 1) throw new AcquisitionFailure("stale");
  const r=rows.rows[0];
  try {
    const need=validateFpo(r.metadata.visualNeed);
    if(need.role!=="service-illustration" || need.aspect!=="landscape-3:2" || need.permission!=="unresolved") throw Error();
    const direction=validateDirection(r.site_configuration.visualDirection);
    if(direction.grammar!=="service-led" || direction.version!==3) throw Error();
    validatePalette(r.design.palette);
    return {webPresenceId,managedSiteId:r.managed_site_id,pageId:r.page_id,sectionId,role:"service-illustration",strategy:"generated-illustrated",
      sectionVersion:r.version,pageVersion:r.page_version,siteVersion:r.site_version,need,sectionContent:r.content,
      sectionConfiguration:r.configuration,siteConfiguration:r.site_configuration,design:{configuration:r.design,version:r.design_version}};
  } catch { throw new AcquisitionFailure("stale"); }
}
export async function assertContext(db: Pick<Pool | PoolClient,"query">, context: NeedContext, expected: string) {
  if (fingerprint(context)!==expected || fingerprint(await loadNeed(db,context.webPresenceId,context.sectionId))!==expected) throw new AcquisitionFailure("stale");
}
