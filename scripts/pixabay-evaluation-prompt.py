"""Two owner-authorized searches; hidden API key, no credential persistence."""
import csv,getpass,json,os,pathlib,subprocess,sys
def main():
    if os.name!="nt":
        raise RuntimeError()
    repo=pathlib.Path(__file__).resolve().parent.parent
    root=repo/"runtime-content"/"pixabay-original-evidence-db5eea3e"
    root.mkdir(parents=True,exist_ok=True)
    if root.is_symlink() or root.resolve()!=root:
        raise RuntimeError()
    who=subprocess.check_output(["whoami","/user","/fo","csv","/nh"],text=True)
    sid=next(csv.reader([who.strip()]))[1]
    result=subprocess.run(["icacls",str(root),"/inheritance:r","/grant:r","*"+sid+":(OI)(CI)F"],
        capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError()
    key=getpass.getpass("Existing Pixabay API key (hidden; blank stops): ").strip()
    if not key:
        raise RuntimeError()
    try:
        child=subprocess.run(["node","--import","tsx","scripts/pixabay-evaluation-search.ts",str(root)],
            cwd=repo,input=key,text=True,capture_output=True)
        lines=child.stdout.strip().splitlines()
        receipt=json.loads(lines[-1]) if lines else None
        if child.returncode or not receipt or receipt.get("status")!="PASS":
            print('{"status":"BLOCKED","operation":"approved-pixabay-searches","requirement":"Preserve attempt evidence; do not retry"}')
            return 1
        print(json.dumps(receipt,separators=(",",":")))
    finally:
        key=""
    return 0
if __name__=="__main__":
    try:
        sys.exit(main())
    except (Exception,KeyboardInterrupt):
        print('{"status":"BLOCKED","operation":"approved-pixabay-searches","requirement":"No verified completion; preserve evidence"}')
        sys.exit(1)
