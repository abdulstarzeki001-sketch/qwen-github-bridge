import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const origin="https://star-cyber-ai-x.pages.dev",token="k".repeat(64);
const rows=new Map(),requests=[];
const env={STAR_API_TOKEN:token,STAR_SUPABASE_URL:"https://xwigjsrbalbjwwjkxyma.supabase.co",STAR_SUPABASE_SECRET_KEY:"sb_secret_"+"a".repeat(46)};
const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 assert.ok(url.startsWith(env.STAR_SUPABASE_URL+"/rest/v1/star_ai_vault?"),"Supabase requests use fixed table URL");
 assert.equal(init.headers.apikey,env.STAR_SUPABASE_SECRET_KEY);
 assert.equal(init.headers.Authorization,undefined,"Opaque sb_secret key must not be used as JWT");
 requests.push({url,method:init.method||"GET"});
 const parsed=new URL(url),id=parsed.searchParams.get("id")?.replace("eq.","");
 if(init.method==="POST"){
  const body=JSON.parse(init.body);
  rows.set(body.id,body);
  return Response.json([body]);
 }
 if(init.method==="DELETE"){rows.delete(id);return new Response(null,{status:204})}
 if(id)return Response.json(rows.has(id)?[rows.get(id)]:[]);
 return Response.json([...rows.values()].filter(x=>!parsed.searchParams.has("kind")||parsed.searchParams.get("kind")==="eq."+x.kind));
};
function call(method="GET",path="/api/vault",body=null,auth=true,originHeader=origin){
 const headers={"Origin":originHeader,"Content-Type":"application/json"};
 if(auth)headers.Authorization="Bearer "+token;
 return onRequest({request:new Request(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env});
}
try{
 let r=await call("GET","/api/vault",null,false);
 assert.equal(r.status,401,"Must authenticate for vault");
 const entry={id:"chat-test001",kind:"thread",payload:{title:"A first thread",messages:[{role:"user",content:"مرحبا"}]}};
 r=await call("PUT","/api/vault",entry,false);
 assert.equal(r.status,401);
 r=await call("PUT","/api/vault",entry,true,"https://evil.example");
 assert.equal(r.status,403,"CSRF cross-origin rejected");
 r=await call("PUT","/api/vault",{...entry,payload:{title:"Broken",messages:[{role:"system",content:"unsafe"}]}});
 assert.equal(r.status,400,"Only proper chat roles can be persisted");
 r=await call("PUT","/api/vault",{...entry,payload:{title:"No",messages:[]},owner_secret:"not allowed"});
 assert.equal(r.status,400);
 assert.equal(requests.length,0,"Invalid requests never reach Supabase");
 r=await call("PUT","/api/vault",entry);
 assert.equal(r.status,200);
 assert.equal((await r.json()).item.id,entry.id);
 r=await call("GET","/api/vault?id=chat-test001");
 assert.equal(r.status,200);assert.deepEqual((await r.json()).item.payload,entry.payload);
 r=await call("GET","/api/vault?kind=thread");
 assert.equal((await r.json()).items.length,1);
 r=await call("DELETE","/api/vault?id=chat-test001");
 assert.equal(r.status,200);assert.equal(rows.size,0);
 const disabled={...env,STAR_SUPABASE_SECRET_KEY:undefined};
 r=await onRequest({request:new Request(origin+"/api/vault",{headers:{Authorization:"Bearer "+token}}),env:disabled});
 assert.equal(r.status,503,"Missing secret never silently creates a public endpoint");
 console.log("STAR Vault backend regression tests passed: auth, CSRF, validation, isolated Supabase operations, deletion, missing config");
}finally{globalThis.fetch=oldFetch}
