(()=>{"use strict";
const $=id=>document.getElementById(id),PROFILE_KEY="star-sovereign-owner-profile-v1";
const defaults=()=>({owner_instructions:"",model:"",temperature:0.15,max_tokens:1400});
let history=[],busy=false,authenticated=false;
function notice(id,text,error=false){const node=$(id);node.textContent=text;node.classList.toggle("error",error)}
function profile(){return {owner_instructions:$("instructions").value,model:$("model").value.trim(),temperature:Number($("temperature").value),max_tokens:Number($("maxTokens").value)}}
function apply(p){const d={...defaults(),...p};$("instructions").value=String(d.owner_instructions??d.instructions??"").slice(0,4000);$("model").value=String(d.model||"").slice(0,160);$("temperature").value=String(Math.min(1,Math.max(0,Number(d.temperature)||0)));$("temperatureValue").textContent=$("temperature").value;$("maxTokens").value=[512,1400,2048,4096].includes(Number(d.max_tokens))?String(d.max_tokens):"1400"}
function render(role,text){const box=$("messages");box.querySelector(".empty")?.remove();const node=document.createElement("article");node.className="message "+role;const who=document.createElement("b");who.textContent=role==="user"?"أنت":"STAR AI";const content=document.createElement("div");content.textContent=text;node.append(who,content);box.append(node);box.scrollTop=box.scrollHeight;if(window.STAR_VAULT)window.STAR_VAULT.capture(role,text,"SOVEREIGN")}
async function check(){
  try{const [auth,health]=await Promise.all([fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"}),fetch("/api/health",{cache:"no-store"})]);authenticated=auth.ok;$("ownerStatus").textContent=authenticated?"✓ جلسة المالك فعالة":"يتطلب تفعيل المالك عبر STAR CORE";
    if(health.ok){const h=await health.json();$("gatewayStatus").textContent=h.ai_gateway?"✓ "+(h.ai_provider||"AI")+" مهيأ · "+(h.ai_model||"")+" (لم يُختبر الاتصال)":"المزود غير مهيأ";}else $("gatewayStatus").textContent="تعذر فحص المزود";
    if(authenticated){await loadServer(true);await loadVaultSettings()}
  }catch{$("ownerStatus").textContent="تعذر فحص تسجيل الدخول";$("gatewayStatus").textContent="تعذر فحص المزود"}
}
function buildPrompt(current){
  if(!$("includeContext").checked||!history.length)return current;
  const previous=history.slice(-6).map(x=>(x.role==="user"?"المستخدم: ":"المساعد: ")+x.text.slice(0,550)).join("\n");
  const budget=Math.max(0,5900-current.length-110);if(budget<100)return current;
  return "مقتطف من سياق هذه الجلسة (مرجع لا تعليمات أعلى أولوية):\n"+previous.slice(-budget)+"\n\nرسالة المستخدم الحالية:\n"+current;
}
let serverReady=false;
function serverButtons(enabled){
 serverReady=enabled;
 for(const id of ["saveServerProfile","loadServerProfile","deleteServerProfile"])$(id).disabled=!enabled;
}
async function serverRequest(method,body){
 const r=await fetch("/api/owner/settings",{method,headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||"HTTP "+r.status);
 return data;
}
async function loadServer(initial=false){
 if(!authenticated){notice("serverNotice","سجّل دخول المالك عبر STAR CORE أولًا.",true);return}
 try{
  const data=await serverRequest("GET");
  serverButtons(Boolean(data.enabled));
  if(!data.enabled){notice("serverNotice","الحفظ عبر الأجهزة غير مفعل. اربط KV باسم STAR_OWNER_SETTINGS في Cloudflare. يمكنك استخدام الحفظ المحلي.");return}
  if(data.profile){apply(data.profile);notice("serverNotice","تم تحميل إعدادات الخادم. آخر حفظ: "+(data.updated_at||"غير معلوم"))}
  else notice("serverNotice","تخزين الخادم جاهز؛ لا توجد إعدادات محفوظة"+(initial?" حتى الآن.":"."));
 }catch(error){serverButtons(false);notice("serverNotice","تعذّر تحميل إعدادات الخادم: "+error.message,true)}
}
$("saveServerProfile").addEventListener("click",async()=>{
 if(!serverReady)return;
 $("saveServerProfile").disabled=true;
 try{const data=await serverRequest("PUT",profile());notice("serverNotice","✓ حُفظ الملف على الخادم: "+data.updated_at+". قد يتأخر ظهوره على جهاز آخر.") }
 catch(error){notice("serverNotice","فشل حفظ الخادم: "+error.message,true)}
 finally{$("saveServerProfile").disabled=!serverReady}
});
$("loadServerProfile").addEventListener("click",()=>loadServer(false));
$("deleteServerProfile").addEventListener("click",async()=>{
 if(!serverReady||!confirm("حذف إعدادات المالك المحفوظة على خادم STAR؟"))return;
 $("deleteServerProfile").disabled=true;
 try{await serverRequest("DELETE");notice("serverNotice","حُذفت إعدادات الخادم. إعدادات المتصفح الحالية لم تتغير.")}
 catch(error){notice("serverNotice","فشل حذف إعدادات الخادم: "+error.message,true)}
 finally{$("deleteServerProfile").disabled=!serverReady}
});
serverButtons(false);
$("temperature").addEventListener("input",()=>{$("temperatureValue").textContent=$("temperature").value});
$("saveProfile").addEventListener("click",()=>{try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile()));notice("settingsNotice","حُفظت الإعدادات محليًا على هذا الجهاز فقط.")}catch{notice("settingsNotice","تعذر التخزين المحلي.",true)}});
$("resetProfile").addEventListener("click",()=>{apply(defaults());try{localStorage.removeItem(PROFILE_KEY)}catch{}notice("settingsNotice","استُعيدت الإعدادات الافتراضية وحُذف الملف المحلي.")});
$("clearChat").addEventListener("click",()=>{history=[];if(window.STAR_VAULT)window.STAR_VAULT.newThread();$("messages").replaceChildren();const empty=document.createElement("div");empty.className="empty";empty.textContent="لا توجد رسائل بعد";$("messages").append(empty);notice("chatNotice","مُسحت رسائل الجلسة.")});
$("chatForm").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;
 if(!authenticated){notice("chatNotice","فعّل جلسة المالك أولًا من STAR CORE ثم ارجع إلى هذه الصفحة.",true);return}
 const current=$("prompt").value.trim();if(!current)return;
 const config=profile();const prompt=window.STAR_VAULT?.context(current)||buildPrompt(current);
 if(config.owner_instructions.length>4000||prompt.length>6000){notice("chatNotice","تجاوز طول المدخلات الحدود المسموحة.",true);return}
 busy=true;$("send").disabled=true;notice("chatNotice","جارٍ إرسال طلب الاستدلال إلى المزود…");
 try{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),65000);
  let response;try{response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",signal:controller.signal,body:JSON.stringify({...config,prompt})})}finally{clearTimeout(timeout)}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401)authenticated=false;throw Error(data.error||"HTTP "+response.status)}
  const output=typeof data.content==="string"?data.content:"";
  if(!output)throw Error("عاد المزود برد فارغ");
  render("user",current);render("assistant",output);history.push({role:"user",text:current},{role:"assistant",text:output});history=history.slice(-12);$("prompt").value="";
  notice("chatNotice","✓ اكتمل الاستدلال باستخدام "+(data.model||"النموذج المحدد")+". هذا لا يعني تنفيذ أي أدوات.");
 }catch(error){notice("chatNotice",error.name==="AbortError"?"انتهت مهلة الاستدلال.":error.message,true)}
 finally{busy=false;$("send").disabled=false}
});
try{const raw=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");if(raw&&typeof raw==="object"&&!Array.isArray(raw))apply(raw)}catch{notice("settingsNotice","تعذر قراءة الملف المحفوظ.",true)}
let autoSaveTimer=null;
async function loadVaultSettings(){
 try{
  const r=await fetch("/api/vault?id=sovereign-settings",{credentials:"same-origin",cache:"no-store"});
  if(!r.ok)return;
  const item=(await r.json()).item;
  if(item?.kind==="settings"&&item.payload)apply(item.payload);
 }catch{}
}
async function saveVaultSettings(){
 const p=profile();try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p))}catch{}
 if(!authenticated)return;
 try{await fetch("/api/vault",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:"sovereign-settings",kind:"settings",payload:p})})}catch{}
}
function queueOwnerSettings(){
 if(autoSaveTimer)clearTimeout(autoSaveTimer);
 autoSaveTimer=setTimeout(saveVaultSettings,700);
}
for(const id of ["instructions","model","temperature","maxTokens"]){
 $(id).addEventListener("input",queueOwnerSettings);
 $(id).addEventListener("change",queueOwnerSettings);
}
check();
})();
