// STAR SOVEREIGN owner-only durable vault backed by Supabase PostgREST.
// The Supabase service secret must never reach the browser or repository files.
const KINDS=new Set(["thread","memory","settings","research"]);
const ID=/^[a-zA-Z0-9_-]{1,120}$/;
const SAFE_OBJECT=x=>x&&typeof x==="object"&&!Array.isArray(x);
const RESP_HEADERS={"cache-control":"no-store","x-content-type-options":"nosniff"};
const json=(data,status=200)=>Response.json(data,{status,headers:RESP_HEADERS});
export function vaultReady(env){
  return typeof env.STAR_SUPABASE_URL==="string" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.STAR_SUPABASE_URL) &&
    typeof env.STAR_SUPABASE_SECRET_KEY==="string" &&
    env.STAR_SUPABASE_SECRET_KEY.length>28;
}
function config(env){
  if(!vaultReady(env))throw Error("STAR Vault cloud storage is not configured");
  const key=env.STAR_SUPABASE_SECRET_KEY;
  const headers={"apikey":key,"Content-Type":"application/json"};
  // Legacy service-role keys are JWTs. Modern sb_secret keys must not be
  // sent as Bearer JWTs: the gateway processes them via apikey.
  if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
  return {endpoint:env.STAR_SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/star_ai_vault",headers};
}
function validateItem(body){
  if(!SAFE_OBJECT(body)||!ID.test(body.id||"")||!KINDS.has(body.kind)||!SAFE_OBJECT(body.payload))
    return {error:"Invalid vault item"};
  if(Object.keys(body).some(k=>!["id","kind","payload"].includes(k)))
    return {error:"Unexpected vault item fields"};
  const payload=JSON.stringify(body.payload);
  if(payload.length>160000)return {error:"Vault item too large"};
  if(body.kind==="thread"){
    const arr=body.payload.messages;
    if(!Array.isArray(arr)||arr.length>350)return {error:"Invalid conversation"};
    let total=0;
    for(const m of arr){
      if(!SAFE_OBJECT(m)||!["user","assistant"].includes(m.role)||
          typeof m.content!=="string"||m.content.length>14000||
          Object.keys(m).some(k=>!["role","content","at","route"].includes(k)))
        return {error:"Invalid conversation message"};
      total+=m.content.length;
    }
    if(total>130000)return {error:"Conversation too large; start a new thread"};
    if(typeof body.payload.title!=="string"||body.payload.title.length>160)
      return {error:"Invalid conversation title"};
  }
  if(body.kind==="memory"&&
    (typeof body.payload.text!=="string"||body.payload.text.length>3000))
    return {error:"Invalid memory note"};
  return {item:{id:body.id,kind:body.kind,payload:body.payload}};
}
async function requestSupabase(env,search,options={}){
  const {endpoint,headers}=config(env);
  const res=await fetch(endpoint+search,{
    ...options,headers:{...headers,...(options.headers||{})},
    signal:AbortSignal.timeout(12000)
  });
  if(!res.ok){
    console.error("STAR Vault Supabase HTTP",res.status);
    throw Error("Vault storage unavailable");
  }
  if(res.status===204)return [];
  const data=await res.json().catch(()=>[]);
  return data;
}
export async function handleVault(request,env){
  if(!vaultReady(env))return json({enabled:false,error:"STAR Supabase cloud sync is not configured"},503);
  const url=new URL(request.url),method=request.method;
  const id=url.searchParams.get("id");
  const kind=url.searchParams.get("kind");
  if(id!==null&&!ID.test(id))return json({error:"Invalid vault ID"},400);
  if(kind!==null&&!KINDS.has(kind))return json({error:"Invalid vault kind"},400);
  try{
    if(method==="GET"){
      if(id){
        const rows=await requestSupabase(env,"?id=eq."+encodeURIComponent(id)+"&select=id,kind,payload,updated_at&limit=1");
        return json({enabled:true,item:rows[0]||null});
      }
      const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||100));
      const offset=Math.min(10000,Math.max(0,Number(url.searchParams.get("offset"))||0));
      const where=kind?"?kind=eq."+kind+"&":"?";
      const rows=await requestSupabase(env,where+"select=id,kind,payload,updated_at&order=updated_at.desc&limit="+limit+"&offset="+offset);
      return json({enabled:true,items:rows});
    }
    if(method==="PUT"){
      const raw=await request.json().catch(()=>null);
      const v=validateItem(raw);
      if(v.error)return json({error:v.error},400);
      const record={...v.item,updated_at:new Date().toISOString()};
      const rows=await requestSupabase(env,"?on_conflict=id",{
        method:"POST",
        headers:{Prefer:"resolution=merge-duplicates,return=representation"},
        body:JSON.stringify(record)
      });
      return json({ok:true,item:rows[0]||record});
    }
    if(method==="DELETE"){
      if(!id)return json({error:"Vault ID required"},400);
      await requestSupabase(env,"?id=eq."+encodeURIComponent(id),{
        method:"DELETE",headers:{Prefer:"return=minimal"}
      });
      return json({ok:true,deleted:id});
    }
    return json({error:"Method not allowed"},405);
  }catch(error){
    console.error("STAR Vault failed",error.message);
    return json({error:"Vault storage unavailable"},502);
  }
}
