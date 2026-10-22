/* STAR Hybrid: local Qwen first. Cloud requests require explicit owner approval. */
(function(root){
 "use strict";
 const STORAGE_KEY="star-hybrid-cloud-fallback-approved-v1";
 function loadConsent(storage){
   try{return storage.getItem(STORAGE_KEY)==="yes"}catch{return false}
 }
 function saveConsent(storage,enabled){
   try{if(enabled)storage.setItem(STORAGE_KEY,"yes");else storage.removeItem(STORAGE_KEY)}catch{}
 }
 async function run({mode,prompt,local,cloud,approveFallback}){
   if(mode==="power")return cloud(prompt,false);
   if(mode==="private")return local(prompt);
   if(mode!=="auto")throw Error("Unsupported inference route");
   try{
     return await local(prompt);
   }catch(error){
     // Crucial: no cloud fetch before an explicit decision.
     const consent=await approveFallback(error);
     if(consent!==true){
       const refused=Error("Qwen المحلي غير متصل؛ لم تُرسل رسالتك إلى السحابة لأن الموافقة غير مفعّلة.");
       refused.code="STAR_LOCAL_ONLY";
       throw refused;
     }
     const result=await cloud(prompt,true);
     return {...result,route:"HYBRID_CLOUD"};
   }
 }
 root.STAR_HYBRID={STORAGE_KEY,loadConsent,saveConsent,run};
})(typeof window!=="undefined"?window:globalThis);
