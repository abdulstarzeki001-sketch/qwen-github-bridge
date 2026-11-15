// STAR GPU Pod provisioning via current RunPod REST API v2.
// `plan` is free/offline; `create --confirm-paid` is the sole billable operation.
// Never send the RunPod API key to GitHub or frontend JavaScript.
import {pathToFileURL} from "node:url";

const BASE="https://api.runpod.io/v2";
const DEFAULT_IMAGE="ghcr.io/abdulstarzeki001-sketch/star-independent-ai:latest";
const MODEL_PATTERN=/^[A-Za-z0-9._:/-]{3,120}$/;
const ID_PATTERN=/^[a-z0-9][a-z0-9-]{3,70}$/i;
function integerBetween(raw,min,max,name){
  const value=Number(raw);
  if(!Number.isInteger(value)||value<min||value>max)throw Error(name+" must be "+min+"-"+max);
  return value;
}
export function buildPodPlan(config={}){
  const image=config.image||DEFAULT_IMAGE;
  const gpuId=config.gpuId||"NVIDIA GeForce RTX 4090";
  const name=config.name||"star-nexus-independent-ai";
  const model=config.model||"qwen2.5-coder:7b";
  const allowed=(config.allowedModels||model).split(",").map(s=>s.trim());
  if(typeof image!=="string"||!/^ghcr\.io\/[a-z0-9._-]+\/[a-z0-9._-]+:(?:latest|sha-[a-f0-9]{40})$/.test(image))
    throw Error("Image must be a known GHCR-tagged STAR image");
  if(typeof gpuId!=="string"||!/^[A-Za-z0-9 .+-]{5,90}$/.test(gpuId))throw Error("Invalid GPU type");
  if(typeof name!=="string"||!/^[a-z0-9][a-z0-9-]{2,48}$/.test(name))throw Error("Invalid Pod name");
  if(!MODEL_PATTERN.test(model)||allowed.length<1||allowed.length>12||allowed.some(m=>!MODEL_PATTERN.test(m))||
      new Set(allowed).size!==allowed.length||!allowed.includes(model))throw Error("Invalid model allowlist");
  const disk=integerBetween(config.disk??30,20,500,"Container disk");
  const volume=integerBetween(config.volume??60,40,1000,"Persistent volume");
  const registryId=config.registryId||undefined;
  if(registryId&&!/^[a-zA-Z0-9_-]{4,120}$/.test(registryId))throw Error("Invalid private registry credential ID");
  return {
    name,image,cloud:"SECURE",gpu:{id:gpuId,count:1},disk,
    ports:["8080/http"],mounts:{persistent:{size:volume,path:"/workspace"}},
    ...(registryId?{registry:registryId}:{}),
    env:{
      STAR_MODEL:model,STAR_ALLOWED_MODELS:allowed.join(","),
      STAR_BACKEND_TOKEN:"REDACTED_FROM_PLAN"
    }
  };
}
export async function runpodApi(method,path,{key,fetcher=fetch,body}={}){
  if(!["GET","POST"].includes(method))throw Error("Unsupported RunPod action");
  if(!/^\/pods(?:\/[A-Za-z0-9_-]+)?$/.test(path))throw Error("Invalid RunPod API path");
  if(typeof key!=="string"||key.length<24)throw Error("RUNPOD_API_KEY is missing or invalid");
  const response=await fetcher(BASE+path,{
    method,headers:{Authorization:"Bearer "+key,...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(35000)
  });
  // Do not emit arbitrary upstream bodies; they can include Pod environment secrets.
  if(!response.ok)throw Error("RunPod API "+method+" "+path+" returned HTTP "+response.status+
    (response.status===402?" (account funding required)":""));
  return response.json();
}
export async function executeRunpodAction(action,{
  key,backendToken,config={},podId,confirmPaid=false,fetcher=fetch
}={}){
  if(action==="plan"){
    const plan=buildPodPlan(config);
    return {mode:"plan",will_charge:false,request:plan,
      note:"No paid Pod was created. RunPod account billing and GPU stock must be checked before confirming."};
  }
  if(action==="list"){
    const data=await runpodApi("GET","/pods",{key,fetcher});
    const pods=Array.isArray(data)?data:Array.isArray(data.pods)?data.pods:[];
    return {mode:"list",pods:pods.map(p=>({id:p.id,status:p.status||null,
      name:p.name||null,image:p.image||null,cost:p.cost??null}))};
  }
  if(action==="inspect"){
    if(typeof podId!=="string"||!ID_PATTERN.test(podId))throw Error("Invalid pod ID");
    const p=await runpodApi("GET","/pods/"+podId,{key,fetcher});
    return {mode:"inspect",pod:{id:p.id,status:p.status||null,name:p.name||null,
      image:p.image||null,cost:p.cost??null}};
  }
  if(action==="create"){
    if(!confirmPaid)throw Error("Paid Pod creation requires --confirm-paid");
    if(typeof backendToken!=="string"||backendToken.length<32||backendToken.length>256)
      throw Error("STAR_BACKEND_TOKEN must have 32-256 characters");
    const plan=buildPodPlan(config);
    const input={...plan,env:{...plan.env,STAR_BACKEND_TOKEN:backendToken}};
    const result=await runpodApi("POST","/pods",{key,fetcher,body:input});
    if(typeof result?.id!=="string"||!ID_PATTERN.test(result.id))
      throw Error("RunPod returned a Pod without valid ID. Inspect the RunPod console; never blindly retry create.");
    return {mode:"create",pod:{id:result.id,status:result.status||"PROVISIONING",
      name:result.name||plan.name,cost:result.cost??null},
      endpoint:"https://"+result.id+"-8080.proxy.runpod.net/chat/completions",
      note:"Pod was requested. Charges may be accruing. Verify model boot and secret authentication before setting Cloudflare."};
  }
  throw Error("Usage: plan | list | inspect --pod-id ID | create --confirm-paid");
}
function parseArgs(argv){
  const action=argv[0]||"plan";
  const opts={};
  for(let i=1;i<argv.length;i++){
    const token=argv[i];
    if(token==="--confirm-paid"){opts.confirmPaid=true;continue}
    const map={"--gpu":"gpuId","--image":"image","--model":"model",
      "--models":"allowedModels","--disk":"disk","--volume":"volume",
      "--pod-id":"podId","--name":"name","--registry-id":"registryId"};
    if(!map[token]||i+1>=argv.length)throw Error("Unknown or missing argument "+token);
    opts[map[token]]=argv[++i];
  }
  return {action,opts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const {action,opts}=parseArgs(process.argv.slice(2));
    const {podId,confirmPaid,...config}=opts;
    const result=await executeRunpodAction(action,{key:process.env.RUNPOD_API_KEY,
      backendToken:process.env.STAR_BACKEND_TOKEN,podId,confirmPaid,config});
    console.log(JSON.stringify(result,null,2));
  }catch(e){
    console.error("STAR RunPod:",e.message);
    process.exitCode=1;
  }
}
