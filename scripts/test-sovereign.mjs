import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;

const origin="https://star-cyber-ai-x.pages.dev",token="z".repeat(64);
const env={STAR_API_TOKEN:token,STAR_AI_PROVIDER:"openai",OPENAI_API_KEY:"test-not-a-real-key",STAR_ALLOWED_MODELS:"gpt-4.1,gpt-4.1-mini"};
const calls=[],originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
  if(url!=="https://api.openai.com/v1/chat/completions")return originalFetch(url,options);
  calls.push(JSON.parse(options.body));
  return Response.json({model:calls.at(-1).model,choices:[{message:{content:"Provider mock response"}}]});
};
const request=(body,authenticated=true)=>onRequest({request:new Request(origin+"/api/chat",{
  method:"POST",headers:{"Content-Type":"application/json",Origin:origin,...(authenticated?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)
}),env});
try{
 let res=await request({prompt:"test"},false);
 assert.equal(res.status,401,"Unauthenticated caller denied");
 res=await request({prompt:"test",model:"unknown-model"});
 assert.equal(res.status,400,"Non-allowlisted model rejected");
 res=await request({prompt:"test",temperature:2});
 assert.equal(res.status,400,"Out-of-range temperature rejected");
 res=await request({prompt:"test",max_tokens:20000});
 assert.equal(res.status,400,"Out-of-range tokens rejected");
 res=await request({prompt:"test",owner_instructions:"x".repeat(4001)});
 assert.equal(res.status,400,"Oversize owner instructions rejected");
 assert.equal(calls.length,0,"Rejected requests never call the provider");
 res=await request({prompt:"Please inspect this code.",model:"gpt-4.1-mini",temperature:0.65,max_tokens:2048,owner_instructions:"Reply in Iraqi Arabic with precise code examples."});
 assert.equal(res.status,200);
 assert.equal((await res.json()).content,"Provider mock response");
 const captured=calls[0];
 assert.equal(captured.model,"gpt-4.1-mini");
 assert.equal(captured.temperature,0.65);
 assert.equal(captured.max_tokens,2048);
 assert.match(captured.messages[0].content,/Reply in Iraqi Arabic/);
 assert.match(captured.messages[1].content,/Please inspect/);
 res=await request({prompt:"Default config still works."});
 assert.equal(res.status,200);
 assert.equal(calls[1].model,"gpt-4.1");
 assert.equal(calls[1].temperature,0.15);
 assert.equal(calls[1].max_tokens,1400);
 console.log("STAR SOVEREIGN owner configuration tests passed");
}finally{globalThis.fetch=originalFetch}
