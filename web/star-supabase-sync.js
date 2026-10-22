/* STAR Supabase Sync: public key + per-user Supabase Auth + PostgreSQL RLS.
 * Never use service-role keys in this browser client.
 * A separate, authenticated STAR owner session is required for all UI actions.
 */
(()=>{"use strict";
const cfg=window.STAR_SUPABASE_PUBLIC;
const KEY="star-supabase-sync-session-v1",PREF="star-supabase-sync-remember-v1",USER_BINDING="star-supabase-vault-user-v1";
const $=id=>document.getElementById(id);
let session=null,ownerOk=false,loading=false,connected=false,initial=false;
const now=()=>Math.floor(Date.now()/1000);
const safeEmail=s=>String(s||"").trim().toLowerCase().slice(0,254);
function getStored(){
 try{
  const data=sessionStorage.getItem(KEY)||localStorage.getItem(KEY);
  const obj=data?JSON.parse(data):null;
  return obj&&typeof obj.access_token==="string"&&typeof obj.refresh_token==="string"&&Number.isFinite(obj.expires_at)?obj:null;
 }catch{return null}
}
function remember(){try{return localStorage.getItem(PREF)==="yes"}catch{return false}}
function store(s){
 session=s;
 try{
  sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);
  if(s)(remember()?localStorage:sessionStorage).setItem(KEY,JSON.stringify(s));
 }catch{}
}
function status(msg,error=false){
 const n=$("supabaseSyncStatus");if(n){n.textContent=msg;n.dataset.error=error?"yes":"no"}
}
async function api(path,opts={}){
 const url=cfg.url+path;
 const headers={"apikey":cfg.publishableKey,"Content-Type":"application/json",...(opts.headers||{})};
 let response=await fetch(url,{...opts,headers,cache:"no-store"});
 if(!response.ok){
  // No provider error dumps or tokens.
  throw Object.assign(Error("Supabase: HTTP "+response.status),{status:response.status});
 }
 return response.status===204?null:response.json().catch(()=>null);
}
function toSession(result){
 if(!result||typeof result.access_token!=="string"||typeof result.refresh_token!=="string")throw Error("Supabase did not return a valid login session");
 return {access_token:result.access_token,refresh_token:result.refresh_token,expires_at:now()+Math.max(60,Number(result.expires_in)||3600),email:result.user?.email||session?.email||""};
}
async function refreshToken(){
 if(!session?.refresh_token)return false;
 try{
  const result=await api("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:session.refresh_token})});
  store(toSession(result));return true;
 }catch{store(null);return false}
}
async function validSession(retried=false){
 if(!ownerOk||!session)return false;
 if(session.expires_at<=now()+90&&!(await refreshToken()))return false;
 try{
  const user=await api("/auth/v1/user",{headers:{Authorization:"Bearer "+session.access_token}});
  if(typeof user?.id!=="string"||!user.id)return false;
  // A device-local archive may contain private owner documents from another
  // login. Never silently upload that archive into another Supabase account.
  try{
   const bound=localStorage.getItem(USER_BINDING);
   if(bound&&bound!==user.id){status("هذه ذاكرة جهاز مرتبطة بحساب Supabase آخر. لن تتم مزامنتها لحماية البيانات.",true);return false}
   if(!bound)localStorage.setItem(USER_BINDING,user.id);
  }catch{return false}
  return true;
 }catch(error){
  if((error.status===401||error.status===403)&&!retried){if(!(await refreshToken()))return false;return validSession(true)}
  return false;
 }
}
async function checkStarOwner(){
 try{
  const res=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
  return Boolean(res.ok&&(await res.json()).authenticated);
 }catch{return false}
}
function ready(){return ownerOk&&connected&&Boolean(session?.access_token)}
async function authHeader(){
 if(!ownerOk||!session)throw Error("Sign in as STAR owner and connect Supabase first");
 if(session.expires_at<=now()+90&&!(await refreshToken()))throw Error("Supabase session expired");
 return {"Authorization":"Bearer "+session.access_token,"apikey":cfg.publishableKey,"Content-Type":"application/json"};
}
async function directVault(method,id,kind,item,page={}){
 if(!ready())throw Error("Supabase sync is not connected");
 const base=cfg.url+"/rest/v1/"+cfg.vaultTable;
 const params=new URLSearchParams();
 let requestMethod="GET",body;
 if(method==="LIST"){
  params.set("select","id,kind,payload,updated_at");
  params.set("order","updated_at.desc");
  params.set("limit",String(Math.min(100,Math.max(1,Number(page.limit)||100))));
  params.set("offset",String(Math.max(0,Number(page.offset)||0)));
  if(kind)params.set("kind","eq."+kind);
 }else if(method==="GET"){
  params.set("select","id,kind,payload,updated_at");params.set("id","eq."+id);params.set("limit","1");
 }else if(method==="PUT"){
  requestMethod="POST";
  params.set("on_conflict","user_id,id");
  body=JSON.stringify({...item,updated_at:new Date().toISOString()});
 }else if(method==="DELETE"){
  requestMethod="DELETE";params.set("id","eq."+id);
 }else throw Error("Invalid vault operation");
 const headers=await authHeader();
 if(method==="PUT")headers.Prefer="resolution=merge-duplicates,return=representation";
 if(method==="DELETE")headers.Prefer="return=minimal";
 const res=await fetch(base+"?"+params.toString(),{method:requestMethod,headers,body,cache:"no-store"});
 if(!res.ok){
  if(res.status===401||res.status===403){connected=false;updateUI();throw Error("Supabase sign-in needs renewal")}
  throw Error("Supabase vault HTTP "+res.status);
 }
 const data=res.status===204?[]:await res.json().catch(()=>[]);
 if(method==="LIST")return {enabled:true,items:data};
 if(method==="GET")return {enabled:true,item:data[0]||null};
 if(method==="PUT")return {ok:true,item:data[0]||item};
 return {ok:true,deleted:id};
}
async function finishLogin(result){
 store(toSession(result));
 const ok=await validSession();
 connected=ok;
 updateUI();
 if(ok){
  status("✓ ربط Supabase ناجح. جارٍ مزامنة محادثاتك وملفاتك الخاصة…");
  await window.STAR_VAULT?.sync?.();
  status("✓ تم توثيق Supabase وبدء المزامنة. راجع إشعارات STAR VAULT لتأكيد رفع الملفات.");
 }else{store(null);status("لم يتم تأكيد جلسة Supabase.",true)}
}
async function acceptLink(){
 if(!location.hash||!location.hash.includes("access_token="))return false;
 const hash=new URLSearchParams(location.hash.slice(1));
 const token=hash.get("access_token"),refresh=hash.get("refresh_token"),expires=Number(hash.get("expires_in")||3600);
 // Strip the token from browser history immediately, including on auth failure.
 history.replaceState({},document.title,location.pathname+location.search);
 if(!ownerOk||!token||!refresh)return false;
 await finishLogin({access_token:token,refresh_token:refresh,expires_in:expires});
 return true;
}
async function authorize(){
 ownerOk=await checkStarOwner();
 const panel=$("supabaseSyncPanel");
 if(panel)panel.hidden=!ownerOk;
 if(!ownerOk){connected=false;session=null;updateUI();return}
 session=session||getStored();
 try{
  if(await acceptLink())return;
  if(session&&await validSession()){
   connected=true;status("✓ Supabase متصل بحسابك الموثوق.");updateUI();
   await window.STAR_VAULT?.sync?.();
  }else{connected=false;status("فعّل المزامنة عبر بريد Supabase. ملفاتك الحالية محفوظة على هذا الجهاز.");updateUI()}
 }catch{connected=false;status("تعذر التحقق من Supabase. حاول مجددًا.",true);updateUI()}
 initial=true;
}
async function requestEmail(){
 const email=safeEmail($("supabaseEmail").value);
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return status("أدخل بريدًا إلكترونيًا صحيحًا.",true);
 if(!ownerOk)return status("فعّل STAR Owner أولًا.",true);
 if(loading)return;
 loading=true;updateUI();
 try{
  const callback=location.origin+"/ai-v2.html";
  await api("/auth/v1/otp?redirect_to="+encodeURIComponent(callback),{
   method:"POST",body:JSON.stringify({email,create_user:true})
  });
  try{sessionStorage.setItem("star-supabase-email-pending",email)}catch{}
  status("تم تقديم طلب إرسال رابط الدخول أو رمز البريد. افتح البريد، ثم اضغط الرابط أو أدخل رمز OTP إذا وصلك. قد يتطلب Cloudflare ضمن Redirect URLs في Supabase.");
 }catch(e){status("تعذر طلب رسالة الدخول: "+e.message,true)}
 finally{loading=false;updateUI()}
}
async function verifyCode(){
 const email=safeEmail($("supabaseEmail").value||(sessionStorage.getItem("star-supabase-email-pending")||""));
 const code=String($("supabaseCode").value||"").replace(/\s/g,"");
 if(!email||!/^\d{6,8}$/.test(code))return status("أدخل بريدك والرمز المكوّن من 6 إلى 8 أرقام.",true);
 if(loading)return;
 loading=true;updateUI();
 try{
  const result=await api("/auth/v1/verify",{method:"POST",body:JSON.stringify({email,token:code,type:"email"})});
  await finishLogin(result);
  $("supabaseCode").value="";
 }catch(e){status("فشل التحقق من الرمز: "+e.message,true)}
 finally{loading=false;updateUI()}
}
async function loginPassword(){
 const email=safeEmail($("supabaseEmail").value),password=$("supabasePassword").value;
 if(!email||!password)return status("أدخل البريد وكلمة مرور حساب Supabase.",true);
 if(loading)return;
 loading=true;updateUI();
 try{
  const result=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
  $("supabasePassword").value="";
  await finishLogin(result);
 }catch(e){status("تعذر الدخول بكلمة المرور: "+e.message,true)}
 finally{loading=false;$("supabasePassword").value="";updateUI()}
}
async function disconnect(){
 if(session?.access_token)try{await api("/auth/v1/logout",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}})}catch{}
 store(null);connected=false;updateUI();status("تم فصل Supabase عن هذا المتصفح؛ الملفات المحلية لم تُحذف.");
}
function lock(){
 // Disconnecting STAR owner access must clear in-memory credentials.
 ownerOk=false;connected=false;session=null;
 const panel=$("supabaseSyncPanel");if(panel)panel.hidden=true;
 updateUI();
}
function updateUI(){
 const linked=ready();
 for(const id of ["supabaseCode","supabaseEmail","supabasePassword","supabaseEmailSend","supabaseCodeVerify","supabasePasswordLogin"]){
  const el=$(id);if(el)el.disabled=linked||loading||!ownerOk;
 }
 const dis=$("supabaseDisconnect");if(dis)dis.disabled=!linked;
 const badge=$("supabaseState");if(badge)badge.textContent=linked?"✓ متصل":"غير متصل";
 const manual=$("supabaseSyncNow");if(manual)manual.disabled=!linked||loading;
}
function mount(){
 if($("supabaseSyncPanel")||!cfg)return;
 const panel=document.createElement("section");
 panel.id="supabaseSyncPanel";panel.className="supabase-panel";panel.hidden=true;
 panel.innerHTML='<div class="supabase-head"><strong>☁ Supabase · مزامنة آمنة بين أجهزتك</strong><span id="supabaseState">غير متصل</span></div>'+
 '<p class="supabase-note">يتطلب حساب STAR Owner وحساب Supabase موثّق بالبريد. مزامنة الملفات والمحادثات تتم بصلاحيات خاصة بحسابك (RLS)، دون مفتاح خادم سرّي داخل المتصفح.</p>'+
 '<div class="supabase-row"><input type="email" id="supabaseEmail" autocomplete="email" placeholder="بريد حساب Supabase" aria-label="البريد الإلكتروني"><button type="button" id="supabaseEmailSend">إرسال رابط أو رمز</button></div>'+
 '<div class="supabase-row"><input type="text" id="supabaseCode" inputmode="numeric" autocomplete="one-time-code" placeholder="رمز OTP إن وصل بالبريد" aria-label="رمز التحقق"><button type="button" id="supabaseCodeVerify">تأكيد الرمز</button></div>'+
 '<details><summary>لديّ كلمة مرور Supabase</summary><div class="supabase-row"><input type="password" id="supabasePassword" autocomplete="current-password" placeholder="كلمة المرور"><button type="button" id="supabasePasswordLogin">دخول</button></div></details>'+
 '<label class="supabase-remember"><input type="checkbox" id="supabaseRemember"> تذكّر الاتصال على هذا المتصفح الموثوق (لا تستخدمه على جهاز مشترك)</label>'+
 '<div class="supabase-actions"><button type="button" id="supabaseSyncNow">مزامنة الآن</button><button type="button" id="supabaseDisconnect">فصل Supabase</button></div>'+
 '<p class="supabase-status" id="supabaseSyncStatus" role="status" aria-live="polite">جارٍ التحقق من حالة الاتصال…</p>';
 const target=$("vaultPanel")||$("knowledgePanel")||document.querySelector(".v2-actionbar")||$("messages");
 target.parentNode.insertBefore(panel,target.nextSibling);
 $("supabaseRemember").checked=remember();
 $("supabaseRemember").addEventListener("change",e=>{
  try{localStorage.setItem(PREF,e.target.checked?"yes":"no")}catch{}
  if(session)store(session);
 });
 $("supabaseEmailSend").addEventListener("click",requestEmail);
 $("supabaseCodeVerify").addEventListener("click",verifyCode);
 $("supabasePasswordLogin").addEventListener("click",loginPassword);
 $("supabaseSyncNow").addEventListener("click",async()=>{
  status("جارٍ مزامنة الملفات والمحادثات…");try{await window.STAR_VAULT?.sync?.();status("تم بدء المزامنة؛ راجع حالة STAR VAULT للتأكد من اكتمالها.")}catch(e){status(e.message,true)}
 });
 $("supabaseDisconnect").addEventListener("click",disconnect);
 authorize();
}
window.STAR_SUPABASE_SYNC={authorize,lock,ready,remote:directVault,signOut:disconnect};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();