import assert from "node:assert/strict";
import test from "node:test";
import { Pool, type PoolClient } from "pg";
import { defaultConfig, restoreTest } from "../../scripts/backup/core";
import { recoveryCatalog, assertRecoveryEquivalent, assertSequenceValues, normalizedCheck } from "../../scripts/backup/catalog";
import {readCustomerState,stateFingerprint} from "../../lib/platform/customer-initialization";

test("private backup restore preserves semantic/security state and rejects real schema drift",async t=>{
  const root=process.env.BACKUP_TEST_ROOT,point=process.env.BACKUP_TEST_POINT;
  assert.ok(root&&point,"Explicit dedicated backup root/point required; never use shared DB as restore target");
  const config=defaultConfig(root);
  const check=async(label:string,run:()=>Promise<void>)=>{let failure:unknown;await t.test(label,async()=>{try{await run();}catch(error){failure=error;throw error;}});if(failure)throw failure;};
  const proof=await restoreTest(config,point,async(target,manifest)=>{
    const source=new Pool({connectionString:config.databaseUrl,options:"-c default_transaction_read_only=on"});
    const read=async(pool:Pool)=>{const c=await pool.connect();try{await c.query('BEGIN READ ONLY');return await recoveryCatalog(c,manifest.source.includedSchemas);}finally{await c.query('ROLLBACK');c.release();}};
    try{assertRecoveryEquivalent(await read(source),await read(target));}finally{await source.end();}
    const c=await target.connect();
    const capture=async(client:PoolClient)=>recoveryCatalog(client,['backup_fixture']);
    try{
      await check('restored application role can read exact canonical state',async()=>{
        await c.query('BEGIN READ ONLY');try{await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query('SET LOCAL ROLE myomaton_app');await c.query('SET LOCAL search_path=public');assert.equal(stateFingerprint(await readCustomerState(c)),manifest.state.canonicalFingerprint);}finally{await c.query('ROLLBACK');}
      });
      await c.query(`CREATE SCHEMA backup_fixture;
        CREATE TABLE backup_fixture.subject (id serial PRIMARY KEY, label text NOT NULL DEFAULT 'original', amount integer DEFAULT 1, CONSTRAINT positive CHECK(amount>0));
        CREATE INDEX subject_label ON backup_fixture.subject(label);
        CREATE FUNCTION backup_fixture.example() RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 1';
        CREATE FUNCTION backup_fixture.guard() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';
        CREATE TRIGGER subject_notice BEFORE INSERT ON backup_fixture.subject FOR EACH ROW EXECUTE FUNCTION backup_fixture.guard();`);
      await c.query('BEGIN READ ONLY');const baseline=await capture(c);await c.query('ROLLBACK');
      const changes=[
        ['removed column','ALTER TABLE backup_fixture.subject DROP COLUMN amount CASCADE'],
        ['changed type','ALTER TABLE backup_fixture.subject ALTER COLUMN label TYPE varchar(100)'],
        ['changed nullability','ALTER TABLE backup_fixture.subject ALTER COLUMN label DROP NOT NULL'],
        ['changed default',"ALTER TABLE backup_fixture.subject ALTER COLUMN label SET DEFAULT 'different'"],
        ['missing index','DROP INDEX backup_fixture.subject_label'],
        ['missing constraint','ALTER TABLE backup_fixture.subject DROP CONSTRAINT positive'],
        ['sequence definition drift','ALTER SEQUENCE backup_fixture.subject_id_seq INCREMENT BY 2'],
        ['missing function','DROP FUNCTION backup_fixture.example()'],
        ['missing trigger','DROP TRIGGER subject_notice ON backup_fixture.subject'],
        ['changed owner','ALTER TABLE backup_fixture.subject OWNER TO pg_database_owner'],
        ['inappropriate public privilege','GRANT SELECT ON backup_fixture.subject TO PUBLIC'],
        ['missing required extension','DROP EXTENSION plpgsql CASCADE']
      ];
      for(const [label,sql] of changes)await check(label,async()=>{
        await c.query('BEGIN');try{await c.query(sql);const changed=await capture(c);assert.throws(()=>assertRecoveryEquivalent(baseline,changed));}
        finally{await c.query('ROLLBACK');}
      });
      // Current sequence state is independent of schema definitions; nextval/setval
      // are not rolled back. Alter only the private fixture and restore its exact value.
      await check('sequence current-value drift',async()=>{
        const before=(await c.query('SELECT last_value::text,is_called FROM backup_fixture.subject_id_seq')).rows;
        await c.query("SELECT setval('backup_fixture.subject_id_seq',123,true)");
        const after=(await c.query('SELECT last_value::text,is_called FROM backup_fixture.subject_id_seq')).rows;
        assert.throws(()=>assertSequenceValues(before,after));await c.query("SELECT setval('backup_fixture.subject_id_seq',$1,$2)",[before[0].last_value,before[0].is_called]);
      });
      await check('equivalent check enforces boundary and NULL behavior',async()=>{
        const left='CHECK ((((length(btrim(change_reason)) >= 1) AND (length(btrim(change_reason)) <= 1000)) AND ((length(btrim(responsible_identity)) >= 1) AND (length(btrim(responsible_identity)) <= 200))))';
        const right='CHECK (((length(btrim(change_reason)) >= 1) AND (length(btrim(change_reason)) <= 1000) AND ((length(btrim(responsible_identity)) >= 1) AND (length(btrim(responsible_identity)) <= 200))))';
        assert.deepEqual(normalizedCheck(left),normalizedCheck(right));
        const values=['', ' ', 'ok', 'x'.repeat(1000), 'x'.repeat(1001),null];
        for(const reason of values)for(const identity of ['', 'ok','x'.repeat(201),null]){
          const r=(await c.query(`SELECT ${left.slice(6)} AS a,${right.slice(6)} AS b FROM (SELECT $1::text change_reason,$2::text responsible_identity) x`,[reason,identity])).rows[0];assert.equal(r.a,r.b);
        }
      });
    }finally{await c.query('DROP SCHEMA IF EXISTS backup_fixture CASCADE');c.release();}
  });
  assert.equal(proof.allManagedObjectsRestored,true);assert.equal(proof.securityMatches,true);
});
