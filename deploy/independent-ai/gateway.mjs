// STAR private GPU gateway: accepts only owner-server bearer-authenticated chat.
// Internal Ollama is never directly published to the Internet.
// No request body, chat prompts, or bearer tokens are written to logs.
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const JSON_HEADERS={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
};
function respond(res,code,body){
  res.writeHead(code,JSON_HEADERS);
  res.end(JSON.stringify(body));
}
function compareToken(expected,supplied){
  if(typeof supplied!=="string"||!supplied||supplied.length>512)return false;
  const h=s=>createHash("sha256").update(s).digest();
  return timingSafeEqual(h(expected),h(supplied));
}
function cleanRequest(body,model,allowedModels){
  if(!body||typeof body!=="object"||Array.isArray(body))return null;
  if(typeof body.model!=="string"||!allowedModels.includes(body.model))return null;
  const messages=body.messages;
  if(!Array.isArray(messages)||messages.length<1||messages.length>12)return null;
  let length=0;
  for(const msg of messages){
    if(!msg||typeof msg!=="object"||!["system","user","assistant"].includes(msg.role)||typeof msg.content!=="string"||msg.content.length>16000)return null;
    length+=msg.content.length;
  }
  if(length>55000)return null;
  const tokens=body.max_tokens===undefined?1400:Number(body.max_tokens);
  const temperature=body.temperature===undefined?0.15:Number(body.temperature);
  if(!Number.isInteger(tokens)||tokens<1||tokens>4096||!Number.isFinite(temperature)||temperature<0||temperature>1)return null;
  return {model:body.model,messages:messages.map(m=>({role:m.role,content:m.content})),max_tokens:tokens,temperature,stream:false};
}
export function createGateway({token,model="gpt-oss:20b",allowedModels=[model],endpoint="http://ollama:11434/v1/chat/completions",interpreterEndpoint="",upstreamFetch=globalThis.fetch}={}){
  if(typeof token!=="string"||token.length<32||token.length>256)throw Error("STAR_BACKEND_TOKEN must contain 32 to 256 random characters");
  if(!/^[A-Za-z0-9._:/-]{3,120}$/.test(model))throw Error("Invalid STAR_MODEL");
  if(interpreterEndpoint&&interpreterEndpoint!=="http://interpreter-web:8090/execute")throw Error("Invalid Open Interpreter endpoint");
  if(!Array.isArray(allowedModels)||allowedModels.length<1||allowedModels.length>12||
    allowedModels.some(item=>typeof item!=="string"||!/^[A-Za-z0-9._:/-]{3,120}$/.test(item))||
    !allowedModels.includes(model)||new Set(allowedModels).size!==allowedModels.length)
    throw Error("Invalid STAR_ALLOWED_MODELS list; must include STAR_MODEL");
  if(!["http://ollama:11434/v1/chat/completions","http://127.0.0.1:11434/v1/chat/completions"].includes(endpoint))throw Error("Upstream must remain the private Ollama service");
  return http.createServer(async(req,res)=>{
    const header=req.headers.authorization||"";
    const supplied=header.startsWith("Bearer ")?header.slice(7).trim():"";
    if(!compareToken(token,supplied))return respond(res,401,{error:"Unauthorized"});
    if(req.url==="/health"&&req.method==="GET")return respond(res,200,{ok:true,model,models:allowedModels,access:"authenticated"});
    if(req.url==="/interpreter/health"&&req.method==="GET"){
      if(!interpreterEndpoint)return respond(res,503,{ok:false,error:"Open Interpreter is not enabled"});
      try{const r=await upstreamFetch(interpreterEndpoint.replace("/execute","/health"),{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(5000)});const d=await r.json();return respond(res,r.ok?200:502,r.ok?d:{ok:false,error:"Open Interpreter unavailable"})}
      catch{return respond(res,502,{ok:false,error:"Open Interpreter unavailable"})}
    }
    if(req.url==="/interpreter/execute"&&req.method==="POST"){
      if(!interpreterEndpoint)return respond(res,503,{error:"Open Interpreter is not enabled"});
      if(!(req.headers["content-type"]||"").startsWith("application/json"))return respond(res,415,{error:"JSON required"});
      let size=0,chunks=[];
      try{for await(const chunk of req){size+=chunk.length;if(size>5000)return respond(res,413,{error:"Task too large"});chunks.push(chunk)}
        const body=JSON.parse(Buffer.concat(chunks).toString("utf8")),prompt=typeof body?.prompt==="string"?body.prompt.trim():"";
        if(!prompt||prompt.length>2500)return respond(res,400,{error:"Task must be 1–2500 characters"});
        const r=await upstreamFetch(interpreterEndpoint,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({prompt}),signal:AbortSignal.timeout(88000)});
        const d=await r.json().catch(()=>({}));if(!r.ok)return respond(res,r.status===429?429:502,{error:r.status===429?"Open Interpreter is busy":d?.error||"Open Interpreter execution failed"});
        if(typeof d?.result!=="string"||!d.result.trim())return respond(res,502,{error:"Open Interpreter returned no result"});
        return respond(res,200,{ok:true,result:d.result.slice(0,60000),model:d.model||"Open Interpreter"});
      }catch(error){console.error("STAR Open Interpreter proxy error",error?.name||"unknown");return respond(res,502,{error:"Open Interpreter execution failed"})}
    }
    if(req.url!=="/chat/completions"||req.method!=="POST")return respond(res,404,{error:"Not found"});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"]||""))return respond(res,415,{error:"JSON required"});
    let size=0,chunks=[];
    try{
      for await(const chunk of req){
        size+=chunk.length;
        if(size>100000)return respond(res,413,{error:"Payload too large"});
        chunks.push(chunk);
      }
      const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const payload=cleanRequest(body,model,allowedModels);
      if(!payload)return respond(res,400,{error:"Invalid model or chat request"});
      const remote=await upstreamFetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(85000)
      });
      if(!remote.ok){
        console.error("STAR private inference upstream status",remote.status);
        return respond(res,502,{error:"Model backend unavailable"});
      }
      const result=await remote.json();
      const content=result?.choices?.[0]?.message?.content;
      if(typeof content!=="string"||!content.trim())return respond(res,502,{error:"No model response"});
      return respond(res,200,{model:result.model||model,choices:[{index:0,message:{role:"assistant",content},finish_reason:"stop"}]});
    }catch(error){
      // No secrets, input messages, or full stack traces are logged.
      console.error("STAR private gateway error",error?.name||"unknown");
      return respond(res,502,{error:"Model request failed"});
    }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid PORT");
  const model=process.env.STAR_MODEL||"gpt-oss:20b";
  const extra=(process.env.STAR_ALLOWED_MODELS||model).split(",").map(x=>x.trim()).filter(Boolean);
  const server=createGateway({token:process.env.STAR_BACKEND_TOKEN,model,allowedModels:extra,
    endpoint:process.env.OLLAMA_ENDPOINT||"http://ollama:11434/v1/chat/completions",
    interpreterEndpoint:process.env.INTERPRETER_ENDPOINT||""});
  server.listen(port,"0.0.0.0",()=>console.log("STAR authenticated inference gateway started on internal port "+port));
}
