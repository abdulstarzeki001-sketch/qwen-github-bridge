// Validate Cloudflare Access JWT on the server. Never trust client-supplied identity headers.
const decode=s=>{const b=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(b.padEnd(Math.ceil(b.length/4)*4,"=")),c=>c.charCodeAt(0))};
const json=s=>JSON.parse(new TextDecoder().decode(decode(s)));
export async function ownerAccess(request,env){
  const team=(env.STAR_ACCESS_TEAM_DOMAIN||"").trim().toLowerCase();
  const aud=(env.STAR_ACCESS_AUD||"").trim();
  const owner=(env.STAR_OWNER_EMAIL||"").trim().toLowerCase();
  if(!team||!aud||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))return false;
  const token=request.headers.get("cf-access-jwt-assertion");
  if(!token)return false;
  try{
    const parts=token.split(".");if(parts.length!==3)return false;
    const header=json(parts[0]),payload=json(parts[1]);
    if(header.alg!=="RS256"||typeof header.kid!=="string")return false;
    if(payload.iss!==team||!Array.isArray(payload.aud)||!payload.aud.includes(aud)||(owner&&payload.email?.toLowerCase()!==owner))return false;
    const now=Math.floor(Date.now()/1000);
    if(!Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60)return false;
    const res=await fetch(team+"/cdn-cgi/access/certs");
    if(!res.ok)return false;
    const keys=await res.json();
    const jwk=(keys.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
    if(!jwk)return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return false}
}
