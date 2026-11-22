import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { assertNativeSection, pendingContent, readNativeComponent, type NativeNode } from "../lib/platform/intake/presence-native-component";
import { validatePages } from "../lib/platform/wordpress-delivery/authority";

function node(kind: NativeNode["kind"], changes: Partial<NativeNode> = {}): NativeNode {
  return { kind, text: null, level: null, items: [], ordered: false, reference: null,
    layout: { arrangement: "flow", columns: [], gap: "medium", inset: "none", surface: "none",
      align: "start", measure: "full", typeScale: "body", span: 1, mobileOrder: 0, border: false, rounded: false }, children: [], ...changes };
}
export const component = {
  version: 2, name: "fixture-decision-map", purpose: "Synthetic layout round trip", mode: "supplement",
  root: node("group", {
    layout: { ...node("group").layout, arrangement: "columns", columns: [2, 1], gap: "large" },
    children: [
      node("group", { children: [
        node("heading", { level: 2, text: "Fixture first decision" }),
        node("paragraph", { text: "An asymmetric main explanation." }),
        node("details", { text: "Fixture supporting detail", children: [node("paragraph", { text: "Expanded evidence." })] }),
      ] }),
      node("group", { layout: { ...node("group").layout, surface: "tonal", inset: "medium", rounded: true },
        children: [node("heading", { level: 3, text: "Fixture second decision" }),
          node("list", { ordered: true, items: ["First fixture step", "Second fixture step"] })] }),
    ],
  }),
};

test("original component structure survives Core validation and native WordPress projection without flattening", () => {
  const parsed = readNativeComponent(component);
  assert.equal(readNativeComponent({...component,name:"Readable Component Name"},true).name,"readable-component-name");
  assert.throws(()=>readNativeComponent({...component,name:"Readable Component Name"}));
  assert.throws(()=>readNativeComponent({...component,name:"Unsafe <component>"},true));
  const labelledList={...component,root:node("list",{text:"Choices explained",items:["First","Second"]})};
  assert.equal(readNativeComponent(labelledList).root.text,"Choices explained");
  const labelled=spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php",["wordpress/miopages-delivery/tests/native-component.php"],{input:JSON.stringify(labelledList),encoding:"utf8"});
  assert.equal(labelled.status,0,labelled.stderr);
  assert.match(labelled.stdout,/Choices explained/);
  assert.deepEqual(parsed.root.layout.columns, [2, 1]);
  assert.equal(parsed.root.children[0].children[2].kind, "details");
  const pages = [{ id: "11111111-1111-4111-8111-111111111111", path: "/", title: "Fixture", composition: "managed-v1" as const,
    navigationLabel: "Home", sections: [{ id: "22222222-2222-4222-8222-222222222222", type: "hero",
      content: { heading: "Fixture only", text: "No public source or model calls." }, block: parsed }] }];
  validatePages(pages, true, true);
  assert.throws(() => validatePages(pages, true, false), /local draft/);
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify(component), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  const html = php.stdout;
  assert.match(html, /wp:details/);
  assert.match(html, /minmax\(0,2fr\) minmax\(0,1fr\)/);
  assert.match(html, /Fixture first decision/);
  assert.match(html, /Fixture second decision/);
  assert.ok(html.indexOf("Fixture first decision") < html.indexOf("Fixture second decision"));
  assert.match(html, /wp:list-item/);
  assert.match(html, /metadata.*fixture-decision-map/);
});

test("unknown executable fields, foreign resources, reordered mobile content and malformed native nodes refuse", () => {
  assert.throws(() => readNativeComponent({ ...component, script: "alert(1)" }));
  assert.throws(() => readNativeComponent({ ...component, root: node("paragraph", { text: "<iframe>" }) }));
  assert.throws(() => readNativeComponent({ ...component, root: node("image", { reference: "https://foreign.test/image.png" }) }));
  assert.throws(() => readNativeComponent({ ...component, root: { ...component.root, layout: { ...component.root.layout, mobileOrder: 1 } } }));
  const intent = { ...component, root: node("image", { reference: "section-0", text: "Proposed explanatory illustration; not an acquired Asset." }) };
  assert.equal(readNativeComponent(intent).root.text, intent.root.text);
  assert.throws(() => readNativeComponent({ ...intent, root: { ...intent.root, text: "<script>unsafe</script>" } }));
  const foreign = { ...component, root: node("image", { reference: "section-999" }) };
  assert.equal(spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify(foreign), encoding: "utf8" }).status, 1);
});


