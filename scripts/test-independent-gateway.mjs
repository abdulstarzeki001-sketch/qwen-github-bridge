import assert from "node:assert/strict";
import { createGateway } from "../deploy/independent-ai/gateway.mjs";
import { readFileSync } from "node:fs";
const token="S".repeat(64);
let called=0,last=null;
const gateway=createGateway({token,model:"gpt-oss:20b",upstreamFetch:async(url,options)=>{
  called++;last={url,options,body:JSON.parse(options.body)};
  return Response.json({model:"gpt-oss:20b",choices:[{message:{content:"Test response"}}]});
}});
await new Promise(resolve=>gateway.listen(0,"127.0.0.1",resolve));
const url="http://127.0.0.1:"+gateway.address().port;
const request=async({path="/chat/completions",auth=token,method="POST",body={
 model:"gpt-oss:20b",messages:[{role:"system",content:"Helpful"},{role:"user",content:"Hello"}],
 max_tokens:512,temperature:0.2
},contentType="application/json"}={})=>{
  const headers={};
  if(auth!==null)headers.Authorization="Bearer "+auth;
  if(method==="POST")headers["Content-Type"]=contentType;
  return fetch(url+path,{method,headers,...(method==="POST"?{body:typeof body==="string"?body:JSON.stringify(body)}:{})});
};
try{
  let r=await request({auth:null});assert.equal(r.status,401);assert.equal(called,0);
  r=await request({auth:"wrong"});assert.equal(r.status,401);assert.equal(called,0);
  r=await request({path:"/api/tags"});assert.equal(r.status,404);
  r=await request({method:"GET",path:"/health"});assert.equal(r.status,200);assert.equal((await r.json()).model,"gpt-oss:20b");
  r=await request({body:{model:"other",messages:[{role:"user",content:"Hello"}]}});assert.equal(r.status,400);
  r=await request({body:{model:"gpt-oss:20b",messages:[{role:"user",content:"Hello"}],stream:true}});assert.equal(r.status,200);assert.equal(called,1);
  assert.equal(last.url,"http://ollama:11434/v1/chat/completions");
  const pod=createGateway({token,model:"gpt-oss:20b",endpoint:"http://127.0.0.1:11434/v1/chat/completions",upstreamFetch:async()=>Response.json({model:"gpt-oss:20b",choices:[{message:{content:"pod"}}]})});
  await new Promise(resolve=>pod.listen(0,"127.0.0.1",resolve));
  try {assert.equal(pod.listening,true)} finally {await new Promise(resolve=>pod.close(resolve))}
  const fs=await import("node:fs");
  const docker=fs.readFileSync(new URL("../deploy/independent-ai/runpod/Dockerfile",import.meta.url),"utf8");
  const start=fs.readFileSync(new URL("../deploy/independent-ai/runpod/start-runpod.sh",import.meta.url),"utf8");
  assert.match(docker,/EXPOSE 8080/);assert.ok(!docker.includes("EXPOSE 11434"));
  assert.match(start,/OLLAMA_HOST=127\.0\.0\.1:11434/);
  assert.ok(!start.includes('gateway_pid:-0'));

  assert.equal(last.body.stream,false,"Never allow streaming to circumvent bounded responses");
  assert.equal((await r.json()).choices[0].message.content,"Test response");
  r=await request({body:{model:"gpt-oss:20b",messages:[{role:"user",content:"x".repeat(16001)}]}});assert.equal(r.status,400);
  r=await request({body:{model:"gpt-oss:20b",messages:[{role:"user",content:"Hello"}],max_tokens:9000}});assert.equal(r.status,400);
  r=await request({contentType:"text/plain"});assert.equal(r.status,415);
  r=await request({body:"x".repeat(100001)});assert.equal(r.status,413);
  assert.equal(called,1,"Reject unauthorized or invalid requests before inference");
  const compose=readFileSync(new URL("../deploy/independent-ai/compose.yaml",import.meta.url),"utf8");
  assert.ok(compose.includes("capabilities: [gpu]"));
  assert.ok(!compose.includes("\n    ports:"),"Do not publish unauthenticated model host ports");
  assert.ok(compose.includes("cloudflared"));
  assert.ok(compose.includes("ollama-models"));
  const api=readFileSync(new URL("../functions/api/[[path]].js",import.meta.url),"utf8");
  assert.ok(api.includes("STAR_AI_PROVIDER"),"Keep existing model switching");
  assert.ok(api.includes("STAR_SELFHOSTED_URL"),"Server URL should use existing cloud secrets");
  console.log("Independent STAR GPU gateway tests passed: authentication, model boundary, no host ports, input limits and private routing.");
}finally{await new Promise(resolve=>gateway.close(resolve))}
