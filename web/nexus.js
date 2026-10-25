(()=>{"use strict";
const $=id=>document.getElementById(id), nav=[...document.querySelectorAll("[data-view]")];
const titles={overview:"لوحة القيادة",chat:"مركز المحادثة",models:"مختبر النماذج",agents:"الوكلاء والتكاملات",telegram:"Telegram Hub",github:"GitHub Studio",settings:"إعدادات المالك"};
const sources=[
{id:"open-interpreter",name:"Open Interpreter",repo:"openinterpreter/openinterpreter",type:"agent",desc:"محرك STAR الأساسي للتنفيذ والبرمجة عبر الطرفية. يعمل داخل حاوية معزولة ويتصل بنموذج Ollama المحلي؛ التنفيذ يتطلب موافقة.",icon:"⌘",status:"adapter",tech:"Rust CLI · Workspace sandbox · Ollama"},
{id:"wormxgpt",name:"WormXGPT",repo:"gaur-avvv/wormxgpt",type:"web",desc:"واجهة React متعددة النماذج ومفاهيم MCP. استفادت واجهة NEXUS من فكرة مركز الأدوات، دون تشغيل الحزمة الخارجية.",icon:"◈",status:"reference",tech:"React · Vite · MCP"},
{id:"xgpt",name:"XGPT-WormGPT",repo:"gaur-avvv/XGPT-WormGPT",type:"reference",desc:"ملفات تعليمات وأفكار مهارات نصية، وليست نموذج ذكاء أو API مستقل.",icon:"≋",status:"reference",tech:"Prompts · Skills"},
{id:"jailbreak",name:"WormGPT 4 (community)",repo:"jailbreakwormGPT/wormGPT",type:"reference",desc:"مشروع مجتمعي يستخدم اسم WormGPT؛ التثبيت الآلي لا يثبت وجود نموذج أصلي موثوق.",icon:"⊙",status:"reference",tech:"Python · Installer"},
{id:"worm-ai",name:"Worm-AI",repo:"0x6b6679/worm-ai",type:"reference",desc:"عميل Grok غير رسمي يحتوي ملفاً ثنائياً مموهاً. مرجع للبحث فقط.",icon:"⬡",status:"reference",tech:"Python · Unofficial"},
{id:"worm-gpt-old",name:"worm-gpt (archived)",repo:"0x6b6679/worm-gpt",type:"reference",desc:"المستودع مؤرشف ويشير إلى مشروع منقول؛ غير مناسب كأساس مباشر للتشغيل.",icon:"⌁",status:"archive",tech:"Archived · Reference"},
{id:"desktop",name:"WormGPT Desktop",repo:"cameleonnbss/WormGPT-desktop",type:"web",desc:"عميل سطح مكتب Windows بواجهة نماذج محلية؛ يمكن دراسة فكرته دون توزيع ملفات EXE.",icon:"▧",status:"reference",tech:"Windows · Python · llama.cpp"},
{id:"electron",name:"Worm-GPT Electron",repo:"lahirusanjika/Worm-GPT",type:"web",desc:"واجهة Electron + React تعتمد على Groq API، وليست نموذجاً مستقلاً.",icon:"▤",status:"reference",tech:"Electron · Groq"},
{id:"tg-jail",name:"WormGPT Telegram",repo:"jailideaid/WormGPT",type:"telegram",desc:"بوت Python مؤرشف يستخدم OpenRouter. يوجد بديل Telegram Cloudflare متصل بنموذج STAR.",icon:"➤",status:"adapter",tech:"Python · Telegram"},
{id:"tg-shah",name:"WormGPT Telegram fork",repo:"shahzadkhld/wormgpt",type:"telegram",desc:"بوت Telegram متعدد اللغات يستند إلى مزود استدلال خارجي؛ مرجع لبناء قناة موحدة.",icon:"➤",status:"reference",tech:"Telegram · OpenRouter"},
{id:"drana",name:"Drana-Infinity",repo:"IHA089/Drana-Infinity",type:"model",desc:"منظومة أمن سيبراني مع نماذج Ollama يمكن ربطها ببوابة الاستدلال الخاصة بـ STAR.",icon:"⬡",status:"adapter",tech:"Ollama · Python · Security"},
{id:"prith",name:"worm-gpt Web",repo:"prithwishpal/worm-gpt",type:"web",desc:"واجهة Streamlit وتكامل Telegram معلن؛ مناسبة كمصدر تصميم ومقارنة أساليب التشغيل.",icon:"▣",status:"reference",tech:"Streamlit · Python"},
{id:"father",name:"ChatGPT Telegram Bot",repo:"father-bot/chatgpt_telegram_bot",type:"telegram",desc:"مرجع لهندسة Telegram والتعامل مع الردود. STAR يستخدم Webhook مستقلاً لتوحيد النموذج.",icon:"➤",status:"adapter",tech:"Telegram · Python"},
{id:"wechat",name:"Multi-Channel Bot",repo:"wangrongding/wechat-bot",type:"telegram",desc:"مرجع لبنية البوتات متعددة القنوات؛ لم يتم تشغيل خدماته أو تسجيل أي حساب خارجي.",icon:"⌘",status:"reference",tech:"Multi-Channel · Integration"},
{id:"jura",name:"Worm-GPT EXE",repo:"JuraSecurity/Worm-GPT",type:"reference",desc:"نسخة تتضمن برنامج EXE غير مؤكد المصدر؛ أدرجت للمرجعية فقط ولم تُنقل ملفاتها التنفيذية.",icon:"▧",status:"reference",tech:"Windows EXE · Unverified"},
{id:"zxn",name:"WormGPT archives",repo:"MrZXN777/WormGPT-",type:"reference",desc:"أرشيفات ZIP لأنظمة مختلفة من دون مصدر واضح يمكن البناء عليه؛ مرجع تنزيلات فقط.",icon:"⌁",status:"reference",tech:"ZIP · Unknown binaries"},
{id:"wormgpt-ai",name:"WormGPT-AI",repo:"WormGPT-AI/WormGPT",type:"reference",desc:"مستودع ذو README فقط دون كود نموذج قابل للتشغيل وفق شجرة الملفات العامة.",icon:"≋",status:"reference",tech:"Readme only"}
];
const modelCards=[
{name:"Cloudflare Workers AI",tag:"CLOUDFLARE",id:"cloudflare",desc:"محرك الاستدلال الموجود في مشروع STAR. يعمل عند وجود AI Binding على حساب Cloudflare.",url:"https://developers.cloudflare.com/workers-ai/",symbol:"◉"},
{name:"Private Ollama",tag:"SELF-HOSTED",id:"selfhosted",desc:"نماذج Qwen وDrana وgpt-oss على خادم GPU خاص، خلف بوابة HTTPS محمية.",url:"https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/blob/main/deploy/independent-ai/README.md",symbol:"⬡"},
{name:"WormGPT-Compatible API",tag:"THIRD PARTY",id:"wormgpt",desc:"واجهة اختيارية في المشروع، تحتاج نموذجاً حقيقياً موثوقاً وAPI متوافقاً، ولا تتضمن WormGPT الأصلي.",url:"https://github.com/abdulstarzeki001-sketch/qwen-github-bridge/blob/main/docs/WORMGPT_INTEGRATION.md",symbol:"⌘"},
{name:"OpenAI",tag:"CLOUD API",id:"openai",desc:"مزوّد OpenAI المعتمد على مفتاح خادم خاص؛ لا تحفظ مفتاحك في Safari.",url:"https://platform.openai.com/docs",symbol:"✦"},
{name:"Anthropic",tag:"CLOUD API",id:"anthropic",desc:"تكامل خادم منفصل للعمل مع Claude من خلال Cloudflare.",url:"/sovereign.html",symbol:"◈"},
{name:"OpenRouter",tag:"MULTI MODEL",id:"openrouter",desc:"بوابة متعددة النماذج؛ تحتاج مفتاح خادم صالح أو إعداد مزود خاص.",url:"https://openrouter.ai/",symbol:"◇"}
];
let auth=false,health=null,status=null,busy=false,filter="all";
let history=[],prefs={owner_instructions:"",temperature:0.2,max_tokens:1400};
function setText(id,value){const e=$(id);if(e)e.textContent=value}
function openView(name){if(!titles[name])return;document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id==="view-"+name));nav.forEach(x=>x.classList.toggle("active",x.dataset.view===name));setText("crumb",titles[name]);document.title=titles[name]+" · STAR NEXUS";try{window.history.replaceState(null,"","#"+name)}catch{}window.scrollTo?.({top:0,behavior:"smooth"});if(name==="agents")renderSources();}
nav.forEach(x=>x.addEventListener("click",()=>openView(x.dataset.view)));
document.querySelectorAll("[data-go]").forEach(x=>x.addEventListener("click",()=>openView(x.dataset.go)));
function statusLabel(el,active,good,bad){const e=$(el);if(!e)return;e.textContent=active?good:bad;e.classList.toggle("bad",!active)}
async function readJson(response){const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||("HTTP "+response.status));return data}
async function api(path,options={}){return readJson(await fetch(path,{credentials:"same-origin",cache:"no-store",...options}));}
async function refresh(){let hasApi=false;
 try{health=await api("/api/health");hasApi=true;setText("metricModel",health.ai_model||"—");setText("metricProvider",health.ai_gateway?"مزود مهيأ":"المزود غير مهيأ");setText("metricProviderName",(health.ai_provider||"unknown").toUpperCase());setText("metricProviderDetail",health.ai_gateway?"جاهز للإعداد":"يحتاج تهيئة");setText("currentModelFull",health.ai_model||"غير معروف");setText("modelStatusText",health.ai_gateway?"تم التهيئة · يلزم اختبار استدلال فعلي":"لم تتم تهيئة النموذج");setText("chatModel",health.ai_model||"—");setText("tgProvider",health.ai_provider||"—");statusLabel("stateApi",true,"ONLINE","OFFLINE");statusLabel("stateModel",health.ai_gateway,"CONFIGURED","NOT CONFIGURED");}
 catch{statusLabel("stateApi",false,"ONLINE","OFFLINE");statusLabel("stateModel",false,"CONFIGURED","UNAVAILABLE");setText("sideStatus","تعذر الاتصال");}
 $("sidePulse").classList.toggle("off",!hasApi);if(hasApi)setText("sideStatus","API متصل");
 try{await api("/api/auth/session");auth=true;setText("ownerMini","الجلسة فعالة");setText("settingsSession","تم التحقق من جلسة المالك على هذا الجهاز.");statusLabel("stateAuth",true,"VERIFIED","LOCKED");$("settingsLogin").textContent="الجلسة فعالة ✓";}catch{auth=false;setText("ownerMini","يتطلب تسجيل المالك");setText("settingsSession","جلسة المالك غير مفعّلة. أدخل الرمز لتفعيل الجهاز.");statusLabel("stateAuth",false,"VERIFIED","LOCKED");$("settingsLogin").textContent="تفعيل هذا الجهاز ↗";}
 if(auth){try{status=await api("/api/nexus/status");statusLabel("stateTelegram",Boolean(status.telegram?.configured),"CONFIGURED","NOT CONFIGURED");setText("tgWebhook",status.telegram?.configured?"مهيأ · اختبر الرسائل":"غير مهيأ");}catch{status=null;statusLabel("stateTelegram",false,"CONFIGURED","NOT CONFIGURED");setText("tgWebhook","تعذر الفحص");}}
 else{status=null;statusLabel("stateTelegram",false,"CONFIGURED","مالك فقط");setText("tgWebhook","تسجيل المالك مطلوب");}
 renderModels();
 if(auth)await loadModelChoices();
 else {const menu=$("chatModelSelect");menu.replaceChildren(new Option("سجّل دخول المالك",""));menu.disabled=true;}
}
async function loadModelChoices(){
 const menu=$("chatModelSelect");
 const previous=menu.value;
 try{
   const data=await api("/api/nexus/models");
   menu.replaceChildren(new Option("الافتراضي: "+(data.default_model||"—"),""));
   for(const name of data.models||[]){
      if(name===data.default_model)continue;
      menu.add(new Option(name,name));
   }
   menu.disabled=!data.configured;
   if([...menu.options].some(option=>option.value===previous))menu.value=previous;
   setText("composeMode",data.configured?"MODEL SELECT READY":"PROVIDER NOT CONFIGURED");
 }catch{
   menu.disabled=true;
   menu.replaceChildren(new Option("تعذر تحميل النماذج",""));
 }
}
function makeEl(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function renderModels(){const out=$("modelGrid");out.replaceChildren();for(const m of modelCards){const ready=(health?.ai_provider||"")===m.id&&health?.ai_gateway;const card=makeEl("article","model-card");const top=makeEl("div","model-card-top");top.append(makeEl("span","model-symbol",m.symbol),makeEl("span","status-chip"+(ready?" ready":""),ready?"مزود مهيأ":"اختياري"));card.append(top,makeEl("h3","",m.name),makeEl("div","card-meta",m.tag),makeEl("p","",m.desc));const link=makeEl("a","","الوثائق والإعداد ↗");link.href=m.url;if(/^https:/.test(m.url)){link.target="_blank";link.rel="noopener noreferrer"}card.append(link);out.append(card)}}
function renderSources(){const q=$("sourceSearch").value.trim().toLowerCase();const out=$("sourceGrid");out.replaceChildren();const found=sources.filter(s=>(filter==="all"||s.type===filter)&&(!q||[s.name,s.repo,s.desc,s.tech].some(v=>v.toLowerCase().includes(q))));
 for(const s of found){const card=makeEl("article","registry-card"),top=makeEl("div","registry-card-top");top.append(makeEl("span","registry-symbol",s.icon),makeEl("span","status-chip",s.status==="archive"?"مؤرشف":s.status==="adapter"?"نقطة ربط":"مرجع"));card.append(top,makeEl("h3","",s.name),makeEl("div","source-kind",s.type.toUpperCase()+" · "+s.tech),makeEl("p","",s.desc));const link=makeEl("a","","افتح المستودع ↗");link.href="https://github.com/"+s.repo;link.target="_blank";link.rel="noopener noreferrer";card.append(link);out.append(card)}
 if(!found.length)out.append(makeEl("p","tiny-muted","لا توجد مصادر مطابقة."));setText("metricIntegrations",String(sources.length));
}
$("sourceSearch").addEventListener("input",renderSources);
document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("selected",x===btn));renderSources()}));
function displayBubble(role,text){const thread=$("chatThread");thread.querySelector(".chat-empty")?.remove();const el=makeEl("article","bubble "+(role==="user"?"you":"ai"));const title=makeEl("span","bubble-label",role==="user"?"YOU / OWNER":"STAR NEXUS / AI");el.append(title,document.createTextNode(text));thread.append(el);thread.scrollTop=thread.scrollHeight;}
function promptValue(){return $("chatInput").value.trim();}
async function chat(ev){ev?.preventDefault();const prompt=promptValue();if(!prompt||busy)return;if(!auth){setText("chatNotice","يجب تفعيل جلسة المالك قبل إرسال الطلب.");openAuth();return;}
 busy=true;$("chatSend").disabled=true;displayBubble("user",prompt);$("chatInput").value="";setText("chatNotice","جاري الاستدلال…");history.push({role:"user",content:prompt});try{
 const data=await api("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Origin":location.origin},body:JSON.stringify({prompt,history:history.slice(0,-1).slice(-8).map(m=>({role:m.role,content:m.content.slice(-700)})),model:$("chatModelSelect").value||undefined,owner_instructions:prefs.owner_instructions,temperature:prefs.temperature,max_tokens:prefs.max_tokens})});displayBubble("ai",data.content||"رد فارغ");history.push({role:"assistant",content:data.content||""});history=history.slice(-10);setText("chatNotice","تم · "+(data.model||"STAR MODEL")+" · سياق المحادثة مفعّل");}
 catch(e){displayBubble("ai","تعذر الحصول على رد: "+e.message);setText("chatNotice","فشل الاتصال بالنموذج");}finally{busy=false;$("chatSend").disabled=false;$("chatInput").focus();}}
