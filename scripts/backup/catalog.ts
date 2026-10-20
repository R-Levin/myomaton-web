import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { fingerprint } from "../../lib/platform/canonical/model";

// Preserve the original fingerprint inputs for forensic comparison of version-1 points.
export async function legacyCatalog(client: PoolClient, schemas: string[]) {
  const columns = (await client.query("SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_schema,udt_name,is_nullable,column_default,is_identity,identity_generation FROM information_schema.columns WHERE table_schema=ANY($1) ORDER BY table_schema,table_name,ordinal_position",[schemas])).rows;
  const constraints = (await client.query("SELECT n.nspname,c.relname,con.contype,con.convalidated,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) ORDER BY n.nspname,c.relname,con.conname",[schemas])).rows;
  const indexes = (await client.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=ANY($1) ORDER BY schemaname,tablename,indexname",[schemas])).rows;
  const triggers = (await client.query("SELECT n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND NOT t.tgisinternal ORDER BY n.nspname,c.relname,t.tgname",[schemas])).rows;
  const functions = (await client.query("SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1) AND p.prokind='f' ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)",[schemas])).rows;
  return {columns,constraints,indexes,triggers,functions};
}

type Row = Record<string, unknown>;
function ordered(rows: Row[]) { return rows.sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;}); }

// A deliberately narrow Boolean parser: only flatten adjacent AND nodes, retaining
// operand order and exact atom text. Never erase parentheses inside an atom, sort
// operands, rewrite arithmetic/casts, or simplify NOT/OR/NULL semantics. Unsupported
// lexical constructs remain exact text (fail closed on a representation difference).
export function normalizedCheck(definition:string):unknown {
  if(!definition.startsWith("CHECK (") || !definition.endsWith(")"))return definition;
  const tokens=definition.slice(6).match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9$]*|\s+|[\s\S]/g)?.filter(t=>!/^\s+$/.test(t))||[];
  // Standard quoted literals are opaque, byte-exact atoms: a regex '$' is data,
  // not dollar quoting. Escape strings/backslashes and unsupported SQL still refuse.
  if(tokens.some(t=>/^(BETWEEN|CASE|SELECT|E)$/i.test(t)||t.includes("\\")||t.includes("$")&&!/^'(?:''|[^'])*'$/.test(t)))return definition;
  const balanced=(ts:string[])=>{let depth=0;for(let i=0;i<ts.length;i++){if(ts[i]==="(")depth++;if(ts[i]===")")depth--;if(depth<0 || depth===0&&i<ts.length-1)return false;}return depth===0;};
  const parse=(input:string[]):unknown=>{
    let ts=input;while(ts[0]==="("&&ts.at(-1)===")"&&balanced(ts))ts=ts.slice(1,-1);
    let depth=0;const cuts:number[]=[];let hasOr=false;
    ts.forEach((t,i)=>{if(t==="(")depth++;else if(t===")")depth--;else if(depth===0&&t==="OR")hasOr=true;else if(depth===0&&t==="AND")cuts.push(i);});
    if(hasOr || !cuts.length)return {atom:ts};
    const children:unknown[]=[];let start=0;
    for(const end of [...cuts,ts.length]){const node=parse(ts.slice(start,end)) as {and?:unknown[]};if(node.and)children.push(...node.and);else children.push(node);start=end+1;}
    return {and:children};
  };
  return parse(tokens);
}

