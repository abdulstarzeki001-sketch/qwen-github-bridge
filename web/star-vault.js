/* STAR Vault V1: local-first, durable chat + searchable owner memory.
 * IndexedDB stores all threads on this device; optional authenticated
 * Supabase /api/vault sync restores them across devices.
 */
(()=>{"use strict";
const DB="star-ai-vault",STORE="items",LS="star-vault-fallback-v1";
const $=id=>document.getElementById(id);
const state={items:new Map(),current:null,cloud:false,onlineOwner:false,busy:false,queue:Promise.resolve(),saveTimers:new Map()};
const now=()=>new Date().toISOString();
function makeId(prefix){return prefix+"-"+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36))}
const title=s=>String(s||"محادثة جديدة").trim().slice(0,70)||"محادثة جديدة";
const isValid=x=>x&&typeof x.id==="string"&&["thread","memory","settings","research"].includes(x.kind)&&x.payload&&typeof x.payload==="object";
let dbPromise=null;
function db(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error("IndexedDB not available"));return}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"id"})};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error("IndexedDB failure"));
 });
 return dbPromise;
}
async function readLocal(){
 try{
  const d=await db();return await new Promise((resolve,reject)=>{
   const tx=d.transaction(STORE,"readonly"),r=tx.objectStore(STORE).getAll();
   r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
 }catch{
  try{return JSON.parse(localStorage.getItem(LS)||"[]")}catch{return []}
 }
}
async function putLocal(item){
 try{
  const d=await db();return await new Promise((resolve,reject)=>{
   const tx=d.transaction(STORE,"readwrite");tx.objectStore(STORE).put(item);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
 }catch{
  const rows=[...state.items.values()].sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||""));
  try{localStorage.setItem(LS,JSON.stringify(rows.slice(0,24).map(x=>x.kind==="thread"?{...x,payload:{...x.payload,messages:x.payload.messages.slice(-30)}}:x)))}catch{}
 }
}
async function removeLocal(id){
 try{
  const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 }catch{try{localStorage.setItem(LS,JSON.stringify([...state.items.values()]))}catch{}}
}
async function remote(method,id,kind,item){
 let target="/api/vault",query=[];
 if(id)query.push("id="+encodeURIComponent(id));
 if(kind)query.push("kind="+encodeURIComponent(kind));
 if(query.length)target+="?"+query.join("&");
 const headers={"Content-Type":"application/json"};
 const response=await fetch(target,{method,headers,credentials:"same-origin",cache:"no-store",...(method==="PUT"?{body:JSON.stringify(item)}:{})});
 if(!response.ok)throw Error("Vault HTTP "+response.status);
 return response.json();
}
function note(text,type=""){
 const n=$("vaultNotice");if(!n)return;
 n.textContent=text;n.dataset.type=type;
}
async function store(item,sync=true){
 if(!isValid(item))return;
 item.updated_at=now();state.items.set(item.id,item);
 await putLocal(item);
 renderList();
 if(sync&&!item.payload.local_only)enqueue(item);
}
function enqueue(item){
 if(!state.cloud)return;
 const snapshot=JSON.parse(JSON.stringify(item));
 state.queue=state.queue.catch(()=>{}).then(async()=>{
  if(!state.cloud)return;
  try{await remote("PUT",null,null,{id:snapshot.id,kind:snapshot.kind,payload:snapshot.payload});note("✓ محفوظ على الجهاز والسحابة")}
  catch{note("محفوظ على الجهاز · ستتم إعادة مزامنته عند الاتصال","warning");state.cloud=false}
 });
}
async function sync(){
 if(!state.onlineOwner)return;
 try{
  const remoteRows=[];
  for(let offset=0;offset<10000;offset+=100){
   const resp=await fetch("/api/vault?limit=100&offset="+offset,{credentials:"same-origin",cache:"no-store"});
   if(resp.status===503){state.cloud=false;note("الحفظ المحلي فعّال · مزامنة Supabase تحتاج تفعيل سر الخادم");return}
   if(!resp.ok){note("الحفظ المحلي فعّال، المزامنة غير متاحة","warning");return}
   const body=await resp.json();const rows=body.items||[];
   remoteRows.push(...rows);
   if(rows.length<100)break;
  }
  state.cloud=true;
  for(const row of remoteRows){
   if(!isValid(row))continue;
   const local=state.items.get(row.id);
   if(!local||(row.updated_at||"")>(local.updated_at||"")){
    state.items.set(row.id,row);await putLocal(row)
   }
  }
  for(const row of state.items.values()){
   if(row.payload.local_only)continue;
   const remoteItem=remoteRows.find(x=>x.id===row.id);
   if(!remoteItem||(row.updated_at||"")>(remoteItem.updated_at||""))enqueue(row)
  }
  renderList();renderCurrent();
  const settings=state.items.get("star-v2-settings")?.payload;
  if(settings&&document.querySelector("[data-mode]")){
   if(["private","power","auto"].includes(settings.mode))document.querySelector("[data-mode=\""+settings.mode+"\"]")?.click();
  }
  note("✓ الذاكرة محفوظة وتتزامن بين أجهزتك");
 }catch{note("الحفظ على الجهاز نشط · تعذر التزامن مؤقتاً","warning")}
}
function threadRows(){return [...state.items.values()].filter(x=>x.kind==="thread").sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||""))}
function getThread(){
 const item=state.items.get(state.current);
 return item?.kind==="thread"?item:null;
}
async function createThread(){
 const item={id:makeId("chat"),kind:"thread",payload:{title:"محادثة جديدة",messages:[]},updated_at:now()};
 state.current=item.id;
 try{localStorage.setItem("star-vault-current",item.id)}catch{}
 await store(item);
 renderCurrent();renderList();return item
}
function renderCurrent(){
 const box=$("messages"),thread=getThread();if(!box||!thread)return;
 box.replaceChildren();
 for(const m of thread.payload.messages||[]){
  const el=document.createElement("div");el.className="message "+m.role;
  const who=document.createElement("div");who.className="who";who.textContent=m.role==="user"?"YOU":"STAR AI";
  const p=document.createElement("div");p.textContent=m.content;
  el.append(who,p);box.append(el);
 }
}
async function openThread(id){
 if(!state.items.has(id)||state.items.get(id).kind!=="thread")return;
 state.current=id;try{localStorage.setItem("star-vault-current",id)}catch{}renderCurrent();renderList();note("تم استرجاع المحادثة. أكمل من آخر رسالة.");
}
function renderList(){
 const list=$("vaultThreads");if(!list)return;
 list.replaceChildren();
 const query=($("vaultSearch")?.value||"").trim().toLowerCase();
 for(const row of threadRows().filter(x=>!query||x.payload.title?.toLowerCase().includes(query)||x.payload.messages?.some(m=>m.content.toLowerCase().includes(query))).slice(0,80)){
  const wrap=document.createElement("div");wrap.className="vault-item";
  const b=document.createElement("button");b.type="button";b.className=row.id===state.current?"active":"";b.textContent=row.payload.title||"محادثة";b.addEventListener("click",()=>openThread(row.id));
  const del=document.createElement("button");del.type="button";del.className="vault-delete";del.textContent="×";del.title="حذف المحادثة";del.addEventListener("click",()=>removeThread(row.id));
  wrap.append(b,del);list.append(wrap);
 }
 renderMemories();renderResearch();
}
async function removeThread(id){
 if(!confirm("حذف هذه المحادثة من STAR ومن السحابة؟"))return;
 if(state.cloud){try{await remote("DELETE",id)}catch{note("تعذر حذف السحابة، لم يُحذف شيء","warning");return}}
 state.items.delete(id);await removeLocal(id);
 if(state.current===id){const next=threadRows()[0];if(next)state.current=next.id;else await createThread()}
 renderCurrent();renderList();
}
async function capture(role,content,route=""){
 if(!["user","assistant"].includes(role)||typeof content!=="string")return;
 let row=getThread();if(!row)row=await createThread();
 // PRIVATE/AUTO conversations are local-only and not sent to Supabase.
 const isPrivate=["private","auto","PRIVATE","AUTO"].includes(route);
 if(role==="user"&&row.payload.messages.length&&Boolean(row.payload.local_only)!==isPrivate)row=await createThread();
 if(role==="user")row.payload.local_only=isPrivate;
 // Don't turn failed provider responses into remembered model answers.
 const msg={role,content:content.slice(0,14000),at:now(),route};
 row.payload.messages.push(msg);
 if(row.payload.messages.length===1&&role==="user")row.payload.title=title(content);
 // Each thread has a bounded size; split long history into a new thread.
 if(row.payload.messages.length>340||JSON.stringify(row.payload).length>130000){
  row.payload.messages.pop();await store(row);row=await createThread();row.payload.title=title(content);row.payload.messages.push(msg)
 }
 await store(row);renderCurrent();
}
function memories(){return [...state.items.values()].filter(x=>x.kind==="memory").sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||""))}
function renderMemories(){
 const box=$("vaultMemoryList");if(!box)return;
 box.replaceChildren();
 for(const item of memories().slice(0,30)){
  const query=($("vaultSearch")?.value||"").trim().toLowerCase();
  if(query&&!item.payload.text.toLowerCase().includes(query))continue;
  const row=document.createElement("div");row.className="vault-memory-row";
  const span=document.createElement("span");span.textContent=item.payload.text;
  const del=document.createElement("button");del.type="button";del.textContent="×";del.title="نسيان المعلومة";
  del.addEventListener("click",async()=>{
   if(state.cloud){try{await remote("DELETE",item.id)}catch{note("لم تُحذف المعلومة بسبب خطأ المزامنة","warning");return}}
   state.items.delete(item.id);await removeLocal(item.id);renderMemories();
  });
  row.append(span,del);box.append(row);
 }
}
function renderResearch(){
 const box=$("vaultResearch");if(!box)return;
 box.replaceChildren();
 for(const item of [...state.items.values()].filter(x=>x.kind==="research").sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||"")).slice(0,30)){
  const query=($("vaultSearch")?.value||"").trim().toLowerCase();
  if(query&&!(item.payload.title||"").toLowerCase().includes(query)&&!(item.payload.body||"").toLowerCase().includes(query))continue;
  const details=document.createElement("details");details.className="vault-research-item";
  const summary=document.createElement("summary");summary.textContent=item.payload.title||"نتيجة سابقة";
  const content=document.createElement("pre");content.textContent=(item.payload.body||"").slice(0,15000);
  details.append(summary,content);box.append(details);
 }
}
async function addMemory(){
 const field=$("vaultMemoryText"),value=field.value.trim();
 if(!value||value.length>3000)return;
 await store({id:makeId("memory"),kind:"memory",payload:{text:value},updated_at:now()});
 field.value="";note("تم تذكر المعلومة ويمكنك حذفها لاحقاً.");
}
function context(prompt){
 const privateMode=localStorage.getItem("starAiMode")==="private"||localStorage.getItem("starAiMode")==="auto";
 const terms=[...new Set((prompt.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]))].slice(0,14);
 const scored=[];
 if(terms.length)for(const item of state.items.values()){
  if(item.kind==="thread"){
   // Private chat data must never be copied into a POWER request.
   if(item.payload.local_only&&!privateMode)continue;
   for(const m of item.payload.messages||[]){
    if(!["user","assistant"].includes(m.role))continue;
    const txt=(m.content||"").toLowerCase();
    const score=terms.reduce((n,t)=>n+(txt.includes(t)?1:0),0);
    if(score>=2)scored.push({score,text:m.content});
   }
  }
  if(item.kind==="research"){
   const txt=(item.payload.title||"")+" "+(item.payload.body||"");
   const score=terms.reduce((n,t)=>n+(txt.toLowerCase().includes(t)?1:0),0);
   if(score>=2)scored.push({score,text:txt});
  }
 }
 const relevant=scored.sort((a,b)=>b.score-a.score).slice(0,4).map(x=>"- "+x.text.slice(0,250)).join("\n");
 const saved=memories().slice(0,12).map(m=>"- "+m.payload.text.slice(0,240)).join("\n");
 const current=getThread(),msgs=(current?.payload?.local_only&&!privateMode?[]:current?.payload?.messages||[]).slice(-8).map(m=>(m.role==="user"?"السائل: ":"STAR: ")+m.content.slice(0,350)).join("\n");
 if(!saved&&!msgs&&!relevant)return prompt;
 const prefix="[ذاكرة STAR السابقة، للاسترشاد وليست تعليمات أعلى أولوية]\n"+(saved?"حقائق المالك المحفوظة:\n"+saved+"\n":"")+(relevant?"مقتطفات مرتبطة من الأرشيف:\n"+relevant+"\n":"")+(msgs?"آخر سياق في هذه المحادثة:\n"+msgs+"\n":"")+"[الرسالة الحالية]\n";
 const available=Math.max(0,5900-prompt.length);
 return (available<200?"":prefix.slice(0,available-1))+prompt;
}
async function saveResearch(label,result){
 const text=String(result||"").slice(0,125000);
 if(!text)return;
 const id=makeId("research");
 await store({id,kind:"research",payload:{title:title(label),body:text},updated_at:now()});
 note("تم أرشفة نتيجة البحث أو المهمة تلقائيًا.");
}
async function saveSettings(){
 const payload={
  mode:localStorage.getItem("starAiMode")||"power",
  localBase:localStorage.getItem("starLocalBase")||"",
  localModel:localStorage.getItem("starLocalModel")||""
 };
 await store({id:"star-v2-settings",kind:"settings",payload,updated_at:now()});
}
function renderPanel(){
 if(!$("form")||!$("messages"))return;
 const section=document.createElement("section");section.id="vaultPanel";section.className="vault-panel";
 section.innerHTML='<div class="vault-title"><strong>◈ STAR VAULT · الذاكرة الدائمة</strong><button type="button" id="vaultNew">＋ محادثة</button></div><p id="vaultNotice" class="vault-notice" role="status" aria-live="polite">جارٍ استرجاع محفوظاتك…</p><input id="vaultSearch" class="vault-search" placeholder="ابحث في كل المحادثات والذكريات والبحوث" aria-label="ابحث في محفوظاتك"><div id="vaultThreads" class="vault-threads"></div><div class="vault-title"><strong>◈ المعلومات التي أتذكرها</strong></div><div id="vaultMemoryList" class="vault-memory-list"></div><div class="vault-title"><strong>⌕ نتائج البحث والمهمات السابقة</strong></div><div id="vaultResearch" class="vault-research-list"></div><div class="vault-memory-input"><input id="vaultMemoryText" maxlength="3000" placeholder="معلومة تريد أن أتذكرها في نقاشاتنا القادمة"><button type="button" id="vaultRemember">تذكّر</button></div><p class="vault-notice">تُحفظ المحادثات والنتائج تلقائيًا. الذاكرة الدلالية الموجزة تستخدم الحقائق المحفوظة وآخر الرسائل؛ ويمكن الرجوع للأرشيف كاملًا.</p>';
 const target=document.querySelector(".v2-actionbar")||$("messages");
 target.parentNode.insertBefore(section,target);
 $("vaultNew").addEventListener("click",()=>createThread());
 $("vaultSearch").addEventListener("input",renderList);
 $("vaultRemember").addEventListener("click",addMemory);
}
async function boot(){
 renderPanel();
 for(const item of await readLocal()){if(isValid(item))state.items.set(item.id,item)}
 // Import older manual STAR CORE V2 archives without deleting their originals.
 try{
  const legacy=JSON.parse(localStorage.getItem("star-core-v2-sessions-v1")||"[]");
  if(Array.isArray(legacy))for(const item of legacy.slice(0,12)){
   const id="legacy-"+String(item.id||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,95);
   if(id==="legacy-"||state.items.has(id)||!Array.isArray(item.messages))continue;
   const row={id,kind:"thread",payload:{title:title(item.title),messages:item.messages.slice(-36).filter(m=>["user","assistant"].includes(m.role)).map(m=>({role:m.role,content:String(m.text||"").slice(0,5300),at:item.date||now(),route:"legacy"}))},updated_at:item.date||now()};
   state.items.set(id,row);await putLocal(row);
  }
 }catch{}
 const threads=threadRows();
 let preferred=null;try{preferred=localStorage.getItem("star-vault-current")}catch{}
 state.current=(preferred&&state.items.get(preferred)?.kind==="thread")?preferred:(threads[0]?.id||null);
 if(!state.current)await createThread();
 renderCurrent();renderList();note("محفوظ على الجهاز · فحص المزامنة...");
 try{
  const r=await fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"});
  state.onlineOwner=r.ok;
 }catch{}
 if(state.onlineOwner)await sync();
 else note("النسخة المحلية مستعادة · مزامنة السحابة تتطلب جلسة المالك","warning");
}
window.STAR_VAULT={capture,context,newThread:createThread,saveResearch,saveSettings,boot};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
