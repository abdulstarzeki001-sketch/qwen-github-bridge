import { createSign, timingSafeEqual } from "node:crypto";
export function makeGithubHandler(bindings) {


const get = (key) => bindings[key] || "";
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function authorized(req) {
  const expected = get("STAR_GITHUB_ADMIN_TOKEN");
  const received = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const a = Buffer.from(expected), b = Buffer.from(received);
  return a.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}

// Env UIs often store multi-line keys with "\n" escapes or spaces instead of
// line breaks; rebuild a standard PEM so either form parses.
function normalizePem(value) {
  const match = value.replaceAll("\\n", "\n").match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) return value;
  const body = match[2].replace(/\s+/g, "").match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${match[1]}-----\n${body}\n-----END ${match[1]}-----\n`;
}

function signedAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  const data = encode({ alg: "RS256", typ: "JWT" }) + "." +
    encode({ iat: now - 60, exp: now + 540, iss: get("GITHUB_APP_ID") });
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const pem = normalizePem(get("GITHUB_APP_PRIVATE_KEY"));
  return data + "." + signer.sign(pem).toString("base64url");
}

async function github(path, token, options = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("GitHub HTTP " + res.status);
  return res.json();
}

async function handler(req) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const installation = get("GITHUB_INSTALLATION_ID");
    if (!/^[0-9]+$/.test(installation)) throw new Error("Invalid installation ID");
    const credentials = await github("/app/installations/" + installation + "/access_tokens", signedAppJWT(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositories: ["qwen-github-bridge"], permissions: { contents: "read" } }),
    });
    const repository = await github("/repos/abdulstarzeki001-sketch/qwen-github-bridge", credentials.token);
    const url = new URL(req.url);
    if (url.pathname === "/api/github/browse") {
      const path = url.searchParams.get("path") || "";
      if (path.length > 500 || path.split("/").some(x => x === "." || x === "..") || path.includes("\\") || [...path].some(ch => ch.charCodeAt(0) < 32)) {
        return Response.json({ error: "Invalid path" }, { status: 400, headers });
      }
      const resource = await github("/repos/abdulstarzeki001-sketch/qwen-github-bridge/contents/" +
        path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(repository.default_branch), credentials.token);
      if (Array.isArray(resource)) {
        return Response.json({ ok: true, path, type: "directory", entries: resource.map(x => ({
          name: x.name, path: x.path, type: x.type, size: x.size
        })) }, { headers });
      }
      if (resource.type !== "file" || resource.size > 131072 || resource.encoding !== "base64") {
        return Response.json({ error: "File type or size unsupported (max 128 KiB)" }, { status: 400, headers });
      }
      const bytes = Buffer.from(resource.content.replace(/\\s/g, ""), "base64");
      if (bytes.includes(0)) return Response.json({ error: "Binary files unsupported" }, { status: 400, headers });
      return Response.json({ ok: true, path: resource.path, type: "file", size: resource.size,
        content: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }, { headers });
    }
    return Response.json({
      ok: true, repository: repository.full_name, default_branch: repository.default_branch,
      installation_authenticated: true, access: "read-only",
    }, { headers });
  } catch (error) {
    console.error("GitHub App status failed:", error.message);
    return Response.json({ error: "GitHub App connection failed" }, { status: 502, headers });
  }
}


return handler;
}
