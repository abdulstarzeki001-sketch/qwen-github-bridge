import { makeGithubHandler } from "../_github.js";

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
function corsless(req){return req.headers.get("origin") && new URL(req.headers.get("origin")).host!==new URL(req.url).host;}
export async function onRequest({request,env}){
  const path=new URL(request.url).pathname;
  if(corsless(request))return json({error:"Cross-origin requests are not allowed"},403);
  if(path==="/api/health" && request.method==="GET"){
    return json({ok:true,version:"0.6.0",runtime:"cloudflare",ai_gateway:Boolean(env.OPENROUTER_API_KEY),
      ai_model:env.STAR_CLOUDFLARE_MODEL||"openrouter/free",full_backend:false});
  }
  if((path==="/api/github/status"||path==="/api/github/browse")&&request.method==="GET")
    return makeGithubHandler(env)(request);
  if(path!=="/api/chat"||request.method!=="POST")return json({error:"Not found"},404);
  const expected=env.STAR_API_TOKEN||"";
  if(expected.length<32 || request.headers.get("authorization")!=="Bearer "+expected)
    return json({error:"Unauthorized"},401);
  if(!env.OPENROUTER_API_KEY)return json({error:"Set OPENROUTER_API_KEY in Cloudflare Pages secrets"},503);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  if(env.STAR_RATE_LIMIT){
    const id=new URL("https://rate.local/"+encodeURIComponent(ip));
    const limited=await env.STAR_RATE_LIMIT.fetch(new Request(id,{method:"POST"}));
    if(limited.status===429)return json({error:"Rate limit exceeded"},429);
  }
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";
  if(!prompt||prompt.length>16000)return json({error:"Prompt must contain 1-16000 characters"},400);
  try{
    const model=env.STAR_CLOUDFLARE_MODEL||"openrouter/free";
    const upstream=await fetch("https://openrouter.ai/api/v1/chat/completions",{
      method:"POST",headers:{"Authorization":"Bearer "+env.OPENROUTER_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,max_tokens:1400,temperature:0.15,messages:[
        {role:"system",content:"You are STAR CYBER AI X, an engineering and defensive cybersecurity assistant. Answer in the user's language. Never claim to have executed actions you did not execute."},
        {role:"user",content:prompt}
      ]}),signal:AbortSignal.timeout(25000)
    });
    if(!upstream.ok){console.error("AI upstream status",upstream.status);return json({error:"AI provider unavailable"},502)}
    const result=await upstream.json();
    const raw=result?.choices?.[0]?.message?.content;
    const content=typeof raw==="string"?raw:Array.isArray(raw)?raw.map(x=>x?.text||"").join("\n"):"";
    if(!content)return json({error:"AI provider returned no content"},502);
    return json({ok:true,model:result.model||model,content});
  }catch(error){console.error("AI request error",error.message);return json({error:"AI request failed"},502)}
}
