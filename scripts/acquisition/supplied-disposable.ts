import type { Pool } from "pg";
import { requireDisposableMedia } from "../../lib/platform/content-editing/proposal-media";
import { transaction } from "../../lib/platform/acquisition/service";

// Opt in on a disposable fixture only. The canonical migration ledger and
// installed generated-image capability keep their current contract.
export async function enableDisposableSuppliedMedia(pool: Pool) {
  await transaction(pool, async db => {
    await requireDisposableMedia(db);
    await db.query("SELECT set_config('search_path', current_schema(), true)");
    await db.query(`
      ALTER TABLE external_work DROP CONSTRAINT external_work_capability,
        ADD CONSTRAINT external_work_capability CHECK (capability IN ('image-generation','editorial-reconciliation','supplied-raster')),
        DROP CONSTRAINT external_work_bounds,
        ADD CONSTRAINT external_work_bounds CHECK (
          version>0 AND (actual_micros IS NULL OR actual_micros>=0) AND
          ((capability='supplied-raster' AND iteration=1 AND attempts=0 AND retries=0
            AND budget_micros=0 AND reserved_micros=0 AND actual_micros IS NULL AND lease_token IS NULL AND lease_until IS NULL)
          OR (capability<>'supplied-raster' AND iteration BETWEEN 1 AND 2 AND attempts BETWEEN 0 AND 3
            AND retries BETWEEN 0 AND 2 AND budget_micros>0 AND reserved_micros BETWEEN 0 AND budget_micros)));
      ALTER TABLE media_candidates DROP CONSTRAINT media_candidates_format,
        ADD CONSTRAINT media_candidates_format CHECK (
          ((source_kind='generated-illustrated' AND mime_type IN ('image/png','image/jpeg','image/webp'))
          OR (source_kind IN ('customer-supplied','permissioned-stock') AND mime_type='image/png'))
          AND width>0 AND height>0 AND width::bigint*height<=40000000 AND revision>0 AND version>0);
    `);
  });
}
