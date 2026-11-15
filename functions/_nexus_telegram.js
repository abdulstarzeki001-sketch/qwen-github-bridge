// STAR NEXUS · Telegram webhook adapter.
// No Telegram user can reach privileged GitHub, scanner, filesystem or owner settings routes.
import { wormgptConfigured, wormgptChat } from "./_wormgpt.js";
import { parseCodingCommand, describeCodingSkills, skillRequest, telegramModelLabel, fetchStarSource, sourceRequest, compareArgs, compareSourceRequest, inspectJsonStructure } from "./_wormgpt_coding_skills.js";

const json=(payload,status=200)=>Response.json(payload,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const maxIncomingBytes=16*1024;
const modelPrompt="You are STAR NEXUS, a precise AI assistant. Respond in the language of the user. Use evidence where applicable, distinguish hypotheses from facts, and never claim actions or execution you did not perform. No tool or repository permissions are available in Telegram.";

export function telegramConfigured(env){
 const ids=String(env.TELEGRAM_ALLOWED_CHAT_IDS||"").split(",").map(s=>s.trim()).filter(x=>/^-?[0-9]{5,20}$/.test(x));
 return Boolean(typeof env.TELEGRAM_BOT_TOKEN==="string"&&/^[0-9]+:[A-Za-z0-9_-]{30,}$/.test(env.TELEGRAM_BOT_TOKEN)&&
 typeof env.TELEGRAM_WEBHOOK_SECRET==="string"&&/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)&&ids.length>0);
}
async function constantTimeSecret(expected,received){
 if(typeof expected!=="string"||typeof received!=="string"||expected.length<32||received.length<32)return false;
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(expected)),crypto.subtle.digest("SHA-256",enc.encode(received))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
function redactPrompt(text){
 return text.replace(/^(Authorization|Cookie|X-API-Key):\s*.+$/gim,"$1: [REDACTED]")
  .replace(/\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g,"[REDACTED]");
}
function normalizeModelResponse(data){
 const raw=data?.choices?.[0]?.message?.content;
 if(typeof raw==="string")return raw.trim();
 if(Array.isArray(raw))return raw.filter(v=>v&&typeof v.text==="string").map(v=>v.text).join("\n").trim();
 return "";
}
async function infer(env,prompt,{maxTokens=512,system=modelPrompt}={}){
 const provider=String(env.STAR_AI_PROVIDER|| (env.AI?"cloudflare":"openrouter"));
 const messages=[{role:"system",content:system},{role:"user",content:redactPrompt(prompt)}];
 if(provider==="cloudflare"){
  if(!env.AI)throw Error("Workers AI binding is missing");
  const result=await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8",{messages,max_tokens:Math.min(768,Math.max(32,maxTokens))});
  if(typeof result?.response!=="string"||!result.response.trim())throw Error("Cloudflare AI returned no message");
  return result.response.trim();
 }
 if(provider==="wormgpt"){
  if(!wormgptConfigured(env))throw Error("WormGPT backend missing");
  const result=await wormgptChat(env,{system,maxTokens:Math.min(800,maxTokens),temperature:0.2,modelOverride:""},redactPrompt(prompt));
  return result.content;
 }
 let endpoint="",token="",model="";
 if(provider==="selfhosted"){
  endpoint=String(env.STAR_SELFHOSTED_URL||"");
  token=String(env.STAR_SELFHOSTED_TOKEN||"");
  model=String(env.STAR_SELFHOSTED_MODEL||"");
  const url=new URL(endpoint);
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||
    !["/chat/completions","/v1/chat/completions"].includes(url.pathname))throw Error("Self-hosted endpoint invalid");
 } else if(provider==="openai"){
  endpoint="https://api.openai.com/v1/chat/completions";token=String(env.OPENAI_API_KEY||"");model=String(env.STAR_OPENAI_MODEL||"gpt-4.1");
 } else if(provider==="openrouter"){
  endpoint="https://openrouter.ai/api/v1/chat/completions";token=String(env.OPENROUTER_API_KEY||"");model=String(env.STAR_CLOUDFLARE_MODEL||"nvidia/nemotron-3-ultra-550b-a55b:free");
 } else if(provider==="anthropic"){
  if(!env.ANTHROPIC_API_KEY)throw Error("Anthropic not configured");
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"x-api-key":env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
    body:JSON.stringify({model:env.STAR_ANTHROPIC_MODEL||"claude-sonnet-5-5",max_tokens:Math.min(800,maxTokens),system,messages:[{role:"user",content:redactPrompt(prompt)}]}),
    signal:AbortSignal.timeout(25000)
  });
  if(!r.ok)throw Error("Model gateway failure");const data=await r.json();
  const content=Array.isArray(data.content)?data.content.filter(x=>x?.type==="text").map(x=>x.text).join("\n").trim():"";
  if(!content)throw Error("No provider text");
  return content;
 } else throw Error("Unsupported provider");
 if(token.length<10||!model)throw Error("Model backend not configured");
 const upstream=await fetch(endpoint,{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({model,max_tokens:Math.min(800,maxTokens),temperature:0.2,messages}),signal:AbortSignal.timeout(provider==="selfhosted"?90000:25000)
 });
 if(!upstream.ok)throw Error("AI backend returned "+upstream.status);
 const content=normalizeModelResponse(await upstream.json());
 if(!content)throw Error("No provider text");
 return content;
}
// Test an actual Cloudflare binding completion through signed deployment identity only.
// Return no model output, prompts, tokens or provider errors to the client.
export async function probeTelegramAi(env){
 const provider=String(env.STAR_AI_PROVIDER||(env.AI?"cloudflare":"openrouter"));
 if(provider!=="cloudflare")return {ok:false,provider,reason:"Telegram is configured for a non-Cloudflare provider"};
 if(!env.AI)return {ok:false,provider,reason:"Workers AI binding missing"};
 try{
  const answer=await infer(env,"Say one short greeting in Arabic.",{maxTokens:64});
  return {ok:typeof answer==="string"&&answer.trim().length>0,
    provider,model:"@cf/meta/llama-3.1-8b-instruct-fp8",responded:answer.trim().length>0};
 }catch{
  return {ok:false,provider,model:"@cf/meta/llama-3.1-8b-instruct-fp8",reason:"Cloudflare Workers AI inference failed"};
 }
}
async function sendMessage(env,chatId,text){
 const chunks=String(text||"").match(/[\s\S]{1,3400}/g)||[""];
 for(const chunk of chunks.slice(0,3)){
  const r=await fetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/sendMessage",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({chat_id:chatId,text:chunk,disable_web_page_preview:true}),
   signal:AbortSignal.timeout(15000)
  });
  if(!r.ok)throw Error("Telegram sendMessage failed: "+r.status);
 }
}
async function processUpdate(env,chatId,text){
 try{
  const command=parseCodingCommand(text);
  if(command?.type==="other-bot")return;
  if(command?.type==="start"){
   await sendMessage(env,chatId,"STAR NEXUS جاهز ✅\nللمهام البرمجية المستوحاة من WormGPTv2 أرسل /skills.\nوللمحادثة العادية اكتب سؤالك مباشرة.\nالمهارات لا تنفّذ أوامر النظام ولا تعدّل GitHub.");
   return;
  }
  if(command?.type==="help"||command?.type==="skills"){
   await sendMessage(env,chatId,describeCodingSkills());
   return;
  }
  if(command?.type==="model"||command?.type==="status"){
   await sendMessage(env,chatId,telegramModelLabel(env));
   return;
  }
  if(command?.type==="unknown"){
   await sendMessage(env,chatId,"الأمر /"+command.command+" غير معروف.\nأرسل /skills لعرض المهارات.");
   return;
  }
  if(command?.type==="json"){
   const data=inspectJsonStructure(command.argument);
   await sendMessage(env,chatId,data.report||data.error);
   return;
  }
  if(command?.type==="compare"){
   const paths=compareArgs(command.argument);
   if(!paths){
    await sendMessage(env,chatId,"استعمل مساري ملفين مختلفين من مستودع STAR العام.\nمثال: /compare functions/_nexus_telegram.js functions/_wormgpt_coding_skills.js");
    return;
   }
   const files=await Promise.all(paths.map(path=>fetchStarSource(path)));
   const failed=files.find(file=>file.error);
   if(failed){await sendMessage(env,chatId,failed.error);return}
   const req=compareSourceRequest(files[0],files[1]);
   const answer=await infer(env,req.prompt,{system:req.system,maxTokens:req.maxTokens});
   await sendMessage(env,chatId,"مقارنة مصدرين عامين (قراءة فقط):\n"+paths.join(" ⇄ ")+"\n\n"+answer);
   return;
  }
  if(command?.type==="repo"){
   if(!command.argument){
    await sendMessage(env,chatId,"مثال: /repo functions/_nexus_telegram.js\nالقراءة من ملفات STAR العامة على GitHub فقط.");
    return;
   }
   const file=await fetchStarSource(command.argument);
   if(file.error){await sendMessage(env,chatId,file.error);return;}
   const req=sourceRequest(file);
   const answer=await infer(env,req.prompt,{system:req.system,maxTokens:req.maxTokens});
   await sendMessage(env,chatId,"تحليل ملف STAR (قراءة فقط): "+file.path+
    (file.truncated?"\nملاحظة: تحليل جزء من الملف فقط.":"")+"\n\n"+answer);
   return;
  }
  if(command?.type==="skill"){
   const req=skillRequest(command);
   if(req?.missing){await sendMessage(env,chatId,req.missing);return;}
   const answer=await infer(env,req.prompt,{system:req.system,maxTokens:req.maxTokens});
   await sendMessage(env,chatId,"["+command.command+"]\n"+answer);
   return;
  }
  const result=await infer(env,text);
  await sendMessage(env,chatId,result);
 }catch{
  // No prompts, chat IDs, model content or credentials in logs.
  try{await sendMessage(env,chatId,"تعذّر استلام رد من النموذج حالياً. تحقق من إعدادات مزود STAR ثم حاول مجدداً.");}catch{}
 }
}
export async function handleTelegramWebhook(request,env,ctx){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!telegramConfigured(env))return json({error:"Telegram channel is not configured"},503);
 if(!(await constantTimeSecret(env.TELEGRAM_WEBHOOK_SECRET,request.headers.get("X-Telegram-Bot-Api-Secret-Token")||"")))
  return json({error:"Unauthorized"},401);
 if(Number(request.headers.get("content-length")||"0")>maxIncomingBytes)return json({error:"Payload too large"},413);
 const buffer=await request.arrayBuffer();
 if(buffer.byteLength>maxIncomingBytes)return json({error:"Payload too large"},413);
 let payload;
 try{payload=JSON.parse(new TextDecoder().decode(buffer));}catch{return json({error:"Invalid Telegram payload"},400);}
 const message=payload?.message;
 if(!message||message.chat?.type!=="private"||!Number.isSafeInteger(message.chat.id))return json({ok:true,ignored:true});
 const chatId=String(message.chat.id);
 const allowed=new Set(env.TELEGRAM_ALLOWED_CHAT_IDS.split(",").map(x=>x.trim()));
 if(!allowed.has(chatId))return json({ok:true,ignored:true});
 const text=typeof message.text==="string"?message.text.trim():"";
 if(!text||text.length>2000)return json({ok:true,ignored:true});
 const task=processUpdate(env,chatId,text);
 if(ctx?.waitUntil){ctx.waitUntil(task);return json({ok:true});}
 await task;return json({ok:true});
}
