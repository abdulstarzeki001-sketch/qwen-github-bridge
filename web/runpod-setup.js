(()=>{
"use strict";
const $=id=>document.getElementById(id);
let endpoint="";
$("makePodUrl").addEventListener("click",()=>{
  const id=$("podId").value.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{3,63}$/.test(id)||id.endsWith("-")){
    endpoint="";$("copyPodUrl").disabled=true;
    $("podNotice").textContent="معرّف Pod غير صالح. اكتبه كما يظهر في لوحة RunPod، دون رابط أو مسافات.";
    return;
  }
  endpoint="https://"+id+"-8080.proxy.runpod.net/chat/completions";
  $("podUrl").textContent=endpoint;
  $("copyPodUrl").disabled=false;
  $("podNotice").textContent="تم إنشاء الرابط محلياً. تأكد أن منفذ 8080/http مفتوح في Pod.";
});
$("copyPodUrl").addEventListener("click",async()=>{
  if(!endpoint)return;
  try{
    await navigator.clipboard.writeText(endpoint);
    $("podNotice").textContent="تم نسخ الرابط.";
  }catch{
    $("podNotice").textContent="تعذر النسخ تلقائياً؛ انسخ الرابط المعروض يدوياً.";
  }
});
$("checkGateway").addEventListener("click",async()=>{
  const button=$("checkGateway");
  const output=$("gatewayStatus");button.disabled=true;output.textContent="جاري فحص بوابة النموذج عبر حساب STAR...";
  try{
    const response=await fetch("/api/nexus/model-probe",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){
      output.textContent="سجّل دخول المالك في صفحة STAR ثم أعد الفحص.";
    }else if(!response.ok){
      output.textContent="تعذر الفحص: "+(data.error||"HTTP "+response.status);
    }else if(data.checked&&data.reachable){
      output.textContent="بوابة GPU متصلة وتقبل المصادقة. النموذج الحالي: "+(data.model||"غير معروف")+". جرّب محادثة للتحقق من الاستدلال.";
    }else if(data.checked){
      output.textContent="بوابة GPU غير متاحة حالياً. افحص Pod وأسرار Cloudflare وإعداد 8080/http.";
    }else{
      output.textContent="STAR لا يستخدم حالياً مزود GPU خاصاً. أكمل إعداد STAR_AI_PROVIDER=selfhosted بعد اختبار الخادم.";
    }
  }catch{
    output.textContent="تعذر الاتصال بـ STAR API. راجع الشبكة أو إعدادات النشر.";
  }finally{button.disabled=false;}
});
})();