// STAR independent GPU endpoint verifier.
// Never prints bearer secrets or generated chat content. Works with RunPod HTTPS
// proxy URLs and private Cloudflare Tunnel HTTPS hostnames.
import {pathToFileURL} from "node:url";

function checkedUrl(raw,allowLoopback){
  const url=new URL(raw);
  const loopback=allowLoopback&&url.protocol==="http:"&&
    ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if(url.protocol!=="https:"&&!loopback)throw Error("Gateway endpoint must use HTTPS");
  if(url.username||url.password||url.hash||url.search)throw Error("Endpoint cannot contain credentials or query parameters");
  if(!["/chat/completions","/v1/chat/completions"].includes(url.pathname))
    throw Error("Endpoint must end with /chat/completions");
  if(url.hostname.length>253)throw Error("Invalid gateway hostname");
  return url;
}
async function fetchSafe(fetcher,url,options,timeoutMs){
  const result=await fetcher(url.toString(),{...options,signal:AbortSignal.timeout(timeoutMs)});
  return result;
}
export async function verifyRunpod({endpoint,token,healthOnly=false,allowLoopback=false,fetcher=fetch,timeoutMs=90000}){
  if(typeof token!=="string"||token.length<32||token.length>256)
    throw Error("STAR_BACKEND_TOKEN must contain 32–256 characters");
  if(typeof endpoint!=="string"||!endpoint)throw Error("STAR_RUNPOD_ENDPOINT is required");
  const url=checkedUrl(endpoint,allowLoopback);
  const healthUrl=new URL(url);
  healthUrl.pathname="/health";
  const probeTimeout=Math.min(timeoutMs,12000);
  // Check that gateway does not leak its health details to unauthenticated callers.
  const anonymous=await fetchSafe(fetcher,healthUrl,{method:"GET"},probeTimeout);
  if(anonymous.status!==401)throw Error("Unauthenticated gateway health did not return HTTP 401");
  const authHeader={"Authorization":"Bearer "+token};
  const healthResponse=await fetchSafe(fetcher,healthUrl,{method:"GET",headers:authHeader},probeTimeout);
  if(!healthResponse.ok)throw Error("Authenticated gateway health returned HTTP "+healthResponse.status);
  const health=await healthResponse.json();
  if(health?.ok!==true||health?.access!=="authenticated"||
     typeof health.model!=="string"||!/^[A-Za-z0-9._:/-]{3,120}$/.test(health.model))
    throw Error("Gateway health returned unexpected payload");
  const models=Array.isArray(health.models)?health.models:[health.model];
  if(!models.includes(health.model))throw Error("Default model is not in gateway allowed models");
  const safeList=models.filter(x=>typeof x==="string"&&/^[A-Za-z0-9._:/-]{3,120}$/.test(x)).slice(0,12);
  if(safeList.length!==models.length||new Set(safeList).size!==safeList.length)
    throw Error("Gateway returned an invalid model list");
  if(healthOnly)return {ok:true,authenticated:true,inference_checked:false,model:health.model,models:safeList};
  // Short, bounded end-to-end real inference request, not a fake model status check.
  const chat=await fetchSafe(fetcher,url,{
    method:"POST",
    headers:{...authHeader,"Content-Type":"application/json"},
    body:JSON.stringify({model:health.model,messages:[{role:"user",content:"Say a short greeting."}],max_tokens:64,temperature:0})
  },timeoutMs);
  if(!chat.ok)throw Error("Inference request returned HTTP "+chat.status);
  const reply=await chat.json();
  if(typeof reply?.choices?.[0]?.message?.content!=="string"||
     !reply.choices[0].message.content.trim())
    throw Error("Inference returned an empty or invalid response");
  return {ok:true,authenticated:true,inference_checked:true,model:health.model,models:safeList};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const endpoint=process.env.STAR_RUNPOD_ENDPOINT||"";
  const token=process.env.STAR_BACKEND_TOKEN||"";
  const healthOnly=process.argv.includes("--health-only");
  try{
    const result=await verifyRunpod({endpoint,token,healthOnly});
    console.log("STAR gateway verified:",JSON.stringify(result));
  }catch(e){
    // Do not output private endpoints, tokens or provider bodies.
    console.error("STAR gateway verification failed:",e.message);
    process.exitCode=1;
  }
}
