import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createGateway} from "../deploy/independent-ai/gateway.mjs";
import {verifyRunpod} from "./verify-runpod.mjs";

const config="deploy/independent-ai/runpod/model-config.sh";
function runConfig(model,allowlist){
  return spawnSync("bash",[config],{
    env:{...process.env,STAR_MODEL:model,STAR_ALLOWED_MODELS:allowlist},
    encoding:"utf8",timeout:3000
  });
}
let result=runConfig("gpt-oss:20b","gpt-oss:20b, qwen2.5-coder:7b, IHA089/drana-infinity-3b:3b");
assert.equal(result.status,0,result.stderr);
assert.deepEqual(result.stdout.trim().split("\n"),["gpt-oss:20b","qwen2.5-coder:7b","IHA089/drana-infinity-3b:3b"]);
for(const allow of [
 "qwen2.5-coder:7b",
 "gpt-oss:20b,gpt-oss:20b",
 "gpt-oss:20b,evil;echo-injection",
 ",gpt-oss:20b",
 "gpt-oss:20b,",
 "gpt-oss:20b,"+new Array(12).fill("other-model").map((x,i)=>x+i).join(",")
]){
  result=runConfig("gpt-oss:20b",allow);
  assert.notEqual(result.status,0,"Must reject invalid allowlist: "+allow);
}
result=runConfig("qwen2.5-coder:7b","qwen2.5-coder:7b");
assert.equal(result.status,0,result.stderr);

const token="Z".repeat(64),models=["gpt-oss:20b","qwen2.5-coder:7b"];
let upstreamCalls=0;
const gateway=createGateway({
  token,model:models[0],allowedModels:models,
  upstreamFetch:async (_url,opts)=>{
    upstreamCalls++;
    const content=JSON.parse(opts.body);
    return Response.json({model:content.model,choices:[{message:{content:"Test answer"}}]});
  }
});
await new Promise(resolve=>gateway.listen(0,"127.0.0.1",resolve));
const endpoint="http://127.0.0.1:"+gateway.address().port+"/chat/completions";
try{
  assert.rejects(
    ()=>verifyRunpod({endpoint,token}),
    /HTTPS/
  );
  let check=await verifyRunpod({endpoint,token,allowLoopback:true,healthOnly:true});
  assert.equal(check.ok,true);
  assert.equal(check.inference_checked,false);
  assert.deepEqual(check.models,models);
  assert.equal(upstreamCalls,0);
  check=await verifyRunpod({endpoint,token,allowLoopback:true});
  assert.equal(check.inference_checked,true);
  assert.equal(upstreamCalls,1);
  await assert.rejects(
    ()=>verifyRunpod({endpoint,token:"B".repeat(64),allowLoopback:true}),
    /health returned HTTP 401/
  );
  await assert.rejects(
    ()=>verifyRunpod({endpoint:"https://user:pass@example.org/chat/completions",token}),
    /credentials/
  );
}finally{await new Promise(resolve=>gateway.close(resolve))}
const startup=readFileSync("deploy/independent-ai/runpod/start-runpod.sh","utf8");
const docker=readFileSync("deploy/independent-ai/runpod/Dockerfile","utf8");
assert.match(startup,/validate_star_model_config/);
assert.match(startup,/for model in "\$\{STAR_MODEL_LIST\[@\]\}"/);
assert.match(startup,/ollama pull "\$model"/);
assert.match(docker,/COPY runpod\/model-config\.sh/);
assert.match(docker,/EXPOSE 8080/);
assert.ok(!docker.includes("EXPOSE 11434"));
console.log("RunPod V6 model preload config, authorization and true inference verification passed.");
