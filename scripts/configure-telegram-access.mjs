// Configure ONLY the two STAR Telegram Cloudflare Access exceptions.
// Access still authenticates all owner routes. These two Cloudflare-proxied URLs
// enforce Telegram's secret and GitHub's RS256 OIDC signature respectively.
import {pathToFileURL} from "node:url";

export const TELEGRAM_ACCESS_PATHS=Object.freeze([
  "/api/telegram/webhook",
  "/api/telegram/bootstrap"
]);
const DOMAIN="star-cyber-ai-x.pages.dev";
const API="https://api.cloudflare.com/client/v4/accounts/";

const expectedUrl=path=>DOMAIN+path;
const expectedApp=(path)=>({
  name:"STAR Telegram trusted machine endpoint: "+path,
  type:"self_hosted",
  domain:expectedUrl(path),
  session_duration:"24h",
  app_launcher_visible:false,
  policies:[{
    name:"Exact STAR Telegram endpoint - request signed in handler",
    decision:"bypass",
    include:[{everyone:{}}]
  }]
});

export async function setupTelegramAccess({
  accountId,apiToken,fetcher=fetch,dryRun=true
}={}){
  if(!/^[a-f0-9]{32}$/.test(accountId||""))throw Error("CLOUDFLARE_ACCOUNT_ID must be 32 lowercase hex characters");
  if(typeof apiToken!=="string"||apiToken.length<20)throw Error("Missing Cloudflare API token");
  const req=async(path,method="GET",body)=>{
    const response=await fetcher(API+accountId+"/access/apps"+path,{
      method,
      headers:{
        Authorization:"Bearer "+apiToken,
        Accept:"application/json",
        ...(body?{"Content-Type":"application/json"}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(16000)
    });
    if(!response.ok){
      throw Error("Cloudflare Access API HTTP "+response.status+
        " (requires Access: Apps and Policies Write permission; Pages Edit alone is insufficient)");
    }
    const data=await response.json();
    if(data?.success!==true)throw Error("Cloudflare Access API returned unsuccessful result");
    return data.result;
  };
  const existing=await req("?per_page=100");
  if(!Array.isArray(existing))throw Error("Cloudflare Access app inventory missing");
  const added=[],present=[];
  for(const path of TELEGRAM_ACCESS_PATHS){
    const domain=expectedUrl(path);
    const matches=existing.filter(app=>
      app.domain===domain||app.destinations?.some(d=>d.uri===domain));
    if(matches.length>1)throw Error("Multiple conflicting Access apps already handle "+path);
    if(matches.length===1){
      const app=matches[0];
      // Never rewrite an existing security policy that may be intentionally stricter.
      if(app.name!==expectedApp(path).name){
        throw Error("Existing Access application uses "+path+"; inspect it rather than overwrite its policies");
      }
      present.push(path);
      continue;
    }
    if(dryRun){added.push({path,action:"would-create"});continue}
    const created=await req("","POST",expectedApp(path));
    if(created?.domain!==domain)throw Error("Cloudflare Access returned unexpected domain for "+path);
    added.push({path,action:"created"});
  }
  return {dryRun,created:added,already_present:present,note:"No other STAR paths were changed."};
}

export async function resolveCloudflarePagesAccount(apiToken,{candidates=[],fetcher=fetch}={}){
  for(const id of [...new Set(candidates)]){
    if(!/^[a-f0-9]{32}$/.test(id))continue;
    try{
      const response=await fetcher(API+id+"/pages/projects/star-cyber-ai-x",{
        headers:{Authorization:"Bearer "+apiToken,Accept:"application/json"},
        signal:AbortSignal.timeout(16000)
      });
      if(!response.ok)continue;
      const data=await response.json();
      if(data?.success===true&&data.result?.name==="star-cyber-ai-x")return id;
    }catch{}
  }
  throw Error("Cannot verify an existing STAR Pages project with the current Cloudflare API token");
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const apiToken=process.env.CLOUDFLARE_API_TOKEN;
    if(!apiToken)throw Error("Missing Cloudflare API token");
    const accountId=await resolveCloudflarePagesAccount(apiToken,{
      candidates:[
        process.env.CLOUDFLARE_ACCOUNT_ID,
        "d2680f7c5ff39f8d9177a51dbf7fec75",
        "d45cb55f3d7654fc0eee90ca0e844378"
      ]
    });
    const result=await setupTelegramAccess({accountId,apiToken,dryRun:!process.argv.includes("--apply")});
    console.log(JSON.stringify(result));
  }catch(e){
    console.error("STAR Cloudflare Access setup:",e.message);
    process.exitCode=1;
  }
}
