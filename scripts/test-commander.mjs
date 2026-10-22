// STAR COMMANDER III functional smoke tests. Run with node scripts/test-commander.mjs
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const js = fs.readFileSync("web/star-core-v2-phase3.js", "utf8");
new vm.Script(js,{filename:"web/star-core-v2-phase3.js"});
const elements=new Map();
class FakeElement{
 constructor(tag="div",id=""){this.tagName=tag;this.id=id;this.textContent="";this.value="";this.hidden=false;this.disabled=false;this.style={};this.children=[];this.handlers={};this.classes=new Set();this.classList={toggle:(name,on)=>on===undefined?(this.classes.has(name)?this.classes.delete(name):this.classes.add(name)):(on?this.classes.add(name):this.classes.delete(name)),contains:(name)=>this.classes.has(name)};}
 addEventListener(type,fn){this.handlers[type]=fn;}
 append(...nodes){this.children.push(...nodes);}
 remove(){this.removed=true}
 replaceChildren(...nodes){this.children=[...nodes]}
 focus(){}
 scrollIntoView(){}
 click(){if(this.handlers.click)return this.handlers.click({currentTarget:this});}
}
const names=["p3Notice","p3VoiceNote","p3PlanArea","p3PlanSummary","p3Steps","p3ProgressFill","p3ProgressLabel","p3Objective","p3AiPlan","p3LocalPlan","p3Export","p3Scan","p3Voice","p3Speak","p3StopAudio","p3Api","p3Github","p3Delay","p3Model","p2AdminToken","prompt","p2ConsoleAnchor"];
for(const id of names)elements.set(id,new FakeElement("div",id));
let requests=0;
const sandbox={
 document:{getElementById:id=>elements.get(id)||null,createElement:tag=>new FakeElement(tag),querySelectorAll:()=>[]},
 window:{},sessionStorage:{getItem:()=>""},fetch:async()=>{requests++;throw Error("Unexpected network request")},
 performance:{now:()=>1},setTimeout,clearTimeout,AbortController,URL,Blob,
 SpeechSynthesisUtterance:class{},alert:()=>{},console,
};
vm.createContext(sandbox);
vm.runInContext(js,sandbox,{timeout:2000});
assert.match(elements.get("p3Notice").textContent,/وصف مهمتك/);
elements.get("p3Objective").value="فحص مشاكل تطبيق Cloudflare قبل تحديثه";
elements.get("p3LocalPlan").click();
assert.equal(elements.get("p3PlanArea").hidden,false);
assert.equal(elements.get("p3Steps").children.length,5);
assert.equal(requests,0,"Local planner must not make network calls");
const first=elements.get("p3Steps").children[0];
assert.equal(first.children.length,4);
first.children[3].children[0].click();
assert.match(elements.get("prompt").value,/ساعدني في الخطوة/);
assert.equal(requests,0,"Staging must not send messages");
first.children[3].children[1].click();
assert.equal(elements.get("p3ProgressFill").style.width,"20%");
sandbox.mode="private";
elements.get("p3AiPlan").click();
assert.equal(requests,0,"AI plan must refuse requests without POWER mode");
assert.match(elements.get("p3Notice").textContent,/POWER/);
console.log("STAR COMMANDER III smoke test passed: local plan, staged manual action, review progress, privacy guard");
