// Persistent owner sign-in for a trusted browser, without storing API tokens in localStorage.
// HMAC-signed, HttpOnly, Secure, SameSite=Strict cookie; rolling 90-day idle expiry.
// Rotating STAR_API_TOKEN invalidates every issued owner cookie.
const COOKIE="__Host-star_owner";
const MAX_AGE=90*24*60*60;
const RENEW_AT=45*24*60*60;
const enc=new TextEncoder();
function b64url(bytes){
  let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function sign(env,message){
  const secret=env.STAR_API_TOKEN;
  if(typeof secret!=="string"||secret.length<32)return null;
  const key=await crypto.subtle.importKey("raw",enc.encode("star-owner-cookie-v1:"+secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(message))));
}
function constantEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string")return false;
  let difference=a.length^b.length;
  const count=Math.max(a.length,b.length);
  for(let i=0;i<count;i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return difference===0;
}
export async function makeOwnerCookie(env){
  if(typeof env.STAR_API_TOKEN!=="string"||env.STAR_API_TOKEN.length<32)return null;
  const exp=Math.floor(Date.now()/1000)+MAX_AGE;
  const random=crypto.getRandomValues(new Uint8Array(16));
  const payload="v1."+exp+"."+b64url(random);
  const mac=await sign(env,payload);
  if(!mac)return null;
  return COOKIE+"="+payload+"."+mac+"; Max-Age="+MAX_AGE+"; Path=/; Secure; HttpOnly; SameSite=Strict";
}
export async function readOwnerCookie(request,env){
  const input=request.headers.get("cookie")||"";
  const found=input.split(";").map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+"="));
  if(found.length!==1)return {ok:false};
  const raw=found[0].slice(COOKIE.length+1);
  if(raw.length>300)return {ok:false};
  const parts=raw.split(".");
  if(parts.length!==4||parts[0]!=="v1"||!/^[0-9]{10}$/.test(parts[1])||!/^[A-Za-z0-9_-]{22}$/.test(parts[2])||!/^[A-Za-z0-9_-]{43}$/.test(parts[3]))return {ok:false};
  const now=Math.floor(Date.now()/1000),exp=Number(parts[1]);
  if(exp<=now||exp>now+MAX_AGE)return {ok:false};
  const message=parts.slice(0,3).join(".");
  const signature=await sign(env,message);
  if(!signature||!constantEqual(signature,parts[3]))return {ok:false};
  return {ok:true,renew:exp-now<RENEW_AT,expires_at:exp};
}
export function clearOwnerCookie(){
  return COOKIE+"=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict";
}
