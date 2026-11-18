import {lstat,readFile,realpath} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import type {OriginalMaterial} from "./presence-source-material";
/** Replay already retained sources byte-exactly; only unknown URLs use egress. */
export function retainedResearchFetch(root:string,live:typeof fetch):typeof fetch{
 return async(input,init)=>{
  const url=String(input),meta=await lstat(join(root,"index.json"));
  if(!meta.isFile()||meta.uid!==process.getuid?.()||(meta.mode&0o777)!==0o600)throw Error("Research index custody differs");
  const index=JSON.parse(await readFile(join(root,"index.json"),"utf8")) as OriginalMaterial[];
  const row=index.find(r=>r.mime==="text/html"&&r.researchSourceId&&r.reference===url);
  if(!row)return live(input,init);
  const path=join(root,row.sha256+".source"),info=await lstat(path);
  if(!info.isFile()||await realpath(path)!==path||info.uid!==process.getuid?.()||(info.mode&0o777)!==0o600)throw Error("Research source custody differs");
  const bytes=await readFile(path);
  if(bytes.length!==row.bytes||createHash("sha256").update(bytes).digest("hex")!==row.sha256)throw Error("Retained research integrity differs");
  const response=new Response(bytes,{headers:{"content-type":"text/html; charset=utf-8"}});
  Object.defineProperty(response,"url",{value:url});return response;
 };
}
