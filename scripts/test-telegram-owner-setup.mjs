import assert from "node:assert/strict";
import fs from "node:fs";
import {webcrypto} from "node:crypto";
import {onRequest} from "../functions/api/[[path]].js";
import {telegramOwnerConnect,telegramOwnerStatus,STAR_TELEGRAM_WEBHOOK} from "../functions/_telegram_admin.js";
globalThis.crypto ||= webcrypto;

const site="https://star-cyber-ai-x.pages.dev";
const owner="o".repeat(64),token="123456789:"+ "A".repeat(38),secret="x".repeat(48);
const env={
  STAR_API_TOKEN:owner,TELEGRAM_BOT_TOKEN:token,
  TELEGRAM_WEBHOOK_SECRET:secret,TELEGRAM_ALLOWED_CHAT_IDS:"8650336140",
  AI:{run:async()=>({response:"hi"})}
};
const calls=[];
let wrongName=false,registered=false;
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
  const address=String(url);
  assert.ok(address.startsWith("https://api.telegram.org/bot"+token+"/"));
  assert.equal(options.method,"POST");
  assert.equal(options.headers["Content-Type"],"application/json");
  calls.push({action:address.split("/").at(-1),body:JSON.parse(options.body)});
  if(address.endsWith("/getMe"))return Response.json({ok:true,result:{
    is_bot:true,username:wrongName?"another_public_bot":"Aistar0017616bot"
  }});
  if(address.endsWith("/setWebhook")){
    assert.equal(JSON.parse(options.body).url,STAR_TELEGRAM_WEBHOOK);
    assert.equal(JSON.parse(options.body).secret_token,secret);
    assert.deepEqual(JSON.parse(options.body).allowed_updates,["message"]);
    assert.equal(JSON.parse(options.body).drop_pending_updates,false);
    registered=true;
    return Response.json({ok:true,result:true});
  }
  if(address.endsWith("/getWebhookInfo"))return Response.json({ok:true,result:{
    url:registered?STAR_TELEGRAM_WEBHOOK:"",pending_update_count:2,
    last_error_message:"Sensitive upstream payload must never leak"
  }});
  throw Error("Unexpected upstream method");
};
const send=(method,path="/api/telegram/admin",{authenticated=true,headers={},body}={})=>onRequest({
  request:new Request(site+path,{method,headers:{
    ...(authenticated?{"Authorization":"Bearer "+owner}:{}),
    ...(method==="POST"?{"Content-Type":"application/json","Origin":site}:{}),
    ...headers
  },...(method==="POST"?{body:JSON.stringify(body??{action:"connect"})}:{})}),
  env
});
try{
  let r=await send("GET",undefined,{authenticated:false});
  assert.equal(r.status,401);assert.equal(calls.length,0);
  r=await send("POST",undefined,{authenticated:false});
  assert.equal(r.status,401);assert.equal(calls.length,0);
  r=await send("GET",undefined,{});
  assert.equal(r.status,200);
  let data=await r.json();
  assert.equal(data.configured,true);assert.equal(data.connected,false);
  assert.equal(data.pending_updates,2);
  assert.ok(!JSON.stringify(data).includes("Sensitive upstream"));
  assert.equal(calls.length,1);
  r=await send("POST",undefined,{body:{action:"irrelevant"}});
  assert.equal(r.status,400);assert.equal(calls.length,1);
  r=await send("POST",undefined,{headers:{"Origin":"https://malicious.example"}});
  assert.equal(r.status,403);assert.equal(calls.length,1);
  wrongName=true;
  r=await send("POST");
  assert.equal(r.status,502);
  assert.equal(calls.length,2);assert.equal(registered,false);
  assert.ok(!JSON.stringify(await r.json()).includes(token));
  wrongName=false;
  r=await send("POST");
  assert.equal(r.status,200);
  data=await r.json();
  assert.equal(data.connected,true);assert.equal(data.configured,true);
  assert.equal(data.bot_username,"@Aistar0017616bot");
  assert.equal(data.webhook_url,STAR_TELEGRAM_WEBHOOK);
  assert.ok(!JSON.stringify(data).includes(token));
  assert.ok(!JSON.stringify(data).includes(secret));
  assert.ok(!JSON.stringify(data).includes("8650336140"));
  assert.equal(calls.map(x=>x.action).join(","),"getWebhookInfo,getMe,getMe,setWebhook,getWebhookInfo");
  r=await send("GET");
  assert.equal((await r.json()).connected,true);
  assert.equal((await telegramOwnerStatus({...env,TELEGRAM_WEBHOOK_SECRET:""})).configured,false);
  const unconfigured=await telegramOwnerConnect({...env,TELEGRAM_BOT_TOKEN:""});
  assert.equal(unconfigured.ok,false);
  assert.equal(unconfigured.configured,false);
  assert.equal(calls.length,6);
  const html=fs.readFileSync("web/telegram-setup.html","utf8");
  assert.ok(html.includes("/api/telegram/admin"));
  assert.ok(html.includes("telegramConnect"));
  assert.ok(!html.includes(token)&&!html.includes(secret));
  console.log("Telegram admin: owner-only activation, expected bot, fixed webhook, secret safety and status passed");
}finally{globalThis.fetch=oldFetch}
