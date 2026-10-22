import assert from "node:assert/strict";
import { createGateway,validateConfig } from "../sovereign-gateway/server.mjs";
const env={SOVEREIGN_GATEWAY_TOKEN:"g".repeat(64),SOVEREIGN_ALLOWED_MODELS:"qwen3:8b,qwen2.5-coder:7b",SOVEREIGN_MAX_CONCURRENT:"2"};
assert.throws(()=>validateConfig({...env,SOVEREIGN_GATEWAY_TOKEN:"short"}),/32/);
assert.throws(()=>validateConfig({...env,SOVEREIGN_OLLAMA_URL:"https://evil.example/v1/chat/completions"}),/loopback/);
let upstreamCalls=[];
const upstream=async(url,options)=>{
 upstreamCalls.push({url,body:JSON.parse(options.body)});
 return Response.json({id:"mock",model:upstreamCalls.at(-1).body.model,choices:[{message:{role:"assistant",content:"Local answer"}}]});
};
const server=createGateway(env,upstream);
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port;
async function request(path,method="GET",body=null,token=env.SOVEREIGN_GATEWAY_TOKEN){
 return fetch(base+path,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},...(body!==null?{body:JSON.stringify(body)}:{})});
}
try{
 let res=await request("/health","GET",null,"wrong");
 assert.equal(res.status,401,"Health requires authentication");
 res=await request("/health");
 assert.equal(res.status,200);
 assert.equal((await res.json()).engine,"ollama");
 const valid={model:"qwen3:8b",messages:[{role:"user",content:"Hello from STAR"}],temperature:0.5,max_tokens:1000};
 res=await request("/v1/chat/completions","POST",{...valid,model:"unlisted"});
 assert.equal(res.status,400);
 res=await request("/v1/chat/completions","POST",{...valid,messages:[{role:"tool",content:"bad"}]});
 assert.equal(res.status,400);
 assert.equal(upstreamCalls.length,0);
 res=await request("/v1/chat/completions","POST",valid);
 assert.equal(res.status,200);
 const result=await res.json();
 assert.equal(result.choices[0].message.content,"Local answer");
 assert.equal(upstreamCalls[0].url,"http://127.0.0.1:11434/v1/chat/completions");
 assert.equal(upstreamCalls[0].body.stream,false);
 assert.equal(upstreamCalls[0].body.model,"qwen3:8b");
 res=await request("/v1/chat/completions","POST",valid,"untrusted");
 assert.equal(res.status,401);
 assert.equal(upstreamCalls.length,1);
 console.log("STAR SOVEREIGN local gateway tests passed");
}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
