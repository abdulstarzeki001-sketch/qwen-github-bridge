/* STAR Knowledge: owner-only document upload, retrieval and source preview. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const PDF_MODULE="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const MAX_BYTES=2*1024*1024,MAX_CHARS=180000;
let lastSources=[],busy=false;
const vault=()=>window.STAR_VAULT,engine=()=>window.STAR_KNOWLEDGE_CORE;
const ext=name=>String(name).split(".").pop().toLowerCase();
const SUPPORTED=new Set(["txt","text","md","markdown","json","js","jsx","ts","tsx","py","go","rs","java","c","cpp","h","sh","yaml","yml","xml","html","css","csv","log","sql","ini","toml","env","pdf"]);
function status(value,isError=false){const n=$("knowledgeStatus");if(n){n.textContent=value;n.dataset.error=isError?"yes":"no"}}
function docs(){return vault()?.knowledgeDocuments?.()||[]}
function rows(){return vault()?.knowledgeItems?.()||[]}
function enabled(){try{return localStorage.getItem("starKnowledgeInclude")!=="no"}catch{return true}}
async function parsePdf(file){
 status("جارٍ استخراج نص PDF داخل المتصفح…");
 // Pinned PDF.js module; parsing occurs in the browser, not on a remote PDF-processing API.
 const pdfjs=await import(PDF_MODULE);
 pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
 const raw=new Uint8Array(await file.arrayBuffer());
 const task=pdfjs.getDocument({data:raw,disableFontFace:true});
 let document;
 try{
  document=await task.promise;
  if(document.numPages>120)throw Error("الملف يتجاوز 120 صفحة. قسمه إلى ملفات أصغر.");
  const pages=[];
  for(let i=1;i<=document.numPages;i++){
   const page=await document.getPage(i),content=await page.getTextContent();
   const text=content.items.map(x=>x.str||"").join(" ").trim();
   if(text)pages.push("[صفحة "+i+"]\n"+text);
   if(pages.reduce((n,x)=>n+x.length,0)>MAX_CHARS)
     throw Error("النص المستخرج أكبر من الحد المسموح. قسم PDF إلى أجزاء.");
  }
  const text=pages.join("\n\n").trim();
  if(!text)throw Error("لا يوجد نص قابل للاستخراج. ملف PDF الممسوح ضوئيًا يحتاج OCR (غير مدعوم هنا).");
  return text;
 }finally{if(document)await document.destroy().catch(()=>{});else await task.destroy().catch(()=>{})}
}
async function readFile(file){
 if(!file||file.size>MAX_BYTES)throw Error("حجم الملف يتجاوز 2MB. قسمه إلى ملفات أصغر.");
 const ending=ext(file.name);
 if(!SUPPORTED.has(ending))throw Error("صيغة غير مدعومة: "+ending);
 let content=ending==="pdf"?await parsePdf(file):await file.text();
 if(ending==="json"){try{JSON.parse(content)}catch{throw Error("ملف JSON غير صالح. صحح الصيغة قبل رفعه.");}}
 if(!content.trim())throw Error("الملف لا يحتوي على نص قابل للحفظ.");
 if(content.length>MAX_CHARS)throw Error("الحد الأقصى 180 ألف حرف لكل ملف.");
 return content;
}
function refresh(){
 const list=$("knowledgeList");
 if(!list)return;
 list.replaceChildren();
 const all=docs();
 $("knowledgeCount").textContent=all.length+" ملف";
 if(!all.length){const hint=document.createElement("p");hint.textContent="لم تضف أي ملف بعد. اختر TXT أو JSON أو كودًا أو PDF يحتوي نصًا.";list.append(hint);return}
 for(const doc of all.slice(0,100)){
  const line=document.createElement("div");line.className="knowledge-row";
  const info=document.createElement("div");info.className="knowledge-rowinfo";
  const name=document.createElement("strong");name.textContent=doc.title;
  const detail=document.createElement("span");detail.textContent=doc.format.toUpperCase()+" · "+doc.parts.length+" جزء · "+doc.bytes.toLocaleString("en-US")+" حرف";
  info.append(name,detail);
  const preview=document.createElement("button");preview.type="button";preview.textContent="عرض";
  preview.addEventListener("click",()=>{
   const modal=$("knowledgePreview");
   $("knowledgePreviewTitle").textContent=doc.title;
   $("knowledgePreviewText").textContent=doc.parts.map(x=>x.body).join("").slice(0,40000);
   if(typeof modal.showModal==="function")modal.showModal();else modal.hidden=false;
  });
  const del=document.createElement("button");del.type="button";del.className="knowledge-del";del.textContent="حذف";
  del.addEventListener("click",async()=>{
   if(!confirm("حذف ملف «"+doc.title+"» من مكتبة المعرفة؟"))return;
   del.disabled=true;
   try{await vault().deleteKnowledgeDocument(doc.id);status("تم حذف الملف من المكتبة على هذا الجهاز، ومن الخادم إذا كانت المزامنة مفعّلة.");refresh()}
   catch(err){status("تعذر حذف الملف: "+err.message,true)}
   finally{del.disabled=false}
  });
  line.append(info,preview,del);list.append(line);
 }
}
function updateSources(list){
 const root=$("knowledgeSources");if(!root)return;
 root.replaceChildren();
 if(!list.length)return;
 const label=document.createElement("strong");label.textContent="المقاطع التي أُرسلت للنموذج كمراجع (وليست أدلة على صحة الإجابة):";
 root.append(label);
 for(const s of list){
  const row=document.createElement("p");
  row.textContent="["+s.ref+"] "+s.title+" · جزء "+s.part+" — "+s.excerpt.slice(0,130);
  root.append(row);
 }
}
function augment(question){
 lastSources=[];
 if(!enabled()||!vault()?.knowledgeItems){updateSources([]);return question;}
 const result=engine()?.augment(question,rows(),4900);
 if(!result){updateSources([]);return question;}
 lastSources=result.hits;
 updateSources(lastSources);
 return result.prompt;
}
async function importSelected(file){
 if(busy)return;busy=true;$("knowledgeImport").disabled=true;
 try{
  const content=await readFile(file);
  const id=await vault().saveKnowledgeDocument(file.name,content,ext(file.name));
  status("✓ أُضيف "+file.name+" إلى مكتبة المعرفة. سيُستخدم في الإجابات ذات الصلة.");
  $("knowledgeFile").value="";
  refresh();return id;
 }catch(err){status("تعذر الاستيراد: "+err.message,true)}
 finally{busy=false;$("knowledgeImport").disabled=false}
}
async function authorize(){
 const panel=$("knowledgePanel");if(!panel)return;
 panel.hidden=true;
 try{const response=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
   panel.hidden=!response.ok;
   if(response.ok)refresh();
 }catch{panel.hidden=true}
}
function lock(){const panel=$("knowledgePanel");if(panel)panel.hidden=true}
function mount(){
 if($("knowledgePanel")||!$("form"))return;
 const panel=document.createElement("section");panel.className="knowledge-panel";panel.id="knowledgePanel";
 panel.hidden=true;
 panel.innerHTML='<div class="knowledge-head"><strong>▣ STAR KNOWLEDGE · مكتبة المعرفة</strong><span id="knowledgeCount">0 ملف</span></div>'+
 '<p class="knowledge-help">أضف مراجعك الخاصة: PDF النصي أو TXT أو JSON أو ملفات كود. البحث في الملفات محلي، ويُرسل فقط المقطع المرتبط بالسؤال إلى مزود الذكاء عند تفعيل الخيار أدناه.</p>'+
 '<div class="knowledge-import"><input type="file" id="knowledgeFile" accept=".pdf,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.c,.cpp,.h,.sh,.yaml,.yml,.xml,.html,.css,.csv,.log,.sql,.ini,.toml,.env" aria-label="اختيار ملف معرفة"><button type="button" id="knowledgeImport">إضافة الملف</button></div>'+
 '<label class="knowledge-opt"><input type="checkbox" id="knowledgeInclude"> استخدم المقاطع ذات الصلة من ملفاتي عند الإجابة</label>'+
 '<p class="knowledge-help">لا تضف كلمات مرور أو مفاتيح API. PDF الممسوح ضوئيًا يحتاج OCR وغير مدعوم في هذه المرحلة. الحفظ على الجهاز يعمل تلقائيًا؛ المزامنة بين الأجهزة تتطلب تفعيل Supabase في إعدادات الخادم.</p>'+
 '<p class="knowledge-status" id="knowledgeStatus" role="status" aria-live="polite"></p>'+
 '<div id="knowledgeList" class="knowledge-list"></div><div id="knowledgeSources" class="knowledge-sources"></div>'+
 '<dialog id="knowledgePreview" class="knowledge-dialog"><h3 id="knowledgePreviewTitle"></h3><pre id="knowledgePreviewText"></pre><button type="button" id="knowledgeClose">إغلاق</button></dialog>';
 const target=$("vaultPanel")||document.querySelector(".v2-actionbar")||$("messages");
 target.parentNode.insertBefore(panel,target);
 $("knowledgeInclude").checked=enabled();
 $("knowledgeInclude").addEventListener("change",e=>{try{localStorage.setItem("starKnowledgeInclude",e.target.checked?"yes":"no")}catch{};status(e.target.checked?"تفعيل إرفاق مراجع مكتبتك مع الأسئلة المرتبطة.":"تم إيقاف إرسال مقاطع المعرفة إلى النموذج.")});
 $("knowledgeImport").addEventListener("click",()=>{const f=$("knowledgeFile").files?.[0];if(!f)return status("اختر ملفًا أولًا.",true);importSelected(f)});
 $("knowledgeClose").addEventListener("click",()=>{const m=$("knowledgePreview");if(typeof m.close==="function")m.close();else m.hidden=true});
 refresh();authorize();
}
window.STAR_KNOWLEDGE={augment,refresh,authorize,lock,sources:()=>lastSources.slice(),parsePdf};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();