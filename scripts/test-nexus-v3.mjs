import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import {onRequest} from "../functions/api/[[path]].js";
import {telegramConfigured} from "../functions/_nexus_telegram.js";
globalThis.crypto ||= webcrypto;

const site="https://star-cyber-ai-x.pages.dev",secret="x".repeat(48),owner="o".repeat(64);
const env={
 STAR_API_TOKEN:owner,
 STAR_AI_PROVIDER:"cloudflare",
 TELEGRAM_BOT_TOKEN:"123456789:"+ "A".repeat(38),
 TELEGRAM_WEBHOOK_SECRET:secret,
 TELEGRAM_ALLOWED_CHAT_IDS:"123456789",
 AI:{run:async(model,payload)=>{assert.equal(model,"@cf/meta/llama-3.1-8b-instruct");assert.match(payload.messages[1].content,/مرحبا/);return {response:"هذا رد من الذكاء"};}}
};
const webhook=(text,opts={})=>onRequest({
 request:new Request(site+"/api/telegram/webhook",{method:"POST",headers:{"Content-Type":"application/json",...(opts.secret===false?{}:{"X-Telegram-Bot-Api-Secret-Token":secret})},body:JSON.stringify({update_id:1000,message:{chat:{id:opts.chatId??123456789,type:opts.type||"private"},text}})}),
 env:opts.env||env,context:opts.context
});
assert.equal(telegramConfigured(env),true);
assert.equal(telegramConfigured({...env,TELEGRAM_BOT_TOKEN:""}),false);
assert.equal(telegramConfigured({...env,TELEGRAM_ALLOWED_CHAT_IDS:""}),false);

let r=await webhook("hello",{secret:false});assert.equal(r.status,401);
r=await webhook("hello",{env:{...env,TELEGRAM_WEBHOOK_SECRET:""}});assert.equal(r.status,503);
const original=globalThis.fetch;
const sends=[];
globalThis.fetch=async(url,opts)=>{
 assert.match(url,/^https:\/\/api\.telegram\.org\/bot[0-9]+:[A-Za-z0-9_-]+\/sendMessage$/);
 sends.push(JSON.parse(opts.body));
 return Response.json({ok:true});
};
try{
 r=await webhook("hello",{chatId:444444444});assert.equal(r.status,200);assert.equal(sends.length,0,"Non-allowlisted chat is ignored");
 r=await webhook("hello",{type:"group"});assert.equal(r.status,200);assert.equal(sends.length,0,"Groups not supported");
 r=await webhook("/start");assert.equal(r.status,200);assert.equal(sends.length,1);assert.match(sends.at(-1).text,/STAR NEXUS/);
 let tasks=[];
 r=await webhook("مرحبا، اختبر النموذج",{context:{waitUntil:p=>tasks.push(p)}});assert.equal(r.status,200);
 await Promise.all(tasks);
 assert.equal(sends.length,2);assert.equal(sends.at(-1).text,"هذا رد من الذكاء");
 assert.equal(sends.at(-1).chat_id,"123456789");
 assert.ok(!JSON.stringify(sends).includes(secret),"Secret not sent in message");

 r=await onRequest({request:new Request(site+"/api/nexus/status"),env});assert.equal(r.status,401);
 r=await onRequest({request:new Request(site+"/api/nexus/status",{headers:{"Authorization":"Bearer "+owner}}),env});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.telegram.configured,true);
 assert.equal(data.integrations.catalog_count,17);
 assert.equal(data.integrations.external_code_executed,false);
}finally{globalThis.fetch=original;}

const files=["web/index.html","web/nexus.css","web/nexus.js","web/telegram-setup.html"];
for(const f of files)assert.ok(fs.existsSync(f),"Missing "+f);
const html=fs.readFileSync("web/index.html","utf8");
const code=fs.readFileSync("web/nexus.js","utf8");
new vm.Script(code,{filename:"web/nexus.js"});
for(const id of ["authDialog","authForm","chatThread","chatForm","modelGrid","sourceGrid","sourceSearch","tgWebhook","metricModel","view-overview","view-chat","view-models","view-agents","view-telegram","view-settings"])
 assert.ok(html.includes('id="'+id+'"'),"Missing UX id "+id);
for(const p of ["nexus.css","nexus.js","manifest.webmanifest","telegram-setup.html"])assert.ok(html.includes(p),"Missing UI reference: "+p);
for(const needle of ["WormGPTv2/wormgpt","gaur-avvv/wormxgpt","IHA089/Drana-Infinity","father-bot/chatgpt_telegram_bot"])
 assert.ok(code.includes(needle),"Missing source registry: "+needle);
assert.ok(html.includes("/legacy-dashboard.html"),"Legacy dashboard must be available");
assert.ok(!html.includes("TELEGRAM_BOT_TOKEN ="),"No bot token in public page");
console.log("STAR NEXUS V3 UI + Telegram mock tests passed");
