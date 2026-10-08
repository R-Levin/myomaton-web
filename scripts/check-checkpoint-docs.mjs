import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
// Include staged and unstaged changes; generated runtime data is never source.
const git=args=>cp.execFileSync('git',args,{encoding:'utf8'}).split('\0').filter(Boolean);
const modified=git(['diff','HEAD','--name-only','-z']),added=git(['ls-files','--others','--exclude-standard','-z']);
const files=[...new Set([...modified,...added])].sort();let links=0,anchors=0;
for(const file of files)assert.ok(!/[\t ]+$/m.test(fs.readFileSync(file,'utf8')),`Trailing whitespace: ${file}`);
const slug=s=>s.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/ /g,'-');
for(const file of files.filter(f=>f.endsWith('.md'))){const text=fs.readFileSync(file,'utf8');assert.ok(!/[\t ]+$/m.test(text),file);for(const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const href=m[1];if(/^(https?:|mailto:)/.test(href))continue;const [relative,anchor]=href.split('#');const target=relative?path.resolve(path.dirname(file),decodeURIComponent(relative)):path.resolve(file);assert.ok(fs.existsSync(target),`${file} -> ${href}`);links++;if(anchor){const body=fs.readFileSync(target,'utf8');assert.ok([...body.matchAll(/^#{1,6}\s+(.+)$/gm)].some(m=>slug(m[1])===anchor)||body.includes(`id="${anchor}"`),`${file} -> ${href}`);anchors++;}}}
assert.ok(files.every(f=>!/^runtime-content\/|^runtime-assets\/|^\.env|^\.next\/|\.log$|\.tsbuildinfo$/.test(f)));
console.log(JSON.stringify({total:files.length,files,links,anchors,excludedRuntime:true},null,2));
