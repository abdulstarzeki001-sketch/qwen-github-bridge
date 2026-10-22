/* STAR CORE V2 - COMMANDER III: plan previews, diagnostics and user-initiated voice */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const state=(id,s,kind="")=>{const n=$(id);n.textContent=String(s);n.classList.toggle("err",kind==="err");n.classList.toggle("ok",kind==="ok")};
let plan=null,working=false,recognizer=null;
const types={
repo:[["تحديد الملفات","حدّد أجزاء GitHub ذات الصلة، ولا تفترض محتويات ملفات غير مفتوحة.","تحديد الملفات والأدلة"],["تدقيق الكود","راجع المنطق وحالات الخطأ وحماية الأسرار.","تقرير فني بمواضع المخاطر"],["مقترح تعديل","أعد فرقاً مقترحاً للملفات، لا ترفع ولا تدمج.","تغييرات جاهزة لمراجعة المالك"],["اختبارات","حدّد الاختبارات وأوامر البناء المطلوبة.","نتائج اختبار موثّقة"],["قرار النشر","اعرض خطة آمنة للدمج والتراجع.","موافقة صريحة قبل التنفيذ"]],
cloud:[["فهم بيئة Cloudflare","حدّد Pages وWorkers وBindings والأسرار دون كشفها.","خريطة للمكونات"],["فحص API","راجع مسارات API وسياسات المصادقة والأخطاء.","فحص صحة ونتائج موثقة"],["اقتراح تحسين","جهّز تغييرات إعدادات Wrangler دون تطبيقها.","خطة فرق قابلة للمراجعة"],["اختبار النشر","أعد Smoke Tests وخطة تراجع.","اجتياز CI فعلي"],["قرار النشر","راجع الحساب والصلاحيات قبل النشر.","موافقة المالك وسجل نشر ناجح"]],
cyber:[["تحديد النطاق","عرّف الأصول المصرّح بفحصها.","نطاق واضح"],["مراجعة دفاعية","دقّق الهوية والصلاحيات والمدخلات والأسرار.","أدلة على المشكلات"],["التحقق","اقترح اختبارات غير تخريبية ضمن النطاق.","نتائج قابلة للتكرار"],["الإصلاح","قدّم إصلاحات مفصلة دون تطبيق تلقائي.","مقارنة قبل وبعد"],["التقرير","رتّب المخاطر وإعادة التحقق.","تقرير نهائي"]],
design:[["بحث المستخدم","حدّد أهداف التجربة والشاشات والأجهزة.","متطلبات واضحة"],["نظام التصميم","ضع الألوان والمكونات والتفاعلات.","مخطط واجهة قابل لإعادة الاستخدام"],["التنفيذ","جهّز مكونات Mobile-First.","كود قابل للاختبار"],["جودة التجربة","راجع الأداء والوصول وتقليل الحركة.","اختبارات 320–1440px"],["الإطلاق","خطّط الإصدار دون نشر تلقائي.","موافقة المالك"]]};
function category(x){x=x.toLowerCase();if(/cloud|worker|gateway|نشر|كلاود/.test(x))return"cloud";if(/security|cyber|vuln|امن|أمن|ثغر/.test(x))return"cyber";if(/design|ui|ux|تصميم|واجهة/.test(x))return"design";return"repo";}
function setPlan(p){plan=p;render();$("p3PlanArea").hidden=false;state("p3Notice",p.source==="model"?"خطة مقترحة من النموذج. لم تنفّذ أي خطوة.":"خطة محلية. لم يُرسل وصف المهمة إلى أي خادم.","ok");if(window.STAR_VAULT)window.STAR_VAULT.saveResearch(p.summary,JSON.stringify(p));}
function localPlan(){const objective=$("p3Objective").value.trim();if(objective.length<8){state("p3Notice","اكتب مهمة لا تقل عن 8 أحرف.","err");return}setPlan({summary:objective.slice(0,350),source:"template",steps:types[category(objective)].map(([title,detail,verify])=>({title,detail,verify,done:false}))});}
function parseProposal(raw){
 let str=String(raw||"").trim();const a=str.indexOf("{"),b=str.lastIndexOf("}");if(a<0||b<=a)throw Error("لم يُرجع النموذج خطة JSON قابلة للقراءة.");
 let data;try{data=JSON.parse(str.slice(a,b+1));}catch{throw Error("خطة النموذج ليست JSON صالحاً. جرب التخطيط المحلي.");}
 if(!Array.isArray(data.steps))throw Error("لا توجد خطوات صالحة في الاستجابة.");
 const steps=data.steps.slice(0,7).filter(s=>s&&typeof s.title==="string"&&s.title.trim()).map(s=>({title:s.title.slice(0,100),detail:String(s.detail||"").slice(0,800),verify:String(s.verify||"مراجعة يدوية").slice(0,300),done:false}));
 if(steps.length<3)throw Error("الخطة المقترحة غير مكتملة.");
 return {summary:String(data.summary||"خطة مقترحة").slice(0,350),steps,source:"model"};
}
async function aiPlan(){
 if(working)return;const objective=$("p3Objective").value.trim();
 if(objective.length<8||objective.length>2000){state("p3Notice","وصف المهمة يجب أن يكون بين 8 و2000 حرف.","err");return}
 if(typeof mode==="undefined"||mode!=="power"){state("p3Notice","اختر POWER · Cloud لإرسال وصف المهمة إلى النموذج السحابي.","err");return}
 working=true;$("p3AiPlan").disabled=true;$("p3LocalPlan").disabled=true;
 state("p3Notice","جارٍ طلب خطة من النموذج السحابي. لا ينفذ هذا الطلب أية كتابة.");
 const prompt="أنت مهندس تخطيط، وليس منفذ عمليات. أرجع JSON صالحاً فقط بلا Markdown بالبنية التالية: "+JSON.stringify({summary:"ملخص",steps:[{title:"عنوان",detail:"تفاصيل خطوة",verify:"دليل تحقق"}]})+". اقترح 4-6 خطوات دقيقة ولا تدّع تنفيذ عمليات. أي كتابة أو نشر يستلزم موافقة المالك. وصف المهمة:\n"+objective;
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),60000);
 try{
  const token=sessionStorage.getItem("starToken")||"",headers={"Content-Type":"application/json"};
  if(token)headers.Authorization="Bearer "+token;
  const res=await fetch("/api/chat",{method:"POST",headers,body:JSON.stringify({prompt}),cache:"no-store",signal:c.signal});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(res.status===401?"تسجيل دخول المالك مطلوب.":data.error||"HTTP "+res.status);
  setPlan(parseProposal(data.content));
 }catch(ex){state("p3Notice",ex.name==="AbortError"?"انتهت مهلة طلب الخطة":ex.message,"err")}
 finally{clearTimeout(timer);working=false;$("p3AiPlan").disabled=false;$("p3LocalPlan").disabled=false;}
}
function render(){
 const root=$("p3Steps");root.replaceChildren();if(!plan)return;state("p3PlanSummary",plan.summary);
 plan.steps.forEach((s,i)=>{
 const wrap=document.createElement("article");wrap.className="p3-step"+(s.done?" done":"");
 const head=document.createElement("div");head.className="p3-stephead";
 const num=document.createElement("span");num.className="p3-number";num.textContent=String(i+1).padStart(2,"0");
 const label=document.createElement("strong");label.textContent=s.title;
 const status=document.createElement("span");status.className="p3-status";status.textContent=s.done?"✓ راجعتها":"غير مراجعة";
 head.append(num,label,status);
 const detail=document.createElement("p");detail.className="p3-detail";detail.textContent=s.detail;
 const verify=document.createElement("p");verify.className="p3-verify";verify.textContent="التحقق: "+s.verify;
 const buttons=document.createElement("div");buttons.className="p3-steptools";
 const stage=document.createElement("button");stage.className="p3-button";stage.type="button";stage.textContent="↗ تحضير بالمحادثة";
 stage.addEventListener("click",()=>{
  $("prompt").value=("ساعدني في الخطوة "+(i+1)+": "+s.title+"\n"+s.detail+"\nمعيار التحقق: "+s.verify+"\nاقترح الإجراء فقط، ولا تدّع التنفيذ.").slice(0,5800);
  $("prompt").focus();$("p2ConsoleAnchor")?.scrollIntoView({behavior:"smooth",block:"start"});
  state("p3Notice","الخطوة جاهزة للمراجعة؛ اضغط إرسال بنفسك إذا أردت.","ok");
 });
 const mark=document.createElement("button");mark.className="p3-button";mark.type="button";mark.textContent=s.done?"↺ إلغاء مراجعتها":"✓ تمت المراجعة";
 mark.addEventListener("click",()=>{s.done=!s.done;render()});
 buttons.append(stage,mark);wrap.append(head,detail,verify,buttons);root.append(wrap);
 });
 const count=plan.steps.filter(s=>s.done).length;$("p3ProgressFill").style.width=(count*100/plan.steps.length)+"%";
 state("p3ProgressLabel",count+" / "+plan.steps.length+" تمت مراجعتها يدوياً");
}
function exportPlan(){
 if(!plan){state("p3Notice","أنشئ خطة أولاً.","err");return}
 const text=["STAR COMMANDER · MISSION PLAN",plan.summary,"",...plan.steps.map((s,i)=>(i+1)+". "+s.title+"\n"+s.detail+"\nتحقق: "+s.verify+"\nراجعها المالك: "+(s.done?"نعم":"لا"))].join("\n");
 const u=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
 const a=document.createElement("a");a.href=u;a.download="STAR-COMMANDER-plan.txt";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
 state("p3Notice","صدّرت الخطة إلى ملف نصي.","ok");
}
async function diagnostics(){
 $("p3Scan").disabled=true;state("p3Notice","جاري فحص الحالة...");
 const start=performance.now();state("p3Api","جارٍ الفحص");state("p3Github","جارٍ الفحص");
 try{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),13000);let r;
  try{r=await fetch("/api/health",{cache:"no-store",signal:c.signal})}finally{clearTimeout(t)}
  if(!r.ok)throw Error("API HTTP "+r.status);
  const d=await r.json();state("p3Api",d.ok&&d.ai_gateway?"الإعدادات جاهزة":"غير مهيأ",d.ok&&d.ai_gateway?"ok":"err");
  state("p3Delay",Math.round(performance.now()-start)+"ms API");state("p3Model",d.ai_model||"غير محدد");
 }catch{state("p3Api","تعذر الاتصال","err");state("p3Delay","—");state("p3Model","—")}
 const admin=$("p2AdminToken")?.value.trim()||"";
 { // Verified owner cookie permits read-only GitHub status with no additional token.
  const c=new AbortController(),t=setTimeout(()=>c.abort(),13000);
  try{
   const r=await fetch("/api/github/status",{headers:admin.length>=32?{Authorization:"Bearer "+admin}:{},credentials:"same-origin",cache:"no-store",signal:c.signal});const d=await r.json().catch(()=>({}));
   state("p3Github",r.ok&&d.installation_authenticated?"GitHub متصل":"الاتصال غير مؤكد",r.ok&&d.installation_authenticated?"ok":"err");
  }catch{state("p3Github","تعذر الاتصال","err")}finally{clearTimeout(t)}
 }
 state("p3Notice","انتهى الفحص. جاهزية الإعدادات لا تثبت نجاح توليد إجابة.","ok");$("p3Scan").disabled=false;
}
const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
function mic(){
 if(!Recognizer){state("p3VoiceNote","ميزة إملاء المتصفح غير مدعومة. استخدم ميكروفون لوحة مفاتيح الآيفون.","err");return}
 if(recognizer){recognizer.stop();return}
 try{
  recognizer=new Recognizer();recognizer.lang="ar-IQ";recognizer.continuous=false;recognizer.interimResults=false;
  recognizer.onresult=event=>{
   const text=event.results?.[0]?.[0]?.transcript||"";
   if(text){const p=$("prompt");p.value=(p.value.trim()?p.value.trim()+" ":"")+text;p.focus();state("p3VoiceNote","تم وضع النص في المحادثة، ولم يُرسل إلى STAR.","ok");}
  };
  recognizer.onerror=event=>state("p3VoiceNote","فشل التعرف الصوتي: "+(event.error||"غير معروف"),"err");
  recognizer.onend=()=>{recognizer=null;$("p3Voice").textContent="🎙 إملاء"};
  recognizer.start();$("p3Voice").textContent="■ إيقاف";state("p3VoiceNote","الميكروفون نشط. قد يستخدم المتصفح خدمات تعرف صوتي خارجية؛ لا يرسل STAR الرسالة تلقائياً.");
 }catch(ex){recognizer=null;state("p3VoiceNote",ex.message,"err")}
}
function readLast(){
 if(!("speechSynthesis" in window)){state("p3VoiceNote","النطق غير مدعوم.","err");return}
 const rows=document.querySelectorAll("#messages .message.assistant");
 const txt=rows.length?rows[rows.length-1].lastElementChild?.textContent||"":"";
 if(!txt){state("p3VoiceNote","لا توجد إجابة لقراءتها.","err");return}
 speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(txt.slice(0,2100));utterance.lang="ar-IQ";utterance.rate=.95;speechSynthesis.speak(utterance);
 state("p3VoiceNote","بدأ نطق الرد باستخدام خدمة الجهاز.","ok");
}
$("p3LocalPlan").addEventListener("click",localPlan);
$("p3AiPlan").addEventListener("click",aiPlan);
$("p3Export").addEventListener("click",exportPlan);
$("p3Scan").addEventListener("click",diagnostics);
$("p3Voice").addEventListener("click",mic);
$("p3Speak").addEventListener("click",readLast);
$("p3StopAudio").addEventListener("click",()=>{if(recognizer)recognizer.stop();if("speechSynthesis" in window)speechSynthesis.cancel();state("p3VoiceNote","أوقفت الصوت.","ok");});
state("p3VoiceNote",Recognizer?"الإملاء اختياري ويحتاج إذن الميكروفون.":"قد لا يدعم iOS هذه الواجهة؛ استخدم ميكروفون لوحة المفاتيح.");
state("p3Notice","ضع وصف مهمتك، ثم اختر التخطيط المحلي أو خطة سحابية مقترحة.");
})();