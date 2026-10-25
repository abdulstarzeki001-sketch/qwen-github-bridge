import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
const PORT=Number(process.env.PORT||8090),TOKEN=process.env.STAR_INTERPRETER_TOKEN||"";
const MODEL=process.env.STAR_AGENT_MODEL||"qwen2.5-coder:7b",MAX_BODY=5000,MAX_OUTPUT=60000,TIMEOUT=85000;
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
let busy=false;
function send(res,status,data){if(res.headersSent)return;res.writeHead(status,HEADERS);res.end(JSON.stringify(data))}
function validToken(value){if(!TOKEN||TOKEN.length<32||typeof value!=="string"||value.length>512)return false;const h=s=>createHash("sha256").update(s).digest();return timingSafeEqual(h(TOKEN),h(value))}
async function readJson(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(Error("too large"),{status:413});chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{throw Object.assign(Error("bad json"),{status:400})}}
function execute(prompt,res){
 if(busy)return send(res,429,{error:"Open Interpreter is busy"});busy=true;
 const args=["exec","--oss","--local-provider","ollama","--model",MODEL,"--sandbox","workspace-write","--ask-for-approval","never","--cd","/workspace",prompt];
 const child=spawn("interpreter",args,{cwd:"/workspace",shell:false,windowsHide:true,env:{PATH:process.env.PATH||"/home/node/.local/bin:/usr/local/bin:/usr/bin:/bin",HOME:"/home/node",INTERPRETER_HOME:"/home/node/.openinterpreter",CODEX_OSS_BASE_URL:process.env.CODEX_OSS_BASE_URL||"http://ollama:11434/v1",TERM:"dumb"},stdio:["ignore","pipe","pipe"]});
 let out="",err="",total=0,closed=false;const timer=setTimeout(()=>{if(!closed)child.kill("SIGTERM")},TIMEOUT);
 const collect=(target,chunk)=>{total+=chunk.length;if(total>MAX_OUTPUT){child.kill("SIGTERM");return target}return target+chunk.toString("utf8")};
 child.stdout.on("data",c=>{out=collect(out,c)});child.stderr.on("data",c=>{err=collect(err,c)});
 child.on("error",()=>{closed=true;clearTimeout(timer);busy=false;send(res,502,{error:"Could not start Open Interpreter"})});
 child.on("close",(code,signal)=>{closed=true;clearTimeout(timer);busy=false;const text=(out.trim()||err.trim()).slice(0,MAX_OUTPUT);
   if(total>MAX_OUTPUT)return send(res,502,{error:"Output too large"});if(signal==="SIGTERM")return send(res,504,{error:"Task timed out"});
   if(code!==0)return send(res,502,{error:"Task failed",details:text.slice(0,4000)});if(!text)return send(res,502,{error:"No output"});
   send(res,200,{ok:true,model:MODEL,result:text})
 });
}
const server=http.createServer(async(req,res)=>{
 const auth=req.headers.authorization||"",supplied=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
 if(!validToken(supplied))return send(res,401,{error:"Unauthorized"});
 if(req.url==="/health"&&req.method==="GET")return send(res,200,{ok:true,model:MODEL,access:"authenticated"});
 if(req.url!=="/execute"||req.method!=="POST")return send(res,404,{error:"Not found"});
 if(!(req.headers["content-type"]||"").startsWith("application/json"))return send(res,415,{error:"JSON required"});
 try{const body=await readJson(req),prompt=typeof body?.prompt==="string"?body.prompt.trim():"";
   if(!prompt||prompt.length>2500)return send(res,400,{error:"Task must be 1–2500 characters"});if(busy)return send(res,429,{error:"Open Interpreter is busy"});execute(prompt,res)
 }catch(e){send(res,e.status||400,{error:e.status===413?"Task too large":"Invalid task request"})}
});
if(!Number.isInteger(PORT)||PORT<1||PORT>65535)throw Error("Invalid PORT");
server.headersTimeout=10000;server.requestTimeout=95000;
server.listen(PORT,"0.0.0.0",()=>console.log("STAR Open Interpreter gateway listening on internal port "+PORT));
