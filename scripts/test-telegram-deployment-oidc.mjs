import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyStarDeploymentOidc} from "../functions/_telegram_github_oidc.js";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const kp=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk={...await crypto.subtle.exportKey("jwk",kp.publicKey),kid:"star-test-kid",alg:"RS256",use:"sig"};
const now=Math.floor(Date.now()/1000);
const repo="abdulstarzeki001-sketch/qwen-github-bridge";
const ref=repo+"/.github/workflows/verify-star-telegram-production.yml@refs/heads/main";
const claims={
  iss:"https://token.actions.githubusercontent.com",aud:"star-nexus-telegram-webhook",
  repository:repo,ref:"refs/heads/main",workflow_ref:ref,
  sub:"repo:"+repo+":ref:refs/heads/main",event_name:"workflow_run",
  iat:now-5,nbf:now-5,exp:now+300
};
const enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
async function sign(c=claims){
  const data=enc({typ:"JWT",kid:"star-test-kid",alg:"RS256"})+"."+enc(c);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",kp.privateKey,new TextEncoder().encode(data));
  return data+"."+Buffer.from(sig).toString("base64url");
}
const token=await sign();
const fetchJwks=async()=>Response.json({keys:[jwk]});
assert.equal(await verifyStarDeploymentOidc(token,{jwksFetch:fetchJwks,now}),true);
// GitHub may customize sub; the signed repository, ref and workflow still fully constrain authorization.
assert.equal(await verifyStarDeploymentOidc(await sign({...claims,sub:"repo:"+repo+":job_workflow_ref:custom-org-template"}),{jwksFetch:fetchJwks,now}),true);
for(const override of [
  {aud:"other-application"},{ref:"refs/heads/feature"},{repository:"evil/other"},
  {workflow_ref:repo+"/.github/workflows/other.yml@refs/heads/main"},
  {event_name:"pull_request"},{iss:"https://attacker.invalid"},
  {exp:now-50},{iat:now+200},{nbf:now+200}
]){
  const signed=await sign({...claims,...override});
  assert.equal(await verifyStarDeploymentOidc(signed,{jwksFetch:fetchJwks,now}),false,
    "Must reject forged claims: "+JSON.stringify(override));
}
const corrupted=token.slice(0,-3)+"xxx";
assert.equal(await verifyStarDeploymentOidc(corrupted,{jwksFetch:fetchJwks,now}),false);
assert.equal(await verifyStarDeploymentOidc("not.a.jwt",{jwksFetch:fetchJwks,now}),false);
assert.equal(await verifyStarDeploymentOidc(token,{jwksFetch:async()=>Response.json({keys:[]}),now}),false);

const appOrigin="https://star-cyber-ai-x.pages.dev";
const botToken="123456789:"+ "A".repeat(38),secret="S".repeat(48);
const env={TELEGRAM_BOT_TOKEN:botToken,TELEGRAM_WEBHOOK_SECRET:secret,
  TELEGRAM_ALLOWED_CHAT_IDS:"8650336140"};
let configured=false,registrations=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
  const raw=String(url);
  if(raw==="https://token.actions.githubusercontent.com/.well-known/jwks")
    return Response.json({keys:[jwk]});
  assert.ok(raw.startsWith("https://api.telegram.org/bot"+botToken+"/"));
  if(raw.endsWith("/getMe"))return Response.json({ok:true,result:{is_bot:true,username:"Aistar0017616bot"}});
  if(raw.endsWith("/setWebhook")){
    registrations++;
    const d=JSON.parse(opts.body);
    assert.equal(d.secret_token,secret);
    assert.equal(d.url,appOrigin+"/api/telegram/webhook");
    configured=true;
    return Response.json({ok:true,result:true});
  }
  if(raw.endsWith("/getWebhookInfo"))return Response.json({ok:true,result:{url:configured?
    appOrigin+"/api/telegram/webhook":"",pending_update_count:0}});
  throw Error("Unexpected upstream "+raw);
};
try{
  const request=(bearer,method="POST",action="connect")=>onRequest({
    request:new Request(appOrigin+"/api/telegram/bootstrap",{
      method,headers:{"Authorization":"Bearer "+bearer,"Content-Type":"application/json"},
      ...(method==="POST"?{body:JSON.stringify({action})}:{})
    }),env
  });
  let r=await request("bad");
  assert.equal(r.status,401);assert.equal(registrations,0);
  r=await request(await sign({...claims,ref:"refs/heads/not-main"}));
  assert.equal(r.status,401);assert.equal(registrations,0);
  r=await request(token,"GET");assert.equal(r.status,405);
  r=await request(token,"POST","invalid");
  assert.equal(r.status,400);assert.equal(registrations,0);
  r=await request(token);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.connected,true);
  assert.equal(data.bot_username,"@Aistar0017616bot");
  assert.equal(registrations,1);
  assert.ok(!JSON.stringify(data).includes(secret));
  assert.ok(!JSON.stringify(data).includes(botToken));
  assert.ok(!JSON.stringify(data).includes("8650336140"));
  console.log("GitHub OIDC: only signed main-branch deployment may activate fixed Telegram webhook");
}finally{globalThis.fetch=oldFetch}
