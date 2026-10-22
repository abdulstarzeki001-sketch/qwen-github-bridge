import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import vm from "node:vm";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const ctx={window:{}};
vm.runInNewContext(readFileSync(new URL("../web/star-hybrid.js",import.meta.url),"utf8"),ctx);
const hybrid=ctx.window.STAR_HYBRID;
assert.ok(hybrid,"Hybrid policy should initialize");
const mem=new Map(),storage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
assert.equal(hybrid.loadConsent(storage),false);
hybrid.saveConsent(storage,true);assert.equal(hybrid.loadConsent(storage),true);
hybrid.saveConsent(storage,false);assert.equal(hybrid.loadConsent(storage),false);
let localCalls=0,cloudCalls=0,askCalls=0;
const local=async()=>{localCalls++;return {content:"Qwen on phone",route:"PRIVATE"}},
  cloud=async()=>{cloudCalls++;return {content:"from cloud",route:"POWER"}};
let result=await hybrid.run({mode:"private",prompt:"Hello",local,cloud,approveFallback:async()=>{askCalls++;return true}});
assert.equal(result.route,"PRIVATE");
assert.equal(cloudCalls,0,"PRIVATE never reaches cloud");
result=await hybrid.run({mode:"auto",prompt:"Hello",local,cloud,approveFallback:async()=>{askCalls++;return true}});
assert.equal(result.route,"PRIVATE");assert.equal(cloudCalls,0,"Working local Qwen never calls cloud");
let denied=false;
try{await hybrid.run({mode:"auto",prompt:"sensitive",local:async()=>{throw Error("offline")},cloud,approveFallback:async()=>false})}catch(e){denied=e.code==="STAR_LOCAL_ONLY"}
assert.equal(denied,true,"Hybrid refuses automatic leak without approval");assert.equal(cloudCalls,0);
result=await hybrid.run({mode:"auto",prompt:"Hello",local:async()=>{throw Error("offline")},cloud,approveFallback:async()=>true});
assert.equal(result.route,"HYBRID_CLOUD");assert.equal(cloudCalls,1,"Cloud called exactly once after consent");
assert.equal(askCalls,0,"Private/local successful paths do not trigger cloud approval");

const origin="https://star-cyber-ai-x.pages.dev",token="t".repeat(64);
const env={STAR_API_TOKEN:token,OPENROUTER_API_KEY:"key-for-test",STAR_AI_PROVIDER:"openrouter",STAR_CLOUDFLARE_MODEL:"nvidia/nemotron-3-ultra-550b-a55b:free"};
const models=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");
 assert.equal(options.headers.Authorization,"Bearer "+env.OPENROUTER_API_KEY);
 const body=JSON.parse(options.body);
 models.push(body.model);
 if(body.model==="qwen/qwen3-8b:free")return Response.json({error:"temporarily throttled"},{status:429});
 return Response.json({choices:[{message:{content:"backup reply"}}],model:body.model});
};
const call=async(body,authed=true)=>onRequest({
 request:new Request(origin+"/api/chat",{method:"POST",headers:{
  "Content-Type":"application/json",
  "Origin":origin,
  ...(authed?{Authorization:"Bearer "+token}:{})
 },body:JSON.stringify(body)}),env
});
try{
 let r=await call({prompt:"safe test",hybrid_cloud:true},false);
 assert.equal(r.status,401);assert.equal(models.length,0,"Unauthenticated user cannot invoke hybrid cloud");
 r=await call({prompt:"safe test"});
 assert.equal(r.status,200);assert.deepEqual(models,[env.STAR_CLOUDFLARE_MODEL],"Normal cloud must retain configured model");
 models.length=0;
 r=await call({prompt:"safe test",hybrid_cloud:true});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.cloud_backup_used,true);
 assert.equal(body.model,env.STAR_CLOUDFLARE_MODEL);
 assert.deepEqual(models,["qwen/qwen3-8b:free",env.STAR_CLOUDFLARE_MODEL],"Hybrid tries Qwen and then backup");
 models.length=0;
 globalThis.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);models.push(body.model);
  return Response.json({choices:[{message:{content:"Qwen answer"}}],model:body.model});
 };
 r=await call({prompt:"safe test",hybrid_cloud:true});
 assert.equal(r.status,200);
 const qwen=await r.json();assert.equal(qwen.model,"qwen/qwen3-8b:free");assert.equal(qwen.cloud_backup_used,false);
 assert.deepEqual(models,["qwen/qwen3-8b:free"],"Qwen success must not consume backup inference");
 console.log("STAR HYBRID tests passed: PRIVATE isolation, consent gate, Qwen cloud selection, provider backup, authentication");
}finally{globalThis.fetch=originalFetch}
