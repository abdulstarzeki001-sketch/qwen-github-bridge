import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/[[path]].js";
import { wormgptConfigured, wormgptEndpoint } from "../functions/_wormgpt.js";
globalThis.crypto ||= webcrypto;

const origin = "https://star-cyber-ai-x.pages.dev";
const owner = "s".repeat(64), backend = "b".repeat(64);
const endpoint = "https://inference.example.org/v1/chat/completions";
const env = {
  STAR_AI_PROVIDER: "wormgpt",
  STAR_API_TOKEN: owner,
  STAR_WORMGPT_URL: endpoint,
  STAR_WORMGPT_TOKEN: backend,
  STAR_WORMGPT_MODEL: "reviewed-wormgpt-model",
  STAR_ALLOWED_MODELS: "reviewed-wormgpt-model,reviewed-wormgpt-model-v2"
};
const call = (body, auth = true, environment = env) => onRequest({
  env: environment,
  request: new Request(origin + "/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json", Origin: origin, ...(auth ? {Authorization: "Bearer " + owner} : {})},
    body: JSON.stringify(body)
  })
});
assert.equal(wormgptEndpoint({...env, STAR_WORMGPT_URL: "http://localhost/v1/chat/completions"}), null);
assert.equal(wormgptEndpoint({...env, STAR_WORMGPT_URL: "https://127.0.0.1/v1/chat/completions"}), null);
assert.equal(wormgptEndpoint({...env, STAR_WORMGPT_URL: "https://user:pass@host.example.org/v1/chat/completions"}), null);
assert.equal(wormgptEndpoint({...env, STAR_WORMGPT_URL: "https://host.example.org/v1/chat/completions?key=secret"}), null);
assert.equal(wormgptEndpoint({...env, STAR_WORMGPT_URL: "https://host.example.org/other"}), null);
assert.equal(wormgptConfigured({...env, STAR_WORMGPT_TOKEN: "short"}), false);
assert.equal(wormgptConfigured(env), true);

let res = await call({prompt:"Hello"},false);
assert.equal(res.status,401,"Must be owner-authenticated");
res = await call({prompt:"Hello"},true,{...env,STAR_WORMGPT_TOKEN:""});
assert.equal(res.status,503,"Incomplete provider config should not use a fallback");
res = await call({prompt:"Hello", model:"other-model"});
assert.equal(res.status,400,"Only server-allowlisted model overrides are permitted");

const original = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  assert.equal(url,endpoint);
  assert.equal(options.headers.Authorization,"Bearer "+backend);
  calls.push(JSON.parse(options.body));
  return Response.json({model: "reviewed-wormgpt-model", choices: [{message:{content:"Review complete"}}]});
};
try {
  res = await call({prompt:"Authorization: Bearer private-secret\nReview this."});
  assert.equal(res.status,200);
  const output = await res.json();
  assert.equal(output.provider,"wormgpt");
  assert.equal(output.content,"Review complete");
  assert.equal(calls[0].model,"reviewed-wormgpt-model");
  assert.ok(!JSON.stringify(calls[0]).includes("private-secret"),"Prompt credentials are redacted");
  assert.ok(!JSON.stringify(output).includes(backend),"Provider token never appears in response");
  res = await call({prompt:"Second", model:"reviewed-wormgpt-model-v2"});
  assert.equal(res.status,200);
  assert.equal(calls[1].model,"reviewed-wormgpt-model-v2");

  const health = await onRequest({env,request:new Request(origin+"/api/health")});
  const healthJson = await health.json();
  assert.equal(healthJson.ai_provider,"wormgpt");
  assert.equal(healthJson.ai_gateway,true);
  assert.equal(healthJson.ai_model,"reviewed-wormgpt-model");
  assert.equal(JSON.stringify(healthJson).includes(backend),false);
} finally { globalThis.fetch = original; }
console.log("WormGPT-compatible provider tests passed");