test("the existing disposable WordPress renders nested blocks and responsive order without changing its Pages", {
  skip: !process.env.MIOPAGES_DISPOSABLE_WORDPRESS,
}, async () => {
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php",
    [...(process.platform === "win32" ? ["-d", "extension_dir=C:/php/ext", "-d", "extension=pdo_sqlite", "-d", "extension=sqlite3", "-d", "extension=gd"] : []),
      "scripts/wordpress-native-component-proof.php", process.env.MIOPAGES_DISPOSABLE_WORDPRESS!],
    { input: JSON.stringify(component), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  const result = JSON.parse(php.stdout);
  assert.equal(result.status, "PASS");
  assert.equal(result.unchangedPosts, true);
  const css = await readFile("wordpress/miopages-managed-site/style.css", "utf8");
  const browser = await chromium.launch({ executablePath: process.env.MIOPAGES_RESEARCH_CHROMIUM ??
    (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined), headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:24px;--miopages-border:#ddd;--wp--preset--color--support:#e9e5f7;--miopages-tonal-ink:#2d2460}*{box-sizing:border-box}</style><style>' + css + '</style><main>' + result.html + '</main>');
      const columns = page.locator(".miopages-node-columns > .miopages-node");
      const first = await columns.nth(0).boundingBox(), second = await columns.nth(1).boundingBox();
      assert.ok(first && second);
      if (width === 1440) {
        assert.ok(second.x > first.x + first.width);
        assert.ok(first.width / second.width > 1.9);
      } else {
        assert.ok(second.y > first.y + first.height);
        assert.ok(Math.abs(first.x - second.x) < 1);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.close();
    }
  } finally { await browser.close(); }
});

test("a whole authored Section replaces the fixed shell while preserving the exact semantic Page title", () => {
  const full=readNativeComponent({...component,mode:"section",root:node("group",{children:[
    node("heading",{text:"Exact fixture opening",level:1,layout:{...node("heading").layout,typeScale:"display"}}),
    node("paragraph",{text:"The composed explanation, once."}),
  ]})});
  assertNativeSection(full,"Exact fixture opening","hero");
  assert.throws(()=>assertNativeSection(full,"Changed title","hero"),/exact semantic/);
  assert.throws(()=>assertNativeSection({...full,mode:"supplement"},"Exact fixture opening","hero"),/Page title/);
  const candidate={pages:[{path:"/",title:"Fixture",composition:"managed-v1",navigationLabel:"Home",sections:[
    {id:"fixture-hero",type:"hero",content:{heading:"Exact fixture opening",text:"Fixed shell must not be emitted"},block:full},
  ]}],navigation:["/"],actions:[]};
  const php=spawnSync(process.platform==="win32"?"C:/php/php.exe":"php",["wordpress/miopages-delivery/tests/native-component.php"],
    {input:JSON.stringify({candidate,postIds:{"/":99}}),encoding:"utf8"});
  assert.equal(php.status,0,php.stderr);
  assert.equal((php.stdout.match(/<h1 /g)??[]).length,1);
  assert.ok(!php.stdout.includes("Fixed shell must not be emitted"));
  assert.match(php.stdout,/miopages-authored-section/);
});

test("an unresolved Action slot cannot shift later Direct Start and Review bindings",()=>{
 const hero=readNativeComponent({...component,mode:"section",root:node("group",{children:[
  node("heading",{text:"Choose a route",level:1}),
  node("action",{text:"Unavailable",reference:"action-0"}),
  node("action",{text:"Direct Start",reference:"action-1"}),
  node("action",{text:"Free Review",reference:"action-2"}),
 ]})});
 const page=(path:string)=>({path,title:path,composition:"managed-v1",navigationLabel:path,sections:[] as unknown[]});
 const candidate={pages:[{...page("/"),sections:[{id:"hero",type:"hero",content:{heading:"Choose a route",text:"Fixture"},block:hero}]},page("/direct"),page("/review")],
  navigation:["/"],actions:[
   {type:"page",from:"/",destination:"/direct",label:"Direct Start",componentReference:"action-1"},
   {type:"page",from:"/",destination:"/review",label:"Free Review",componentReference:"action-2"},
  ]};
 const run=(change:object={})=>spawnSync(process.platform==="win32"?"C:/php/php.exe":"php",["wordpress/miopages-delivery/tests/native-component.php"],
  {input:JSON.stringify({candidate,postIds:{"/":100,"/direct":101,"/review":102},pendingActions:[{from:"/",reference:"action-0",label:"Unavailable"}],...change}),encoding:"utf8"});
 const result=run();assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/<a[^>]*page_id=101[^>]*>Direct Start<\/a>/);
 assert.match(result.stdout,/<a[^>]*page_id=102[^>]*>Free Review<\/a>/);
 assert.match(result.stdout,/Unavailable — preview only; submissions disabled/);
 assert.equal(run({pendingActions:[]}).status,1,"Unknown Action still refuses");
 assert.equal(run({localSemanticBlocks:false}).status,1,"Private references stay unavailable to signed delivery");
 assert.equal(run({pendingActions:[{from:"/",reference:"action-1",label:"Conflict"}]}).status,1);
});

test("nested comparisons keep readable columns inside an aligned native flow",async()=>{
 const card=()=>node("group",{layout:{...node("group").layout,inset:"medium",surface:"light",border:true},children:[
  node("heading",{level:3,text:"A meaningful visitor choice"}),
  node("paragraph",{text:"A complete explanation must remain readable within this card. It must not collapse to the padding width when the surrounding flow aligns its children at the start."}),
 ]});
 const value={...component,root:node("group",{children:[node("group",{layout:{...node("group").layout,arrangement:"columns",columns:[1,1],gap:"medium"},children:[card(),card()]})]})};
 const php=spawnSync(process.platform==="win32"?"C:/php/php.exe":"php",["wordpress/miopages-delivery/tests/native-component.php"],{input:JSON.stringify(value),encoding:"utf8"});
 assert.equal(php.status,0,php.stderr);
 const css=await readFile("wordpress/miopages-managed-site/style.css","utf8");
 const browser=await chromium.launch({executablePath:process.platform==="win32"?"C:/Program Files/Google/Chrome/Application/chrome.exe":undefined,headless:true});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.setContent('<style>body{margin:0;padding:24px}*{box-sizing:border-box}</style><style>'+css+'</style>'+php.stdout);
  const widths=await page.locator(".miopages-native-component p").evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,overflow:(node as HTMLElement).scrollWidth>(node as HTMLElement).clientWidth+1})));
  assert.equal(widths.length,2);for(const item of widths){assert.ok(item.width>200,JSON.stringify({width,item}));assert.equal(item.overflow,false)}
  await page.close();
 }}finally{await browser.close()}
});

