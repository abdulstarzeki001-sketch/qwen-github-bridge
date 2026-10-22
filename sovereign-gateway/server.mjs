// STAR SOVEREIGN inference gateway — stdlib-only Node.js service.
// Listens on loopback by default; the remote STAR Pages function must reach it
// through an authenticated, HTTPS tunnel. Never expose a raw Ollama port.
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const MAX_REQUEST_BYTES=128*1024;
const MAX_RESPONSE_BYTES=1024*1024;
function send(res,status,payload){
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
  res.end(JSON.stringify(payload));
}
function authorized(given,secret){
  if(!given.startsWith("Bearer "))return false;
  const token=given.slice(7).trim();
  if(token.length<32||secret.length<32)return false;
  const a=createHash("sha256").update(token).digest(),b=createHash("sha256").update(secret).digest();
  return timingSafeEqual(a,b);
}
function jsonBody(req){
  return (async()=>{
    let size=0;const chunks=[];
    for await(const chunk of req){
      size+=chunk.length;
      if(size>MAX_REQUEST_BYTES)throw Object.assign(new Error("Request too large"),{status:413});
      chunks.push(chunk);
    }
    try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}
    catch{throw Object.assign(new Error("Invalid JSON"),{status:400})}
  })();
}
export function validateConfig(env){
  const token=String(env.SOVEREIGN_GATEWAY_TOKEN||"");
  const models=String(env.SOVEREIGN_ALLOWED_MODELS||"").split(",").map(x=>x.trim()).filter(Boolean);
  const base=String(env.SOVEREIGN_OLLAMA_URL||"http://127.0.0.1:11434/v1/chat/completions");
  const url=new URL(base);
  if(token.length<32)throw Error("SOVEREIGN_GATEWAY_TOKEN must be 32+ characters");
  if(!models.length||models.some(x=>x.length>160))throw Error("SOVEREIGN_ALLOWED_MODELS must specify at least one permitted model");
  if(url.protocol!=="http:"||!["127.0.0.1","localhost","[::1]"].includes(url.hostname)||url.pathname!=="/v1/chat/completions"||url.search||url.hash||url.username||url.password)
    throw Error("Ollama upstream must use a loopback OpenAI-compatible endpoint");
  const parallel=Number(env.SOVEREIGN_MAX_CONCURRENT||"2");
  if(!Number.isInteger(parallel)||parallel<1||parallel>16)throw Error("Invalid gateway concurrency setting");
  return {token,models,url:url.toString(),maxConcurrent:parallel};
}
export function createGateway(env,upstreamFetch=fetch){
 const config=validateConfig(env);
 let active=0;
 return createServer(async(req,res)=>{
  if(!authorized(req.headers.authorization||"",config.token))return send(res,401,{error:"Unauthorized"});
  const path=new URL(req.url||"/","http://localhost").pathname;
  if(req.method==="GET"&&path==="/health")return send(res,200,{ok:true,engine:"ollama",models:config.models,active});
  if(req.method!=="POST"||path!=="/v1/chat/completions")return send(res,404,{error:"Not found"});
  if(active>=config.maxConcurrent)return send(res,429,{error:"Gateway busy; retry later"});
  const length=Number(req.headers["content-length"]||"0");
  if(length>MAX_REQUEST_BYTES)return send(res,413,{error:"Request too large"});
  let body;
  try{body=await jsonBody(req)}
  catch(error){return send(res,error.status||400,{error:error.status===413?"Request too large":"Invalid JSON"})}
  const model=body?.model, messages=body?.messages;
  if(!config.models.includes(model))return send(res,400,{error:"Model is not allowlisted"});
  if(!Array.isArray(messages)||messages.length<1||messages.length>24)return send(res,400,{error:"Invalid messages"});
  let total=0;
  for(const msg of messages){
    if(!msg||!["system","user","assistant"].includes(msg.role)||typeof msg.content!=="string"||msg.content.length>20000)
      return send(res,400,{error:"Invalid message content"});
    total+=msg.content.length;
  }
  if(total>50000)return send(res,413,{error:"Conversation too large"});
  const temperature=body.temperature??0.15,max_tokens=body.max_tokens??1400;
  if(typeof temperature!=="number"||!Number.isFinite(temperature)||temperature<0||temperature>1||
    !Number.isInteger(max_tokens)||max_tokens<128||max_tokens>4096)
    return send(res,400,{error:"Invalid inference settings"});
  active++;
  try{
    const upstream=await upstreamFetch(config.url,{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({model,messages,temperature,max_tokens,stream:false}),
      signal:AbortSignal.timeout(115000)
    });
    if(!upstream.ok)return send(res,502,{error:"Local inference engine unavailable"});
    const size=Number(upstream.headers.get("content-length")||"0");
    if(size>MAX_RESPONSE_BYTES)return send(res,502,{error:"Local inference output exceeds limit"});
    const data=await upstream.text();
    if(Buffer.byteLength(data)>MAX_RESPONSE_BYTES)return send(res,502,{error:"Local inference output exceeds limit"});
    let parsed;try{parsed=JSON.parse(data)}catch{return send(res,502,{error:"Invalid local model response"})}
    if(typeof parsed?.choices?.[0]?.message?.content!=="string")
      return send(res,502,{error:"Unexpected local model response"});
    return send(res,200,parsed);
  }catch{return send(res,502,{error:"Local inference request failed"})}
  finally{active--}
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const server=createGateway(process.env);
  const port=Number(process.env.SOVEREIGN_GATEWAY_PORT||"7088");
  if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid gateway port");
  server.listen(port,"127.0.0.1",()=>console.log("SOVEREIGN gateway listening on 127.0.0.1:"+port));
}
