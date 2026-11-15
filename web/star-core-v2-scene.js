/* STAR CORE V2 phase 2: optional realtime WebGL neural core. CSS orb is fallback. */
(()=>{"use strict";
const canvas=document.getElementById("p2Core3d");
if(!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches)return;
const host=canvas.parentElement;
let gl;
try{gl=canvas.getContext("webgl",{alpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:"low-power"});}catch{return}
if(!gl)return;
const vertex=[
"attribute vec2 a_position;","varying vec2 uv;",
"void main(){uv=a_position;gl_Position=vec4(a_position,0.0,1.0);}"
].join("\n");
const fragment=[
"precision mediump float;","varying vec2 uv;","uniform float u_time;","uniform vec2 u_motion;",
"vec3 palette(float x){return mix(vec3(0.09,0.23,0.60),vec3(0.22,0.94,0.87),smoothstep(-.3,.9,x));}",
"void main(){",
"vec2 p=uv*1.22;float r2=dot(p,p);",
"if(r2>1.0)discard;",
"vec3 n=normalize(vec3(p,sqrt(max(0.0,1.0-r2))));",
"float t=u_time*.25;float ct=cos(t),st=sin(t);",
"vec3 q=vec3(n.x*ct-n.z*st,n.y,n.x*st+n.z*ct);",
"q.xy+=u_motion*.2;",
"float latitude=sin(q.y*27.0+t*2.0+sin(q.x*11.0)*1.3);",
"float longitude=sin(q.x*23.0-t*1.6+sin(q.z*8.0));",
"float energy=clamp(.52+.25*latitude+.16*longitude,0.0,1.0);",
"vec3 col=palette(energy*1.4-.3);",
"float diffuse=.39+.61*max(dot(n,normalize(vec3(-.4,.8,.8))),0.0);",
"float fresnel=pow(1.0-n.z,2.8);",
"col*=diffuse;col+=vec3(.24,.65,.90)*fresnel*.85;",
"float veins=smoothstep(.72,.99,energy)*.42;",
"col+=vec3(.32,.72,1.0)*veins;",
"float halo=pow(max(0.0,1.0-r2),.25);",
"gl_FragColor=vec4(col,clamp(halo+fresnel*.4,0.0,1.0));",
"}"
].join("\n");
function shader(kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error("shader compile");return s;}
let program,buffer,time,motion,visible=true,running=true,frame=0,last=0,rot=[0,0];
try{
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("shader link");
 gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,"a_position");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 time=gl.getUniformLocation(program,"u_time");motion=gl.getUniformLocation(program,"u_motion");
 const size=Math.min(310,Math.max(124,Math.ceil(host.clientWidth*(Math.min(devicePixelRatio||1,1.5)))));
 canvas.width=size;canvas.height=size;gl.viewport(0,0,size,size);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 host.classList.add("p2-active");
}catch{return}
function paint(now){
 if(!running)return;
 if(visible&&!document.hidden&&now-last>=32){
 last=now;frame++;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.uniform1f(time,now*.001);gl.uniform2f(motion,rot[0],rot[1]);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 requestAnimationFrame(paint);
}
requestAnimationFrame(paint);
if("IntersectionObserver" in window){const observer=new IntersectionObserver(rows=>{visible=!!rows[0]?.isIntersecting;},{threshold:.02});observer.observe(host);}
host.addEventListener("pointermove",e=>{const b=host.getBoundingClientRect();rot=[((e.clientX-b.left)/b.width-.5)*2,((e.clientY-b.top)/b.height-.5)*2];},{passive:true});
host.addEventListener("pointerleave",()=>{rot=[0,0];},{passive:true});
canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();running=false;host.classList.remove("p2-active");},{passive:false});
})();