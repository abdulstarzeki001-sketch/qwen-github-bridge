import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const nodes=new Map(),storage=new Map(),calls=[];
function element(id){
 if(nodes.has(id))return nodes.get(id);
 const listeners=new Map();
 const e={id,value:"",disabled:false,textContent:"",className:"",scrollTop:0,scrollHeight:100,
  classList:{toggle(){}},
  addEventListener(name,fn){listeners.set(name,fn)},
  dispatch(name,event={}){const fn=listeners.get(name);if(!fn)throw Error("Missing event: "+id+" "+name);return fn(event)},
  querySelector(){return null},append(...children){this.children.push(...children)},
  replaceChildren(...children){this.children=[...children]},
  children:[],remove(){}
 };
 nodes.set(id,e);return e;
}
for(const id of ["instructions","model","temperature","temperatureValue","maxTokens","ownerStatus","gatewayStatus","serverNotice","saveServerProfile","loadServerProfile","deleteServerProfile","saveProfile","resetProfile","clearChat","settingsNotice","chatForm","prompt","send","chatNotice","messages","includeContext"])element(id);
element("temperature").value="0.15";
element("maxTokens").value="1400";
const document={getElementById:element,createElement:tag=>({tag,textContent:"",className:"",children:[],append(...items){this.children.push(...items)}})};
const fetch=async(url,opts={})=>{
 calls.push({url,opts});
 if(url==="/api/auth/session")return Response.json({authenticated:true});
 if(url==="/api/health")return Response.json({ok:true,ai_gateway:true,ai_model:"example"});
 if(url==="/api/owner/settings")return Response.json({enabled:false,profile:null});
 if(url==="/api/chat")return Response.json({ok:true,content:"Sovereign mock answer",model:"test-model"});
 throw Error("Unexpected URL "+url);
};
const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const source=fs.readFileSync("web/star-sovereign.js","utf8");
const context={window:{},document,fetch,Response,localStorage,AbortController,setTimeout,clearTimeout,console,confirm:()=>true};
vm.runInNewContext(source,context,{filename:"star-sovereign.js"});
await new Promise(resolve=>setTimeout(resolve,30));
assert.match(element("ownerStatus").textContent,/جلسة المالك فعالة/);
element("instructions").value="Answer in Arabic, be precise";
element("model").value="";
element("temperature").value="0.55";
element("maxTokens").value="2048";
element("prompt").value="Explain unit testing.";
let prevented=false;
await element("chatForm").dispatch("submit",{preventDefault(){prevented=true}});
assert.equal(prevented,true);
const sent=calls.find(x=>x.url==="/api/chat");
assert.ok(sent,"UI must call backend");
const payload=JSON.parse(sent.opts.body);
assert.equal(payload.owner_instructions,"Answer in Arabic, be precise");
assert.equal(payload.temperature,0.55);
assert.equal(payload.max_tokens,2048);
assert.equal(payload.prompt,"Explain unit testing.");
assert.equal(element("prompt").value,"","prompt clears only on success");
assert.equal(element("messages").children.length,2);
assert.match(element("chatNotice").textContent,/اكتمل الاستدلال/);
element("saveProfile").dispatch("click");
const saved=JSON.parse(storage.get("star-sovereign-owner-profile-v1"));
assert.equal(saved.owner_instructions,"Answer in Arabic, be precise");
console.log("STAR SOVEREIGN simulated browser submission and local settings: passed");
