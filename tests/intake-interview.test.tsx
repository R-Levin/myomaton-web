import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import * as jsx from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import * as model from "../lib/platform/intake/model";
import { InterviewQuestion } from "../components/intake/question";
import { loadService } from "./helpers/load-service";
import { intakeAnswers } from "./helpers/intake";
import type { IntakeView } from "../lib/platform/intake/service";

test("client saves current controls, shows Saved, resumes and submits Q12 directly with the new version", async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:"http://localhost:61150/review/intake"});
  const names = ["window", "document", "navigator", "FormData", "IS_REACT_ACT_ENVIRONMENT", "fetch"];
  const old = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  for (const name of names.slice(0,4)) Object.defineProperty(globalThis, name, {configurable:true, value:dom.window[name as keyof Window]});
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {configurable:true,value:true});
  let stored: IntakeView = {intent:"FREE_REVIEW", state:"draft", answers:{project:model.projects[0]}, step:1, version:2, expiresAt:"2026-11-14T00:00:00.000Z"};
  const calls: Record<string,unknown>[] = [];
  Object.defineProperty(globalThis, "fetch", {configurable:true,value:async (_url:unknown, options:RequestInit) => {
    if (options.body) {
      const op = JSON.parse(String(options.body)); calls.push(op);
      if (op.version !== stored.version) return {ok:false,status:409,json:async()=>({error:"draft_changed"})};
      if (op.operation === "save") stored={...stored,answers:model.normalizeAnswers(op.answers),step:op.step,version:stored.version+1};
      else {model.validateComplete(stored.answers);stored={...stored,state:"needs_operator_review",version:stored.version+1};}
    }
    return {ok:true,json:async()=>structuredClone(stored)};
  }});
  const styles = new Proxy({}, {get:(_,key)=>String(key)});
  const ReviewInterview = loadService("components/intake/interview.tsx", {react:React,"react/jsx-runtime":jsx,"next/link":{default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>},"../../lib/platform/intake/model":model,"./interview.module.css":{default:styles},"./question":{InterviewQuestion}}).ReviewInterview as React.ComponentType;
  let root = createRoot(dom.window.document.getElementById("root")!);
  const mount = async () => { await act(async()=>root.render(<ReviewInterview/>)); };
  const click = async (label:string) => {const button=[...dom.window.document.querySelectorAll("button")].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>button.click());};
  try {
    await mount();
    (dom.window.document.querySelector('[name="businessName"]') as HTMLInputElement).value="Current-screen business";
    (dom.window.document.querySelector('[name="website"]') as HTMLInputElement).value="miopages.com";
    const homeLink = dom.window.document.querySelector('header a')!;
    assert.equal(homeLink.getAttribute('target'), '_blank'); assert.equal(homeLink.getAttribute('rel'), 'noopener noreferrer');
    assert.match(homeLink.getAttribute('aria-label')!, /opens in a new tab/);
    assert.match(dom.window.document.body.textContent!, /Links from this page open separately/);
    await act(async()=>homeLink.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true})));
    assert.equal(dom.window.location.pathname, '/review/intake');
    assert.equal(dom.window.document.querySelector('[name="businessName"]') !== null, true);
    assert.equal(stored.answers.businessName,"Current-screen business");assert.equal(stored.answers.website,"https://miopages.com/");
    assert.match(dom.window.document.querySelector('[role="status"]')!.textContent!,/^Saved\./);
    await act(async()=>root.unmount());root=createRoot(dom.window.document.getElementById("root")!);await mount();
    assert.equal((dom.window.document.querySelector('[name="businessName"]') as HTMLInputElement).value,"Current-screen business");
    assert.match(dom.window.document.body.textContent!,/Question 2 of 12/);
    (dom.window.document.querySelector('[name="website"]') as HTMLInputElement).value="http://127.0.0.1";
    await act(async()=>dom.window.document.querySelector("footer a")!.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true})));
    assert.match(dom.window.document.querySelector('[role="alert"]')!.textContent!, /highlighted fields/);
    assert.match(dom.window.document.body.textContent!, /Enter a valid public website address\./);
    assert.equal((dom.window.document.querySelector('[name="website"]') as HTMLInputElement).value,"http://127.0.0.1");
    assert.equal(stored.answers.website,"https://miopages.com/");
    (dom.window.document.querySelector('[name="website"]') as HTMLInputElement).value="miopages.com";
    // A stale server version must still refuse a different save and show an error.
    stored={...stored,version:stored.version+1};
    (dom.window.document.querySelector('[name="businessName"]') as HTMLInputElement).value="Stale answer";
    await act(async()=>dom.window.document.querySelector("header a")!.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true})));assert.match(dom.window.document.querySelector('[role="alert"]')!.textContent!,/another tab/);
    assert.equal(stored.answers.businessName,"Current-screen business");
    stored={...stored,answers:intakeAnswers(),step:12};
    await act(async()=>root.unmount());root=createRoot(dom.window.document.getElementById("root")!);await mount();
    assert.match(dom.window.document.body.textContent!,/Question 12 of 12/);assert.doesNotMatch(dom.window.document.body.textContent!,/Check your answers|Check before sending/);
    (dom.window.document.querySelector('[name="additional"]') as HTMLTextAreaElement).value="Final unsaved note";
    await click("Submit my Review");
    assert.equal(stored.answers.additional,"Final unsaved note");assert.equal(stored.state,"needs_operator_review");
    assert.deepEqual(calls.slice(-2).map(c=>c.operation),["save","submit"]);assert.equal(calls.at(-1)!.version, Number(calls.at(-2)!.version)+1);
    const text=dom.window.document.body.textContent!;
    assert.equal(text.match(/Your information was received/g)?.length,1);
    assert.doesNotMatch(text,/Email delivery is not available|Development intake|Nothing has been sent/);
    assert.equal(dom.window.document.querySelector('main a')!.getAttribute('href'),"/");assert.equal(dom.window.document.querySelectorAll('footer a').length,2);
    for (const link of dom.window.document.querySelectorAll('a')) { assert.equal(link.getAttribute('target'), '_blank'); assert.match(link.getAttribute('rel')!, /noopener/); }
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    names.forEach((name,i)=>{if(old[i])Object.defineProperty(globalThis,name,old[i]!);else Reflect.deleteProperty(globalThis,name);});
  }
});
