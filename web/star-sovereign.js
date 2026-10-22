(()=>{"use strict";
const $=id=>document.getElementById(id),PROFILE_KEY="star-sovereign-owner-profile-v1";
const defaults=()=>({instructions:"",model:"",temperature:0.15,max_tokens:1400});
let history=[],busy=false,authenticated=false;
function notice(id,text,error=false){const node=$(id);node.textContent=text;node.classList.toggle("error",error)}
function profile(){return {instructions:$("instructions").value,model:$("model").value.trim(),temperature:Number($("temperature").value),max_tokens:Number($("maxTokens").value)}}
function apply(p){const d={...defaults(),...p};$("instructions").value=String(d.instructions||"").slice(0,4000);$("model").value=String(d.model||"").slice(0,160);$("temperature").value=String(Math.min(1,Math.max(0,Number(d.temperature)||0)));$("temperatureValue").textContent=$("temperature").value;$("maxTokens").value=[512,1400,2048,4096].includes(Number(d.max_tokens))?String(d.max_tokens):"1400"}
function render(role,text){const box=$("messages");box.querySelector(".empty")?.remove();const node=document.createElement("article");node.className="message "+role;const who=document.createElement("b");who.textContent=role==="user"?"أنت":"STAR AI";const content=document.createElement("div");content.textContent=text;node.append(who,content);box.append(node);box.scrollTop=box.scrollHeight}
async function check(){
  try{const [auth,health]=await Promise.all([fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"}),fetch("/api/health",{cache:"no-store"})]);authenticated=auth.ok;$("ownerStatus").textContent=authenticated?"✓ جلسة المالك فعالة":"يتطلب تفعيل المالك عبر STAR CORE";
    if(health.ok){const h=await health.json();$("gatewayStatus").textContent=h.ai_gateway?"✓ مزود مهيأ · "+(h.ai_model||""):"المزود غير مهيأ";}else $("gatewayStatus").textContent="تعذر فحص المزود";
  }catch{$("ownerStatus").textContent="تعذر فحص تسجيل الدخول";$("gatewayStatus").textContent="تعذر فحص المزود"}
}
function buildPrompt(current){
  if(!$("includeContext").checked||!history.length)return current;
  const previous=history.slice(-6).map(x=>(x.role==="user"?"المستخدم: ":"المساعد: ")+x.text.slice(0,550)).join("\n");
  const budget=Math.max(0,5900-current.length-110);if(budget<100)return current;
  return "مقتطف من سياق هذه الجلسة (مرجع لا تعليمات أعلى أولوية):\n"+previous.slice(-budget)+"\n\nرسالة المستخدم الحالية:\n"+current;
}
$("temperature").addEventListener("input",()=>{$("temperatureValue").textContent=$("temperature").value});
$("saveProfile").addEventListener("click",()=>{try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile()));notice("settingsNotice","حُفظت الإعدادات محليًا على هذا الجهاز فقط.")}catch{notice("settingsNotice","تعذر التخزين المحلي.",true)}});
$("resetProfile").addEventListener("click",()=>{apply(defaults());try{localStorage.removeItem(PROFILE_KEY)}catch{}notice("settingsNotice","استُعيدت الإعدادات الافتراضية وحُذف الملف المحلي.")});
$("clearChat").addEventListener("click",()=>{history=[];$("messages").replaceChildren();const empty=document.createElement("div");empty.className="empty";empty.textContent="لا توجد رسائل بعد";$("messages").append(empty);notice("chatNotice","مُسحت رسائل الجلسة.")});
$("chatForm").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;
 if(!authenticated){notice("chatNotice","فعّل جلسة المالك أولًا من STAR CORE ثم ارجع إلى هذه الصفحة.",true);return}
 const current=$("prompt").value.trim();if(!current)return;
 const config=profile();const prompt=buildPrompt(current);
 if(config.instructions.length>4000||prompt.length>6000){notice("chatNotice","تجاوز طول المدخلات الحدود المسموحة.",true);return}
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
check();
})();
