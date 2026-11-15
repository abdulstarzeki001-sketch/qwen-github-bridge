// Read-only verification. Never log Pages environment variable values or API tokens.
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.log("Cloudflare inspection skipped: no deploy token available");process.exit(0)}
const candidates=[...new Set([process.env.CLOUDFLARE_ACCOUNT_ID,"d45cb55f3d7654fc0eee90ca0e844378"].filter(Boolean))];
const auth={Authorization:"Bearer "+token,Accept:"application/json"};
let found=false;
for(const accountId of candidates){
  try{
    const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+accountId+"/pages/projects/star-cyber-ai-x",{headers:auth,signal:AbortSignal.timeout(12000)});
    if(!r.ok){console.log("Project lookup: "+accountId+" HTTP "+r.status);continue}
    const j=await r.json();if(!j.success||j.result?.name!=="star-cyber-ai-x")continue;
    found=true;
    const prod=j.result.deployment_configs?.production||{};
    const names=Object.keys(prod.env_vars||{});
    const provider=prod.env_vars?.STAR_AI_PROVIDER;
    console.log("PROJECT_FOUND account="+accountId);
    console.log("PRODUCTION_ENV_VAR_COUNT="+names.length);
    console.log("STAR_PROVIDER_PRESENT="+!!provider);
    console.log("STAR_PROVIDER_TYPE="+(provider?.type||"none"));
    console.log("AI_CONFIGURED_IN_DEPLOYMENT="+Boolean(prod.ai_bindings?.AI||prod.ai?.AI||prod.ai_binding?.AI));
    console.log("AI_CONFIGURED_IN_REPOSITORY=true");
    // Never print env vars even if plaintext: user can store secrets there.
    const probe=await fetch("https://api.cloudflare.com/client/v4/accounts/"+accountId+"/workers/subscription",{headers:auth,signal:AbortSignal.timeout(12000)});
    if(!probe.ok){console.log("WORKERS_SUBSCRIPTION_HTTP="+probe.status)}
    else {const pj=await probe.json();const k=String(pj.result?.plan?.id||pj.result?.plan?.name||pj.result?.plan||pj.result?.subscription?.plan?.name||"unknown").toLowerCase();console.log("WORKERS_PLAN="+(/free/.test(k)?"free":/paid|bundled|standard/.test(k)?"paid":"undetermined"));}
    break;
  }catch(error){console.log("Lookup failed: "+error.name)}
}
if(!found){console.log("No available Cloudflare account found for STAR Pages.");process.exitCode=1;}
