import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import {onRequest} from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const src=readFileSync(new URL("../web/star-knowledge-core.js",import.meta.url),"utf8");
const ctx={window:{}};
vm.runInNewContext(src,ctx);
const core=ctx.window.STAR_KNOWLEDGE_CORE;
assert.ok(core,"Knowledge retrieval core should initialize");
const rows=[
 {id:"knowledge-document-one-0",kind:"research",payload:{source_type:"knowledge",document_id:"document-one",title:"OWASP validation notes",part:0,body:"Input validation should reject unexpected fields. Validate bearer token before protected security operations. Prevent XSS injection by escaping rendered values."}},
 {id:"knowledge-document-two-0",kind:"research",payload:{source_type:"knowledge",document_id:"document-two",title:"REST API migration notes",part:0,body:"PostgreSQL stores transaction records. API server handles database errors."}},
 {id:"research-not-document",kind:"research",payload:{title:"A prior assistant plan",body:"Bearer token validation should never be confused with a genuine document."}}
];
let hits=core.search(rows,"كيف نراجع bearer token validation?",4);
assert.ok(hits.length,"Find relevant documents");
assert.equal(hits[0].documentId,"document-one");
assert.match(hits[0].excerpt,/bearer token/i);
assert.ok(hits.every(h=>h.documentId!=="research-not-document"),"Prior assistant plans cannot masquerade as document evidence");
assert.equal(hits[0].ref,"K1");
const safe=core.augment("اشرح bearer token validation",rows);
assert.equal(safe.grounded,true);
assert.match(safe.prompt,/\[K1\]/);
assert.match(safe.prompt,/OWASP validation notes/);
assert.ok(!safe.prompt.includes("prior assistant plan"));
assert.equal(core.augment("كيف طبخ الأرز؟",rows).grounded,false,"Irrelevant docs should not be inserted");
assert.ok(core.tokenize("التحقق التحقق من auth").length<4);
const long=core.augment("x".repeat(4900),rows,4900);
assert.equal(long.grounded,false,"Large prompt must not exceed provider budget");
const html=readFileSync(new URL("../web/ai-v2.html",import.meta.url),"utf8");
for(const name of ["star-knowledge.js","star-knowledge-core.js","star-knowledge.css","STAR_KNOWLEDGE?.augment"])
 assert.ok(html.includes(name),"Missing integration "+name);
const ui=readFileSync(new URL("../web/star-knowledge.js",import.meta.url),"utf8");
for(const name of ["knowledgeImport","knowledgeInclude","knowledgeList","knowledgePreview","knowledgeStatus","getDocument"])
 assert.ok(ui.includes(name),"Missing knowledge UI element "+name);
assert.ok(ui.includes("cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/"),"Pin the PDF parser");
assert.ok(ui.includes("panel.hidden=true"),"Private document library must start hidden");
assert.ok(ui.includes('fetch("/api/auth/session"'),"Owner authorization must gate library controls");
assert.ok(html.includes("window.STAR_KNOWLEDGE.authorize()"),"Owner activation must unlock library");
const vault=readFileSync(new URL("../web/star-vault.js",import.meta.url),"utf8");
for(const name of ["saveKnowledgeDocument","knowledgeItems","deleteKnowledgeDocument","knowledgeDocuments"])
 assert.ok(vault.includes(name),"Missing vault document API "+name);
const headers=readFileSync(new URL("../web/_headers",import.meta.url),"utf8");
assert.match(headers,/https:\/\/cdnjs.cloudflare.com/);
assert.match(headers,/worker-src 'self' blob:/);

const origin="https://star-cyber-ai-x.pages.dev",ownerToken="T".repeat(64),env={
 STAR_API_TOKEN:ownerToken,OPENROUTER_API_KEY:"fake-provider-key",STAR_CLOUDFLARE_MODEL:"nvidia/nemotron-3-ultra-550b-a55b:free"
};
let sent=null,requests=0;
const original=globalThis.fetch;
globalThis.fetch=async(u,opts)=>{
 requests++;sent=JSON.parse(opts.body);
 return Response.json({choices:[{message:{content:"Authenticated answer [K1]"}}],model:sent.model});
};
try{
 const req=(auth,prompt)=>new Request(origin+"/api/chat",{method:"POST",headers:{
   "Content-Type":"application/json",Origin:origin,...(auth?{Authorization:"Bearer "+ownerToken}:{})
  },body:JSON.stringify({prompt})});
 let response=await onRequest({request:req(false,safe.prompt),env});
 assert.equal(response.status,401);assert.equal(requests,0);
 response=await onRequest({request:req(true,safe.prompt),env});
 assert.equal(response.status,200);
 assert.ok(sent.messages[1].content.includes("[K1]"));
 assert.match(sent.messages[0].content,/untrusted reference data/);
 assert.equal(requests,1);
 console.log("STAR Knowledge tests passed: owner auth, grounded citations, PDF UI, prompt budget and document isolation.");
}finally{globalThis.fetch=original}