export type RecoveryCatalog = {version:2;semantic:Record<string,Row[]>;security:Record<string,Row[]>;environment:Row[];roles:Row[]};
export async function recoveryCatalog(client:PoolClient,schemas:string[]):Promise<RecoveryCatalog> {
  await client.query("SET LOCAL search_path=public");
  const query=async(sql:string,params:unknown[]=[schemas])=>ordered((await client.query(sql,params)).rows);
  const legacy=await legacyCatalog(client,schemas);
  const semantic:Record<string,Row[]>={
    schemas:await query("SELECT nspname name FROM pg_namespace WHERE nspname=ANY($1)"),
    relations:await query("SELECT n.nspname,c.relname,c.relkind,c.relpersistence,c.reloptions,c.relreplident,c.relrowsecurity,c.relforcerowsecurity,am.amname,CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid) END definition,CASE WHEN c.relkind='p' THEN pg_get_partkeydef(c.oid) END partition_key,pg_get_expr(c.relpartbound,c.oid) partition_bound FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_am am ON am.oid=c.relam WHERE n.nspname=ANY($1) AND c.relkind NOT IN ('i','I')"),
    // Index tuple attributes can retain pre-rename column labels in a live cluster.
    // Compare application columns here; pg_get_indexdef plus pg_index flags below
    // verify the logical index keys/expressions, uniqueness and validity separately.
    columns:await query("SELECT n.nspname,c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) default_expr,cn.nspname collation_schema,coll.collname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation coll ON coll.oid=a.attcollation LEFT JOIN pg_namespace cn ON cn.oid=coll.collnamespace WHERE n.nspname=ANY($1) AND c.relkind NOT IN ('i','I') AND a.attnum>0 AND NOT a.attisdropped"),
    constraints:(await query("SELECT n.nspname,c.relname,con.conname,con.contype,con.convalidated,con.condeferrable,con.condeferred,con.conislocal,con.coninhcount,con.connoinherit,con.conenforced,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1)")).map(row=>({...row,definition:row.contype==='c'?normalizedCheck(String(row.definition)):row.definition})),
    indexes:await query("SELECT n.nspname,c.relname,ci.relname indexname,pg_get_indexdef(i.indexrelid) definition,i.indisvalid,i.indisready,i.indisunique,i.indisprimary,i.indnullsnotdistinct,i.indisreplident FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1)"),
    triggers:ordered(legacy.triggers),functions:ordered(legacy.functions),
    sequences:await query("SELECT n.nspname,c.relname,format_type(s.seqtypid,NULL) type,s.seqstart::text,s.seqincrement::text,s.seqmax::text,s.seqmin::text,s.seqcache::text,s.seqcycle,tn.nspname owned_schema,t.relname owned_table,a.attname owned_column,d.deptype FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i') LEFT JOIN pg_class t ON t.oid=d.refobjid LEFT JOIN pg_namespace tn ON tn.oid=t.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE n.nspname=ANY($1)"),
    extensions:await query("SELECT e.extname,e.extversion,n.nspname,e.extrelocatable FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace",[]),
    types:await query("SELECT n.nspname,t.typname,t.typtype,format_type(t.typbasetype,t.typtypmod) base,t.typnotnull,t.typdefault,ARRAY(SELECT enumlabel FROM pg_enum WHERE enumtypid=t.oid ORDER BY enumsortorder) labels FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=ANY($1) AND t.typtype IN ('d','e')"),
    domainConstraints:await query("SELECT n.nspname,t.typname,c.conname,c.convalidated,pg_get_constraintdef(c.oid) definition FROM pg_constraint c JOIN pg_type t ON t.oid=c.contypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=ANY($1)"),
    policies:await query("SELECT schemaname,tablename,policyname,permissive,roles::text,cmd,qual,with_check FROM pg_policies WHERE schemaname=ANY($1)")
  };
  for(const key of Object.keys(semantic))ordered(semantic[key]);
  const security:Record<string,Row[]>={
    schemas:await query("SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl FROM pg_namespace WHERE nspname=ANY($1)"),
    relations:await query("SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) owner,c.relacl::text acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1)"),
    columns:await query("SELECT n.nspname,c.relname,a.attname,a.attacl::text acl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL"),
    functions:await query("SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1)"),
    types:await query("SELECT n.nspname,t.typname,pg_get_userbyid(t.typowner) owner,t.typacl::text acl FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=ANY($1)"),
    defaultPrivileges:await query("SELECT pg_get_userbyid(d.defaclrole) owner,n.nspname,d.defaclobjtype,d.defaclacl::text acl FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname=ANY($1)"),
    extensions:await query("SELECT extname,pg_get_userbyid(extowner) owner FROM pg_extension",[]),
    database:await query("SELECT pg_get_userbyid(datdba) owner,datacl::text acl FROM pg_database WHERE datname=current_database()",[])
  };
  const environment=await query("SELECT pg_encoding_to_char(encoding) encoding,datlocprovider,datcollate,datctype,datlocale,datcollversion FROM pg_database WHERE datname=current_database()",[]);
  // No password hashes: role flags/memberships are operational security, not credentials.
  const roles=await query("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil::text,rolconfig FROM pg_roles WHERE rolname !~ '^pg_'",[]);
  security.memberships=await query("SELECT pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE pg_get_userbyid(member) !~ '^pg_'",[]);
  security.settings=await query("SELECT CASE WHEN setrole=0 THEN 'ALL' ELSE pg_get_userbyid(setrole) END role,setconfig FROM pg_db_role_setting WHERE setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()) OR setdatabase=0",[]);
  return {version:2,semantic,security,environment,roles};
}
export function assertRecoveryEquivalent(source:RecoveryCatalog,restored:RecoveryCatalog) {
  assert.equal(restored.version,source.version);
  assert.deepEqual(restored.environment,source.environment,"Database locale/provider/encoding differs");
  // Older version-2 manifests can retain the exact-text CHECK fallback. Apply the
  // same narrow rule to both sides in memory; never rewrite manifests or hashes.
  // Other catalog fields and already-structured CHECKs remain exact comparisons.
  const comparable=(catalog:RecoveryCatalog)=>({...catalog.semantic,constraints:catalog.semantic.constraints.map(row=>({...row,definition:row.contype==='c'&&typeof row.definition==='string'?normalizedCheck(row.definition):row.definition}))});
  assert.deepEqual(comparable(restored),comparable(source),"Semantic schema differs");
  assert.deepEqual(restored.security,source.security,"Ownership/privileges/security differs");
  assert.deepEqual(restored.roles,source.roles,"Role security differs");
  return {semanticHash:fingerprint(source.semantic),securityHash:fingerprint({security:source.security,roles:source.roles}),environmentHash:fingerprint(source.environment)};
}
export function assertSequenceValues(source:unknown,restored:unknown) {
  assert.deepEqual(restored,source,"Sequence current values differ");
}