test("Core's requested images render as marked FPO frames where no approved asset is bound",async()=>{
 const {validatePages}=await import("../lib/platform/wordpress-delivery/authority");
 const visual={purpose:"Show the managed relationship",brief:"Abstract illustration: business knowledge becoming a reviewed site.",altIntent:"Diagram of the managed service",status:"asset-needed"};
 const withImage=readNativeComponent({...component,mode:"section",root:node("group",{children:[
  node("heading",{text:"Opening",level:1}),node("image",{reference:"section-0"})]})});
 const withoutImage=readNativeComponent({...component,mode:"section",root:node("group",{children:[
  node("heading",{text:"Support",level:2}),node("paragraph",{text:"Explanation."})]})});
 const sections=[
  {id:"hero",type:"hero",content:{heading:"Opening",text:"x"},block:withImage,visual},
  {id:"support",type:"intro",content:{heading:"Support",text:"x"},block:withoutImage,visual:{...visual,status:"rights-review"}},
  {id:"plain",type:"intro",content:{heading:"Plain",text:"Text only."},visual:{...visual,status:"text-only"}},
  {id:"standard",type:"cta",content:{heading:"Standard",text:"Standard copy."},visual},
 ];
 const candidate={pages:[{id:"home",path:"/",title:"Home",composition:"managed-v1" as const,navigationLabel:"Home",sections}],navigation:["/"],actions:[]};
 validatePages(candidate.pages as Parameters<typeof validatePages>[0],true,true);
 const invalid=(bad:object)=>[{...candidate.pages[0],sections:[{...sections[0],visual:bad}]}] as unknown as Parameters<typeof validatePages>[0];
 assert.throws(()=>validatePages(invalid({...visual,status:"invented"}),true,true),/visual refused/);
 assert.throws(()=>validatePages(invalid({...visual,extra:1}),true,true),/visual refused/);
 const php=spawnSync(process.platform==="win32"?"C:/php/php.exe":"php",["wordpress/miopages-delivery/tests/native-component.php"],
  {input:JSON.stringify({candidate,postIds:{"/":99}}),encoding:"utf8"});
 assert.equal(php.status,0,php.stderr);
 const frames=php.stdout.match(/<figure class="miopages-fpo[^"]*"/g)??[];
 assert.equal(frames.length,3,"authored placement, authored section request and standard section request");
 assert.match(php.stdout,/Selected image awaiting rights review/);
 assert.match(php.stdout,/aria-label="For position only: Diagram of the managed service"/);
 assert.ok(!/<img /.test(php.stdout),"FPO is never an image file");
 assert.ok(!php.stdout.includes("Image placement awaiting asset review"));
 const plain=php.stdout.slice(php.stdout.indexOf(">Plain<"),php.stdout.indexOf(">Standard<"));
 assert.ok(!plain.includes("miopages-fpo"),"text-only sections stay text-only");
});

