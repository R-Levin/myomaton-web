"""Read-only truth check for the existing disposable WordPress comparison."""
import hashlib,json,pathlib,sqlite3,sys
root=pathlib.Path(sys.argv[1]).resolve()
assert root.name=="p022-wp-validation" and (root/"c0.sqlite").is_file()
render=json.loads((root/"source-aware-render.json").read_text())
assert render["case"]=="41a83e7e-1765-4517-941a-b2b151bb7c4a"
packet=root/"source-aware-incoming"/render["packet"]
assert hashlib.sha256(packet.read_bytes()).hexdigest()==render["packetSha256"]
data=json.loads(packet.read_text())
ids=sorted(render["pages"].values())
assert len(ids)==len(set(ids)) and all(isinstance(x,int) and x>202 for x in ids)
with sqlite3.connect((root/"c0.sqlite").as_uri()+"?mode=ro",uri=True) as db:
 old=db.execute("SELECT ID,post_type,post_status,post_name,post_title,post_content FROM wp_posts WHERE ID<=202 ORDER BY ID").fetchall()
 oldhash=hashlib.sha256(json.dumps(old,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
 assert oldhash=="6ad9ca038ebd73c9150eb1ed404a873c5435c53fb8c2e0c23dac7922192dc514"
 rows=[];metas=[]
 for path,id in sorted(render["pages"].items()):
  row=db.execute("SELECT ID,post_type,post_status,post_name,post_title,post_content FROM wp_posts WHERE ID=?",(id,)).fetchone()
  assert row and row[1]=="page" and row[2]=="draft"
  page=next(x for x in data["candidate"]["pages"] if x["path"]==path)
  assert row[4]==page["title"]
  meta=db.execute("SELECT meta_key,meta_value FROM wp_postmeta WHERE post_id=? AND meta_key IN ('_miopages_source_aware_case','_miopages_source_candidate_digest','_miopages_draft_brand') ORDER BY meta_key",(id,)).fetchall()
  assert dict(meta)["_miopages_source_aware_case"]==render["case"] and dict(meta)["_miopages_source_candidate_digest"]==render["digest"]
  assert "_miopages_draft_brand" in dict(meta)
  rows.append(row);metas.append((id,meta))
native=hashlib.sha256(json.dumps([rows,metas],ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
print(json.dumps({"digest":native,"oldPostsDigest":oldhash,"oldPosts":len(old),"pages":render["pages"],"packetDigest":render["digest"],"brandDigest":render["brandDigest"]}))
