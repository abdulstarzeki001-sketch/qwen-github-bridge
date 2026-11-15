import assert from "node:assert/strict";
import fs from "node:fs";
import {webcrypto} from "node:crypto";
import vm from "node:vm";
import {createGateway} from "../deploy/independent-ai/gateway.mjs";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const origin="https://star-cyber-ai-x.pages.dev";
const owner="A".repeat(64);
const token="T".repeat(64);
const defaultModel="gpt-oss:20b";
const allowedModels=[defaultModel,"qwen2.5-coder:7b","IHA089/drana-infinity-3b:3b"];
let called=0,seen=null;
const server=createGateway({token,model:defaultModel,allowedModels,upstreamFetch:async(url,opts)=>{
 called++;seen=JSON.parse(opts.body);
 return Response.json({model:seen.model,choices:[{message:{content:"Working model: "+seen.model}}]});
}});
assert.throws(()=>createGateway({token,model:defaultModel,allowedModels:[defaultModel,"bad model"]}),/Invalid STAR_ALLOWED_MODELS/);
assert.throws(()=>createGateway({token,model:defaultModel,allowedModels:["qwen2.5-coder:7b"]}),/Invalid STAR_ALLOWED_MODELS/);
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const endpoint="http://127.0.0.1:"+server.address().port;
try{
  let r=await fetch(endpoint+"/health",{headers:{Authorization:"Bearer "+token}});
  assert.equal(r.status,200);
  const details=await r.json();
  assert.deepEqual(details.models,allowedModels);
  const send=async(model,auth=token)=>fetch(endpoint+"/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+auth},
    body:JSON.stringify({model,messages:[{role:"user",content:"test"}]})
  });
  for(const model of allowedModels){
    r=await send(model);assert.equal(r.status,200);
    assert.equal((await r.json()).model,model);
  }
  assert.equal(called,3);
  r=await send("unknown-model");assert.equal(r.status,400);
  r=await send(allowedModels[1],"wrong");assert.equal(r.status,401);
  assert.equal(called,3,"Unexpected backend call");
}finally{await new Promise(resolve=>server.close(resolve));}

const env={STAR_API_TOKEN:owner,STAR_AI_PROVIDER:"selfhosted",
STAR_SELFHOSTED_URL:"https://model.example.org/chat/completions",STAR_SELFHOSTED_MODEL:defaultModel,
STAR_SELFHOSTED_TOKEN:token,STAR_ALLOWED_MODELS:allowedModels.join(",")};
const req=(path,headers={})=>onRequest({env,request:new Request(origin+path,{headers})});
let res=await req("/api/nexus/models");assert.equal(res.status,401);
res=await req("/api/nexus/models",{Authorization:"Bearer "+owner});
assert.equal(res.status,200);assert.deepEqual((await res.json()).models,allowedModels);
// Fixed Workers AI must not advertise Drana/Qwen as selectable when active.
const cloudEnv={...env,STAR_AI_PROVIDER:"cloudflare",AI:{run:async()=>({response:"ok"})}};
const cloudRequest=new Request(origin+"/api/nexus/models",{headers:{Authorization:"Bearer "+owner}});
const cloudResult=await onRequest({env:cloudEnv,request:cloudRequest});
assert.equal(cloudResult.status,200);
assert.deepEqual((await cloudResult.json()).models,["@cf/meta/llama-3.1-8b-instruct-fp8"]);
const origFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
 assert.equal(String(url),"https://model.example.org/health");
 assert.equal(opts.headers.Authorization,"Bearer "+token);
 return Response.json({ok:true,access:"authenticated",model:defaultModel,models:allowedModels});
};
try{
 res=await req("/api/nexus/model-probe",{Authorization:"Bearer "+owner});
 assert.equal(res.status,200);
 const r=await res.json();assert.equal(r.reachable,true);assert.deepEqual(r.models,allowedModels);
}finally{globalThis.fetch=origFetch;}
const html=fs.readFileSync("web/index.html","utf8");
const frontend=fs.readFileSync("web/nexus.js","utf8");
const css=fs.readFileSync("web/nexus-v5.css","utf8");
const compose=fs.readFileSync("deploy/independent-ai/compose.yaml","utf8");
const dockerfile=fs.readFileSync("deploy/independent-ai/Dockerfile.interpreter","utf8");
for(const id of ["chatModelSelect","probeModels"])assert.ok(html.includes('id="'+id+'"'));
assert.ok(html.includes("/nexus-v5.css"));
assert.ok(frontend.includes("/api/nexus/models"));
assert.ok(frontend.includes("/api/nexus/model-probe"));
assert.ok(frontend.includes('model:$("chatModelSelect").value||undefined'));
assert.ok(compose.includes('profiles: ["interpreter"]'));
assert.ok(compose.includes("STAR_ALLOWED_MODELS"));
assert.ok(!compose.includes("\n    ports:"),"Do not expose model ports");
assert.ok(dockerfile.includes("OPEN_INTERPRETER_VERSION=0.0.56"));
assert.ok(dockerfile.includes("OPEN_INTERPRETER_INSTALLER_REV="));
assert.ok(compose.includes("workspace-write"));
assert.ok(compose.includes("on-request"));
assert.ok(compose.includes("interpreter-private"));
assert.ok(compose.includes("internal: true"));
assert.ok(css.includes("@media"));
new vm.Script(frontend,{filename:"nexus.js"});
console.log("STAR NEXUS V5 gateway model switch, secured probe and Open Interpreter profile tests passed.");