test("missing material becomes a visible, categorized placeholder rather than a gap or an invention", () => {
  const notice = "Customer testimonial needed here: a recent client describing the onboarding experience.";
  const withPlaceholder = { ...component, root: node("group", { children: [
    node("paragraph", { text: "What clients say." }),
    node("placeholder", { reference: "need-testimonial", text: notice }),
    node("placeholder", { reference: "need-price", text: "Monthly price for the managed service." }),
  ] }) };
  const parsed = readNativeComponent(withPlaceholder);
  assert.deepEqual(pendingContent(parsed), [
    { need: "testimonial", description: notice },
    { need: "price", description: "Monthly price for the managed service." },
  ]);
  const bad = (changes: Partial<NativeNode>) => ({ ...component, root: node("placeholder", changes) });
  assert.throws(() => readNativeComponent(bad({ reference: "need-anything", text: "x" })));
  assert.throws(() => readNativeComponent(bad({ reference: "need-testimonial", text: null })));
  assert.throws(() => readNativeComponent(bad({ reference: null, text: "x" })));
  const php = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify(withPlaceholder), encoding: "utf8" });
  assert.equal(php.status, 0, php.stderr);
  assert.equal((php.stdout.match(/<aside class="miopages-placeholder[^"]*" role="note"/g) ?? []).length, 2);
  assert.match(php.stdout, /Content needed<\/span><span class="miopages-placeholder-label">Customer testimonial needed<\/span>/);
  assert.match(php.stdout, /Pricing to be confirmed/);
  assert.ok(php.stdout.includes("a recent client describing the onboarding experience"));
  const refused = spawnSync(process.platform === "win32" ? "C:/php/php.exe" : "php", ["wordpress/miopages-delivery/tests/native-component.php"],
    { input: JSON.stringify(bad({ reference: "need-anything", text: "x" })), encoding: "utf8" });
  assert.notEqual(refused.status, 0);
});
