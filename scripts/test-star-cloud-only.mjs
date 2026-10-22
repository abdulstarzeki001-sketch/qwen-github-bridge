import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const v2=read("web/ai-v2.html"),old=read("web/ai.html"),api=read("functions/api/[[path]].js");
for(const token of ["qwen","inferrlm","127.0.0.1:8889","star-hybrid.js","data-mode=","/api/tags","probeLocal","hybrid_cloud"]){
 assert.ok(!v2.toLowerCase().includes(token.toLowerCase()),"Cloud-only UI contains retired dependency: "+token);
}
assert.match(v2,/STAR AI · السحابة/);
assert.match(v2,/async function askPower\(/);
assert.match(v2,/await askPower\(prompt\)/);
assert.match(old,/url=\/ai-v2\.html/,"Old AI page should redirect to main page");
assert.ok(!/qwen|hybrid_cloud/i.test(api),"Removed cloud route must not be callable");
for(const path of ["web/star-hybrid.js","scripts/test-star-hybrid.mjs","docs/STAR_IPHONE_HYBRID.md","IPHONE_HYBRID.md",".github/workflows/free-cpu-brain.yml","scripts/free_cpu_brain.py","legacy/qwen-github-bridge/README.md"])
 assert.ok(!existsSync(new URL("../"+path,import.meta.url)),"Retired component still present: "+path);
const url="https://star-cyber-ai-x.pages.dev",token="T".repeat(64);
const env={STAR_API_TOKEN:token,OPENROUTER_API_KEY:"fake-testing-provider-key",STAR_CLOUDFLARE_MODEL:"nvidia/nemotron-3-ultra-550b-a55b:free"};
let count=0,seen=null;
const original=globalThis.fetch;
globalThis.fetch=async(resource,opts)=>{
 count++;assert.equal(resource,"https://openrouter.ai/api/v1/chat/completions");
 const body=JSON.parse(opts.body);seen=body.model;
 return Response.json({choices:[{message:{content:"Cloud AI is responding"}}],model:body.model});
};
try{
 const req=(auth,body)=>new Request(url+"/api/chat",{method:"POST",headers:{
  Origin:url,"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+token}:{})
 },body:JSON.stringify(body)});
 let r=await onRequest({request:req(false,{prompt:"A test"}),env});
 assert.equal(r.status,401);assert.equal(count,0,"Cloud route must require owner authentication");
 r=await onRequest({request:req(true,{prompt:"Hello",hybrid_cloud:true}),env});
 assert.equal(r.status,200);const result=await r.json();
 assert.equal(seen,env.STAR_CLOUDFLARE_MODEL,"Old hybrid request must not change the cloud model");
 assert.equal(result.content,"Cloud AI is responding");
 assert.ok(!Object.hasOwn(result,"hybrid_cloud"));
 assert.equal(count,1);
 console.log("STAR cloud-only tests passed: retired scripts removed, owner authentication, single configured cloud model, live UI static checks.");
}finally{globalThis.fetch=original}
