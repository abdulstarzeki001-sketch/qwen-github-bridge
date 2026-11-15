// Optional Cloudflare Pages KV-backed owner profile. Secrets never belong in the profile.
export const OWNER_PROFILE_KEY="star:owner-profile:v1";
const allowedKeys=new Set(["owner_instructions","model","temperature","max_tokens"]);
export function validateOwnerProfile(input,env){
  if(!input||typeof input!=="object"||Array.isArray(input))return {error:"Profile must be an object"};
  if(Object.keys(input).some(x=>!allowedKeys.has(x)))return {error:"Unknown profile setting"};
  const owner_instructions=input.owner_instructions??"";
  const model=input.model??"";
  const temperature=input.temperature??0.15;
  const max_tokens=input.max_tokens??1400;
  if(typeof owner_instructions!=="string"||owner_instructions.length>4000)
    return {error:"Owner instructions must be text (max 4000 characters)"};
  if(typeof model!=="string"||model.length>160)
    return {error:"Invalid model identifier"};
  const selected=model.trim();
  const allowlist=String(env.STAR_ALLOWED_MODELS||"").split(",").map(s=>s.trim()).filter(Boolean);
  if(selected&&!allowlist.includes(selected))
    return {error:"Requested model is not on the server allowlist"};
  if(selected&&env.STAR_AI_PROVIDER==="cloudflare"&&selected!=="@cf/meta/llama-3.1-8b-instruct")
    return {error:"Cloudflare AI binding uses a fixed model in this release"};
  if(typeof temperature!=="number"||!Number.isFinite(temperature)||temperature<0||temperature>1)
    return {error:"Temperature must be between 0 and 1"};
  if(typeof max_tokens!=="number"||!Number.isInteger(max_tokens)||max_tokens<128||max_tokens>4096)
    return {error:"max_tokens must be an integer from 128 to 4096"};
  return {profile:{owner_instructions,model:selected,temperature,max_tokens}};
}
export function ownerStorageReady(env){
  return typeof env.STAR_OWNER_SETTINGS?.get==="function" &&
    typeof env.STAR_OWNER_SETTINGS?.put==="function" &&
    typeof env.STAR_OWNER_SETTINGS?.delete==="function";
}
export async function readOwnerSettings(env){
  if(!ownerStorageReady(env))return null;
  const raw=await env.STAR_OWNER_SETTINGS.get(OWNER_PROFILE_KEY);
  if(raw===null)return null;
  const value=JSON.parse(raw);
  const validation=validateOwnerProfile(value?.profile,env);
  if(validation.error)throw new Error("Invalid stored owner profile");
  return {profile:validation.profile,updated_at:value.updated_at||null};
}
export async function writeOwnerSettings(env,profile){
  const record={profile,updated_at:new Date().toISOString()};
  await env.STAR_OWNER_SETTINGS.put(OWNER_PROFILE_KEY,JSON.stringify(record));
  return record;
}
export async function removeOwnerSettings(env){
  await env.STAR_OWNER_SETTINGS.delete(OWNER_PROFILE_KEY);
}
