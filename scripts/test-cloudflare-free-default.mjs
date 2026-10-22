import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;

const base="https://star-cyber-ai-x.pages.dev";
const token="t".repeat(64);
let calls=[];
const env={
  STAR_API_TOKEN:token,
  AI:{async run(model,opts){calls.push({model,opts});return {response:"STAR responds from Workers AI"}}}
};
const req=(auth,prompt="Hello",extra={})=>new Request(base+"/api/chat",{method:"POST",headers:{"Origin":base,"Content-Type":"application/json",...(auth?{"Authorization":"Bearer "+token}:{})},body:JSON.stringify({prompt,...extra})});
let r=await onRequest({request:new Request(base+"/api/health"),env});
let health=await r.json();
assert.equal(r.status,200);
assert.equal(health.ai_gateway,true,"Live AI binding should be chosen with no external env secrets");
assert.equal(health.ai_model,"@cf/meta/llama-3.1-8b-instruct");
r=await onRequest({request:req(false),env});
assert.equal(r.status,401,"Anonymous users must never spend owner's free inference budget");
assert.equal(calls.length,0);
r=await onRequest({request:req(true,"Hello",{max_tokens:4096}),env});
assert.equal(r.status,200);let body=await r.json();
assert.equal(body.content,"STAR responds from Workers AI");
assert.equal(body.model,"@cf/meta/llama-3.1-8b-instruct");
assert.equal(calls[0].opts.max_tokens,512,"Constrain free-tier output size");
assert.equal(calls[0].model,health.ai_model);
r=await onRequest({request:req(true,"Hi",{model:"some-paid-model"}),env});
assert.equal(r.status,400,"Disallow selecting a paid/unlisted model");
assert.equal(calls.length,1);
const explicit={...env,STAR_AI_PROVIDER:"openrouter"};
r=await onRequest({request:new Request(base+"/api/health"),env:explicit});
assert.equal((await r.json()).ai_gateway,false,"Explicit OpenRouter choice must not silently spend another provider's allowance");
r=await onRequest({request:req(true),env:explicit});
assert.equal(r.status,503,"Preserve an explicitly configured provider even if key missing");
assert.equal(calls.length,1);
const unbound={STAR_API_TOKEN:token,OPENROUTER_API_KEY:"fake"};
r=await onRequest({request:new Request(base+"/api/health"),env:unbound});
assert.equal((await r.json()).ai_model,"nvidia/nemotron-3-ultra-550b-a55b:free","Retain old fallback when Workers AI is not bound");
console.log("STAR Workers AI free-default tests passed: binding autodetection, owner gate, fixed model, 512-token output limit and explicit provider precedence.");
