// GitHub Actions OIDC verifier for STAR Telegram bootstrap.
// Accepts ONLY signed short-lived RS256 JWTs from the exact main-branch workflow.
const ISSUER="https://token.actions.githubusercontent.com";
const JWKS_URL=ISSUER+"/.well-known/jwks";
const AUDIENCE="star-nexus-telegram-webhook";
const REPOSITORY="abdulstarzeki001-sketch/qwen-github-bridge";
const OWNER_ID="311850512";
const REPOSITORY_ID="1412897704";
const VALID_SUBJECTS=new Set([
  "repo:"+REPOSITORY+":ref:refs/heads/main",
  "repo:abdulstarzeki001-sketch@"+OWNER_ID+"/qwen-github-bridge@"+REPOSITORY_ID+":ref:refs/heads/main"
]);
const WORKFLOW_REF=REPOSITORY+"/.github/workflows/verify-star-telegram-production.yml@refs/heads/main";

function unbase64url(part){
  if(typeof part!=="string"||part.length<1||part.length>7000||
    !/^[A-Za-z0-9_-]+$/.test(part))throw Error("Malformed JWT");
  const str=part.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(str+"=".repeat((4-str.length%4)%4)),c=>c.charCodeAt(0));
}

export async function verifyStarDeploymentOidc(token,{jwksFetch=fetch,now=Math.floor(Date.now()/1000)}={}){
  try{
    if(typeof token!=="string"||token.length<120||token.length>10000)return false;
    const parts=token.split(".");
    if(parts.length!==3)return false;
    const header=JSON.parse(new TextDecoder().decode(unbase64url(parts[0])));
    const claims=JSON.parse(new TextDecoder().decode(unbase64url(parts[1])));
    if(header?.alg!=="RS256"||typeof header.kid!=="string"||
      !/^[A-Za-z0-9_-]{1,100}$/.test(header.kid))return false;
    if(claims?.iss!==ISSUER||claims.aud!==AUDIENCE||
      claims.repository!==REPOSITORY||claims.ref!=="refs/heads/main"||
      claims.workflow_ref!==WORKFLOW_REF||!["workflow_run","workflow_dispatch"].includes(claims.event_name)||
      !VALID_SUBJECTS.has(claims.sub)||String(claims.repository_id)!==REPOSITORY_ID||
      String(claims.repository_owner_id)!==OWNER_ID)return false;
    if(!Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)||
      !Number.isSafeInteger(claims.nbf)||claims.exp<=now-30||claims.iat>now+60||
      claims.nbf>now+60||claims.exp-claims.iat>900||claims.iat<now-900)return false;
    const r=await jwksFetch(JWKS_URL,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)return false;
    const payload=await r.json();
    const jwk=payload?.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&
      (!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
    if(!jwk||!jwk.n||!jwk.e)return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{
      name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"
    },false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,
      unbase64url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return false}
}
export const STAR_TELEGRAM_OIDC_AUDIENCE=AUDIENCE;
