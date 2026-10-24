import assert from "node:assert/strict";
import {setupTelegramAccess,resolveCloudflarePagesAccount,TELEGRAM_ACCESS_PATHS} from "./configure-telegram-access.mjs";
const accountId="d2680f7c5ff39f8d9177a51dbf7fec75",token="Y".repeat(60);
const calls=[];
const data={apps:[]};
const fetcher=async (url,opts={})=>{
  calls.push({url:String(url),opts});
  if(String(url).endsWith("/pages/projects/star-cyber-ai-x"))
    return Response.json({success:true,result:{name:"star-cyber-ai-x"}});
  if(opts.method==="POST"){
    const body=JSON.parse(opts.body);
    assert.equal(body.type,"self_hosted");
    assert.match(body.domain,/^star-cyber-ai-x\.pages\.dev\/api\/telegram\/(webhook|bootstrap)$/);
    assert.equal(body.policies.length,1);
    assert.equal(body.policies[0].decision,"bypass");
    assert.deepEqual(body.policies[0].include,[{everyone:{}}]);
    assert.equal(body.app_launcher_visible,false);
    data.apps.push(body);
    return Response.json({success:true,result:body});
  }
  return Response.json({success:true,result:data.apps});
};
assert.deepEqual(TELEGRAM_ACCESS_PATHS,["/api/telegram/webhook","/api/telegram/bootstrap"]);
assert.equal(await resolveCloudflarePagesAccount(token,{candidates:[accountId],fetcher}),accountId);
let d=await setupTelegramAccess({accountId,apiToken:token,fetcher});
assert.equal(d.dryRun,true);
assert.equal(d.created.length,2);
assert.equal(data.apps.length,0,"Dry run cannot create Cloudflare apps");
d=await setupTelegramAccess({accountId,apiToken:token,fetcher,dryRun:false});
assert.equal(d.created.length,2);assert.equal(data.apps.length,2);
assert.equal(data.apps[0].domain,"star-cyber-ai-x.pages.dev/api/telegram/webhook");
assert.equal(data.apps[1].domain,"star-cyber-ai-x.pages.dev/api/telegram/bootstrap");
assert.ok(!JSON.stringify(data.apps).includes("admin"));
assert.equal(calls.filter(x=>x.opts.method==="POST").length,2);
d=await setupTelegramAccess({accountId,apiToken:token,fetcher,dryRun:false});
assert.equal(d.created.length,0);
assert.equal(d.already_present.length,2);
assert.equal(calls.filter(x=>x.opts.method==="POST").length,2,"Should not create duplicate apps");
data.apps[0].name="Unrelated Access app";
await assert.rejects(()=>setupTelegramAccess({accountId,apiToken:token,fetcher,dryRun:false}),/inspect it/);
assert.equal(calls.filter(x=>x.opts.method==="POST").length,2);
await assert.rejects(()=>setupTelegramAccess({accountId,apiToken:"bad",fetcher}),/Missing Cloudflare API token/);
await assert.rejects(()=>setupTelegramAccess({accountId:"bad",apiToken:token,fetcher}),/CLOUDFLARE_ACCOUNT_ID/);
await assert.rejects(()=>setupTelegramAccess({
 accountId,apiToken:token,fetcher:async()=>Response.json({errors:[{message:"secret server error"}]}, {status:403})
}),/Access: Apps and Policies Write/);
await assert.rejects(()=>resolveCloudflarePagesAccount(token,{candidates:[accountId],
 fetcher:async()=>Response.json({success:false},{status:403})
}),/Cannot verify/);
console.log("Scoped Telegram Access: exact two-path bypass, Pages ownership verification, idempotence and safe denial passed");
