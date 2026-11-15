// Cloudflare Access may identify the sole owner on first visit; issue a
// signed trusted-device cookie without presenting a separate login form.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/[[path]].js";
globalThis.crypto ||= webcrypto;
const root="https://star-cyber-ai-x.pages.dev";
const team="https://soloowner.cloudflareaccess.com";
const env={
 STAR_API_TOKEN:"a".repeat(64),
 STAR_ACCESS_TEAM_DOMAIN:team,
 STAR_ACCESS_AUD:"star-owner-audience",
 STAR_OWNER_EMAIL:"sole-owner@example.invalid"
};
const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
publicJwk.kid="owner-cert-1";
const b64url=data=>Buffer.from(data).toString("base64url");
const jwtPart=value=>b64url(JSON.stringify(value));
async function jwt(claims={}){
 const now=Math.floor(Date.now()/1000);
 const data=jwtPart({alg:"RS256",typ:"JWT",kid:"owner-cert-1"})+"."+jwtPart({iss:team,aud:[env.STAR_ACCESS_AUD],email:env.STAR_OWNER_EMAIL,iat:now-1,exp:now+3600,...claims});
 const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(data));
 return data+"."+b64url(Buffer.from(signature));
}
const previous=globalThis.fetch;
globalThis.fetch=async url=>{
 assert.equal(url,team+"/cdn-cgi/access/certs");
 return Response.json({keys:[publicJwk]});
};
const call=(headers={})=>onRequest({request:new Request(root+"/api/auth/session",{headers:{"Sec-Fetch-Site":"same-origin",...headers}}),env});
try{
 let res=await call();
 assert.equal(res.status,401,"Unknown visitor cannot join as owner");
 assert.equal(res.headers.get("set-cookie"),null,"No cookie minted for visitor");
 res=await call({"cf-access-jwt-assertion":await jwt({email:"someone-else@example.invalid"})});
 assert.equal(res.status,401,"A different Access email must be denied");
 assert.equal(res.headers.get("set-cookie"),null);
 res=await call({"cf-access-jwt-assertion":await jwt({exp:Math.floor(Date.now()/1000)-1})});
 assert.equal(res.status,401,"Expired identity must be denied");
 res=await call({"cf-access-jwt-assertion":await jwt()});
 assert.equal(res.status,200,"Verified single owner signs in without a manual activation prompt");
 assert.equal((await res.json()).method,"access");
 const cookie=res.headers.get("set-cookie");
 assert.match(cookie,/__Host-star_owner=/);
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/Secure/);
 assert.match(cookie,/Max-Age=31536000/);
 res=await call({"Cookie":cookie.split(";")[0]});
 assert.equal(res.status,200,"Trusted browser reconnects without a new identity assertion");
 assert.equal((await res.json()).method,"cookie");
 assert.equal(res.headers.get("set-cookie"),null,"Fresh session remains stable");
 console.log("Verified Access SSO automatically trusts sole owner's device and rejects unknown visitors");
}finally{globalThis.fetch=previous}
