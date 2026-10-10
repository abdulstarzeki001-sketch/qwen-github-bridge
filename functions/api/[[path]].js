import { ownerPolicy } from "../_owner_policy.js";
import { makeGithubHandler } from "../_github.js";

const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
function corsless(req){return req.headers.get("origin") && new URL(req.headers.get("origin")).host!==new URL(req.url).host;}
export async function onRequest({request,env}){
  const path=new URL(request.url).pathname;
  const policy=ownerPolicy(env);
  if(corsless(request))return json({error:"Cross-origin requests are not allowed"},403);
  if(path==="/api/health" && request.method==="GET"){
    return json({ok:true,version:"0.6.0",runtime:"cloudflare",ai_gateway:env.STAR_AI_PROVIDER==="cloudflare"?Boolean(env.AI):env.STAR_AI_PROVIDER==="selfhosted"?Boolean(env.STAR_SELFHOSTED_URL&&env.STAR_SELFHOSTED_TOKEN):Boolean(env.OPENROUTER_API_KEY||env.OPENAI_API_KEY),
      ai_model:env.STAR_AI_PROVIDER==="cloudflare"?"@cf/meta/llama-3.1-8b-instruct":env.STAR_AI_PROVIDER==="selfhosted"?(env.STAR_SELFHOSTED_MODEL||"qwen2.5-coder:7b"):env.STAR_AI_PROVIDER==="openai"?(env.STAR_OPENAI_MODEL||"gpt-4.1"):(env.STAR_CLOUDFLARE_MODEL||"nvidia/nemotron-3-ultra-550b-a55b:free"),full_backend:false});
  }
  if((path==="/api/github/status"||path==="/api/github/browse")&&request.method==="GET")
    return policy.allowGithubRead?makeGithubHandler(env)(request):json({error:"GitHub reading disabled by owner"},403);
  if(path!=="/api/chat"||request.method!=="POST")return json({error:"Not found"},404);
  const expected=env.STAR_API_TOKEN||"";
  if(expected.length<32 || request.headers.get("authorization")!=="Bearer "+expected)
    return json({error:"Unauthorized"},401);
  const useCloudflare=env.STAR_AI_PROVIDER==="cloudflare";
  const useOpenAI=env.STAR_AI_PROVIDER==="openai";
  if(useCloudflare&&!env.AI)return json({error:"Cloudflare AI binding missing"},503);
  const selfHosted=env.STAR_AI_PROVIDER==="selfhosted";
  if(selfHosted&&(!env.STAR_SELFHOSTED_URL||!env.STAR_SELFHOSTED_TOKEN))return json({error:"Self-hosted backend not configured"},503);
  if(useOpenAI&&!env.OPENAI_API_KEY)return json({error:"Set OPENAI_API_KEY for OpenAI mode"},503);
  if(!useCloudflare&&!selfHosted&&!useOpenAI&&!env.OPENROUTER_API_KEY)return json({error:"Set OPENROUTER_API_KEY for free mode"},503);
  const ip=request.headers.get("cf-connecting-ip")||"unknown";
  if(env.STAR_RATE_LIMIT){
    const id=new URL("https://rate.local/"+encodeURIComponent(ip));
    const limited=await env.STAR_RATE_LIMIT.fetch(new Request(id,{method:"POST"}));
    if(limited.status===429)return json({error:"Rate limit exceeded"},429);
  }
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";
  if(!prompt||prompt.length>policy.maxPromptChars)return json({error:"Prompt exceeds configured length limit"},400);
  try{
    if(useCloudflare){
      const model="@cf/meta/llama-3.1-8b-instruct";
      const result=await env.AI.run(model,{messages:[{role:"system",content:policy.identity+". "+policy.instructions},{role:"user",content:prompt}],max_tokens:1024});
      const content=typeof result?.response==="string"?result.response:"";
      if(!content)return json({error:"Cloudflare AI returned no content"},502);
      return json({ok:true,model,content});
    }
    const model=selfHosted?(env.STAR_SELFHOSTED_MODEL||"qwen2.5-coder:7b"):useOpenAI?(env.STAR_OPENAI_MODEL||"gpt-4.1"):(env.STAR_CLOUDFLARE_MODEL||"nvidia/nemotron-3-ultra-550b-a55b:free");
    let endpoint=selfHosted?env.STAR_SELFHOSTED_URL:useOpenAI?"https://api.openai.com/v1/chat/completions":"https://openrouter.ai/api/v1/chat/completions";
    if(selfHosted){const url=new URL(endpoint);if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||!url.pathname.endsWith("/chat/completions"))return json({error:"Invalid self-hosted endpoint"},503);endpoint=url.toString()}
    const upstream=await fetch(endpoint,{
      method:"POST",headers:{"Authorization":"Bearer "+(selfHosted?env.STAR_SELFHOSTED_TOKEN:useOpenAI?env.OPENAI_API_KEY:env.OPENROUTER_API_KEY),"Content-Type":"application/json"},
      body:JSON.stringify({model,max_tokens:1400,temperature:0.15,messages:[
        {role:"system",content:policy.identity+". "+policy.instructions+" Answer in the user\'s language. Never claim to have executed actions you did not execute."},
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
