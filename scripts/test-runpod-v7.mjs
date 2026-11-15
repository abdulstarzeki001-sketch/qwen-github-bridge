import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildPodPlan,executeRunpodAction} from "./runpod-control.mjs";

const plan=buildPodPlan();
assert.deepEqual(plan.ports,["8080/http"]);
assert.deepEqual(plan.mounts.persistent,{size:60,path:"/workspace"});
assert.equal(plan.env.STAR_MODEL,"qwen2.5-coder:7b");
assert.equal(plan.env.STAR_ALLOWED_MODELS,"qwen2.5-coder:7b");
assert.equal(plan.env.STAR_BACKEND_TOKEN,"REDACTED_FROM_PLAN");
assert.ok(!JSON.stringify(plan).includes("11434"));
assert.ok(!JSON.stringify(plan).includes("22/tcp"));
assert.throws(()=>buildPodPlan({allowedModels:"foo:7b"}),/Invalid model allowlist/);
assert.throws(()=>buildPodPlan({image:"evil/unknown:latest"}),/GHCR/);
assert.throws(()=>buildPodPlan({disk:3}),/Container disk/);
assert.throws(()=>buildPodPlan({allowedModels:"qwen2.5-coder:7b,qwen2.5-coder:7b"}),/Invalid model allowlist/);
assert.throws(()=>buildPodPlan({volume:-1}),/Persistent volume/);
const safe=await executeRunpodAction("plan",{});
assert.equal(safe.will_charge,false);
assert.equal(safe.request.env.STAR_BACKEND_TOKEN,"REDACTED_FROM_PLAN");

const key="K".repeat(45),secret="S".repeat(64);
const traces=[];
const fetcher=async(url,opts)=>{
  traces.push({url,opts});
  if(opts.method==="POST")return Response.json({id:"abcdef123456",name:"star-nexus-independent-ai",status:"PROVISIONING",cost:0.39},{status:201});
  if(url.endsWith("/pods"))return Response.json({pods:[{id:"abcdef123456",name:"star-nexus-independent-ai",status:"RUNNING",
    env:{STAR_BACKEND_TOKEN:secret},cost:0.39}]});
  return Response.json({id:"abcdef123456",status:"RUNNING",env:{STAR_BACKEND_TOKEN:secret}});
};
await assert.rejects(()=>executeRunpodAction("create",{key,backendToken:secret,fetcher}),/confirm-paid/);
assert.equal(traces.length,0,"Never bill automatically");
await assert.rejects(()=>executeRunpodAction("create",{key,backendToken:"abc",confirmPaid:true,fetcher}),/32-256/);
assert.equal(traces.length,0);
const created=await executeRunpodAction("create",{key,backendToken:secret,confirmPaid:true,fetcher});
assert.equal(created.pod.id,"abcdef123456");
assert.ok(!JSON.stringify(created).includes(secret));
assert.deepEqual(traces[0].opts.body&&JSON.parse(traces[0].opts.body).ports,["8080/http"]);
assert.equal(JSON.parse(traces[0].opts.body).env.STAR_BACKEND_TOKEN,secret);
assert.equal(traces[0].opts.headers.Authorization,"Bearer "+key);
assert.match(created.endpoint,/^https:\/\/abcdef123456-8080\.proxy\.runpod\.net\/chat\/completions$/);

const listed=await executeRunpodAction("list",{key,fetcher});
assert.equal(listed.pods.length,1);
assert.equal(listed.pods[0].status,"RUNNING");
assert.ok(!JSON.stringify(listed).includes(secret));
const inspected=await executeRunpodAction("inspect",{key,podId:"abcdef123456",fetcher});
assert.equal(inspected.pod.status,"RUNNING");
assert.ok(!JSON.stringify(inspected).includes(secret));
await assert.rejects(()=>executeRunpodAction("inspect",{key,podId:"../../unsafe",fetcher}),/Invalid pod ID/);
assert.equal(traces.length,3);
const before=traces.length;
await assert.rejects(()=>executeRunpodAction("list",{key:"",fetcher}),/RUNPOD_API_KEY/);
assert.equal(traces.length,before);

const readme=readFileSync("deploy/independent-ai/runpod/README.md","utf8");
assert.ok(readme.includes("ghcr.io/"));
const imageWorkflow=readFileSync(".github/workflows/publish-star-runpod-image.yml","utf8");
assert.ok(imageWorkflow.includes("packages: write"));
console.log("RunPod V7: safe no-credit plan, REST v2 discovery, explicit paid create, and secret redaction passed");
