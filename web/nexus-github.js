// STAR NEXUS V4 GitHub Studio. Read-only browse and explicit stage-to-chat; no code execution.
(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const repo="abdulstarzeki001-sketch/qwen-github-bridge";
  const base="https://github.com/"+repo;
  let currentPath="",selected=null,working=false;
  const status=s=>{ $("gitNotice").textContent=s; };
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  async function get(url){
    const r=await fetch(url,{credentials:"same-origin",cache:"no-store"});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"HTTP "+r.status);
    return data;
  }
  function resetPreview(){
    selected=null;
    $("gitFileName").textContent="اختر ملفاً";
    $("gitFileSize").textContent="READ ONLY";
    $("gitFilePreview").textContent="اختر ملفاً من القائمة لعرض محتواه.";
    $("gitStage").disabled=true;
    $("gitOpenGithub").href=base;
  }
  async function connect(){
    if(working)return;
    status("جارٍ التحقق من GitHub App...");
    try{
      const data=await get("/api/github/status");
      $("gitRepo").textContent=data.repository||repo;
      $("gitBranch").textContent="الفرع: "+(data.default_branch||"main")+" · READ ONLY";
      await browse("");
    }catch(e){
      status("تعذر الوصول: "+e.message+" · تحقق من جلسة المالك وإعدادات GitHub App.");
      $("gitEntries").replaceChildren(make("p","tiny-muted","GitHub App غير متاح حالياً."));
    }
  }
  async function browse(path){
    if(working)return;
    working=true;status("جاري قراءة "+(path||"/")+" ...");
    try{
      const data=await get("/api/github/browse?path="+encodeURIComponent(path));
      currentPath=data.path||path;
      $("gitPath").textContent="/"+currentPath;
      $("gitUp").disabled=!currentPath;
      const rows=$("gitEntries");rows.replaceChildren();
      if(data.type==="directory"){
        resetPreview();
        const items=data.entries||[];
        items.sort((a,b)=>Number(b.type==="dir")-Number(a.type==="dir")||a.name.localeCompare(b.name));
        for(const item of items){
          if(item.type!=="dir"&&item.type!=="file")continue;
          const btn=make("button","studio-entry");btn.type="button";
          btn.append(make("span","studio-entry-icon",item.type==="dir"?"▣":"◇"),
            make("span","studio-entry-name",item.name),
            make("span","studio-entry-meta",item.type==="dir"?"DIR":Math.ceil((item.size||0)/1024)+"K"));
          btn.addEventListener("click",()=>browse(item.path));rows.append(btn);
        }
        if(!rows.childElementCount)rows.append(make("p","tiny-muted","هذا المجلد لا يحتوي ملفات قابلة للعرض."));
        status("تم استعراض "+items.length+" عنصراً. الملفات تُقرأ دون تعديل.");
      }else if(data.type==="file"){
        selected={path:data.path,content:data.content};
        $("gitFileName").textContent=data.path.split("/").at(-1);
        $("gitFileSize").textContent=(data.size||0)+" bytes";
        $("gitFilePreview").textContent=data.content;
        $("gitStage").disabled=false;
        $("gitOpenGithub").href=base+"/blob/main/"+data.path.split("/").map(encodeURIComponent).join("/");
        status("تم فتح الملف كنص فقط. اضغط «جهّز للتحليل» لمراجعة مقتطف منه.");
      }else throw Error("نوع الملف غير معروف");
    }catch(e){status("فشل استعراض الملفات: "+e.message);}
    finally{working=false;}
  }
  $("gitRefresh").addEventListener("click",connect);
  $("gitUp").addEventListener("click",()=>{
    if(!currentPath)return;
    const parent=currentPath.includes("/")?currentPath.slice(0,currentPath.lastIndexOf("/")):"";
    browse(parent);
  });
  $("gitStage").addEventListener("click",()=>{
    if(!selected)return;
    const input=$("chatInput");
    if(!input){status("نافذة المحادثة غير متاحة");return;}
    const excerpt=selected.content.slice(0,3400);
    input.value="راجع الكود التالي من مستودعي "+repo+" وأعطني الأخطاء والاقتراحات المحددة، دون تنفيذ تغييرات:\n\n"+
      "FILE: "+selected.path+"\n"+
      "\x60\x60\x60\n"+excerpt+"\n\x60\x60\x60";
    const tab=document.querySelector('.nav-item[data-view="chat"]')||
      document.querySelector('.mobile-dock [data-view="chat"]');
    tab?.click();input.focus();
  });
  // Fetch only when user explicitly opens this page.
  document.querySelectorAll('[data-view="github"],[data-go="github"]').forEach(button=>{
    button.addEventListener("click",()=>{if(!$("gitBranch").textContent.includes("READ ONLY"))connect();});
  });
})();
