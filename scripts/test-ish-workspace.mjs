import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
const registry=readFileSync("scripts/ish/sources.psv","utf8").trim().split(/\r?\n/).filter(s=>s&&!s.startsWith("#"));
const names=new Set(),remotes=new Set();
let core=0;
for(const line of registry){
  const pieces=line.split("|");
  assert.equal(pieces.length,5,"Registry must have 5 fields");
  const [id,remote,sha,group,description]=pieces;
  assert.match(id,/^[a-z0-9_-]+$/);
  assert.match(remote,/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/);
  assert.match(sha,/^[a-f0-9]{40}$/);
  assert.ok(["core","reference"].includes(group));
  assert.ok(description.trim().length>5);
  assert.ok(!names.has(id),"Unique name "+id);names.add(id);
  assert.ok(!remotes.has(remote),"Unique remote "+remote);remotes.add(remote);
  if(group==="core")core++;
}
assert.equal(registry.length,17,"Must include exactly 17 public source references");
assert.equal(core,7,"Seven previously smoke-tested source repositories");
for(const file of [
 "scripts/ish/star.sh","scripts/ish/fetch-sources.sh",
 "scripts/ish/README.md","web/ish-setup.html",
 ".github/workflows/ish-sources-bundle.yml"
])assert.ok(existsSync(file),"Missing "+file);
const shells=["scripts/ish/star.sh","scripts/ish/fetch-sources.sh"];
for(const path of shells){
  let r=spawnSync("sh",["-n",path],{encoding:"utf8"});
  assert.equal(r.status,0,path+": "+r.stderr);
}
let r=spawnSync("sh",["scripts/ish/fetch-sources.sh","list"],{encoding:"utf8"});
assert.equal(r.status,0,r.stderr);
assert.ok(r.stdout.includes("drana"));
assert.ok(r.stdout.includes("wormgpt-archives"));
r=spawnSync("sh",["scripts/ish/star.sh","help"],{encoding:"utf8"});
assert.equal(r.status,0,r.stderr);
assert.ok(r.stdout.includes("sources all"));
r=spawnSync("sh",["scripts/ish/star.sh","sources","list"],{encoding:"utf8"});
assert.equal(r.status,0,r.stderr);
r=spawnSync("sh",["scripts/ish/star.sh","sources","one","not-a-repository"],{encoding:"utf8"});
assert.equal(r.status,2,"Unknown source must reject with code 2");
const fetcher=readFileSync("scripts/ish/fetch-sources.sh","utf8");
assert.ok(fetcher.includes("checkout --quiet --detach"),"Must use the pinned SHA");
assert.ok(fetcher.includes("status --porcelain"),"Preserve local modifications");
assert.ok(fetcher.includes('core.hooksPath=/dev/null'),"Never execute third-party repo hooks");
assert.ok(!fetcher.includes("npm install")&&!fetcher.includes("pip install"),"Don't auto-run third party setup");
const ui=readFileSync("web/ish-setup.html","utf8");
for(const s of ["sources core","sources all","serve 8080","sh scripts/ish/star.sh","manifest.webmanifest"])assert.ok(ui.includes(s));
const doc=readFileSync("scripts/ish/README.md","utf8");
assert.ok(doc.includes("Cloudflare Pages Functions"));
const workflow=readFileSync(".github/workflows/ish-sources-bundle.yml","utf8");
assert.ok(workflow.includes("upload-artifact@v4"));
assert.ok(workflow.includes("persist-credentials: false"));
console.log("STAR iSH: 17 pinned sources, 7 core, POSIX scripts, local preview, portable source artifacts passed");