$("chatForm").addEventListener("submit",chat);
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit();}});
document.querySelectorAll("[data-prompt]").forEach(btn=>btn.addEventListener("click",()=>{$("chatInput").value=btn.dataset.prompt;$("chatInput").focus()}));
$("clearChat").addEventListener("click",()=>{history=[];$("chatThread").replaceChildren();const empty=makeEl("div","chat-empty");empty.append(makeEl("span","chat-empty-icon","✳"),makeEl("h2","","محادثة جديدة"),makeEl("p","","اكتب طلباً جديداً لبدء الجلسة."));$("chatThread").append(empty);setText("chatNotice","مسحت الرسائل من واجهة الجلسة الحالية.");});
function openAuth(){$("authError").textContent="";$("authDialog").showModal();$("authToken").focus();}
$("openAuth").addEventListener("click",openAuth);$("settingsLogin").addEventListener("click",openAuth);$("closeAuth").addEventListener("click",()=>$("authDialog").close());
$("authForm").addEventListener("submit",async ev=>{ev.preventDefault();const token=$("authToken").value.trim();if(token.length<32){setText("authError","الرمز قصير جداً.");return;}const btn=$("authSubmit");btn.disabled=true;
 try{await api("/api/auth/remember",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Origin":location.origin},body:"{}"});$("authToken").value="";$("authDialog").close();await refresh();if(!auth)throw Error("لم تكتمل جلسة المالك");}
 catch(e){setText("authError","فشل الدخول: "+e.message);}finally{btn.disabled=false;}
});
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json","Origin":location.origin},body:"{}"});auth=false;await refresh();}catch(e){setText("settingsSession","فشل تسجيل الخروج: "+e.message);}});
$("refreshModels").addEventListener("click",refresh);
$("probeModels").addEventListener("click",async()=>{
  const btn=$("probeModels");btn.disabled=true;setText("modelStatusText","أفحص اتصال خادم الاستدلال...");
  try{
    const data=await api("/api/nexus/model-probe");
    setText("modelStatusText",data.checked?(data.reachable?"بوابة GPU متصلة · "+(data.model||"Model"):"تعذر الاتصال ببوابة GPU"):"لا يوجد خادم Ollama مستقل مهيأ");
  }catch(e){setText("modelStatusText","تعذر الفحص: "+e.message)}
  finally{btn.disabled=false;}
});
function loadPrefs(){try{const raw=JSON.parse(localStorage.getItem("star-nexus-prefs-v1")||"null");if(raw&&typeof raw==="object"){prefs.owner_instructions=String(raw.owner_instructions||"").slice(0,2000);const t=Number(raw.temperature);prefs.temperature=Number.isFinite(t)?Math.max(0,Math.min(1,t)):0.2;prefs.max_tokens=[512,1400,2048,4096].includes(Number(raw.max_tokens))?Number(raw.max_tokens):1400;}}catch{}$("ownerInstructions").value=prefs.owner_instructions;$("temperature").value=prefs.temperature;$("maxTokens").value=String(prefs.max_tokens);}
$("savePrefs").addEventListener("click",()=>{prefs={owner_instructions:$("ownerInstructions").value.slice(0,2000),temperature:Number($("temperature").value),max_tokens:Number($("maxTokens").value)};try{localStorage.setItem("star-nexus-prefs-v1",JSON.stringify(prefs));setText("prefsSaved","تم حفظ تعليمات المحادثة على هذا الجهاز فقط.");}catch{setText("prefsSaved","التخزين المحلي غير متاح.");}});
loadPrefs();renderSources();renderModels();try{const hash=location.hash.slice(1);if(titles[hash])openView(hash);}catch{}
refresh();
})();
