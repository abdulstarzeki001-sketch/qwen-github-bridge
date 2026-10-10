import { createSign, timingSafeEqual } from "node:crypto";

const get = (key) => Netlify.env.get(key) || "";
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function authorized(req) {
  const expected = get("STAR_GITHUB_ADMIN_TOKEN");
  const received = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const a = Buffer.from(expected), b = Buffer.from(received);
  return a.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}

function signedAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  const data = encode({ alg: "RS256", typ: "JWT" }) + "." +
    encode({ iat: now - 60, exp: now + 540, iss: get("GITHUB_APP_ID") });
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const pem = get("GITHUB_APP_PRIVATE_KEY").replaceAll("\\n", "\n");
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

export default async function handler(req) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const installation = get("GITHUB_INSTALLATION_ID");
    if (!/^\\d+$/.test(installation)) throw new Error("Invalid installation ID");
    const credentials = await github("/app/installations/" + installation + "/access_tokens", signedAppJWT(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositories: ["qwen-github-bridge"], permissions: { contents: "read" } }),
    });
    const repository = await github("/repos/abdulstarzeki001-sketch/qwen-github-bridge", credentials.token);
    return Response.json({
      ok: true, repository: repository.full_name, default_branch: repository.default_branch,
      installation_authenticated: true, access: "read-only",
    }, { headers });
  } catch (error) {
    console.error("GitHub App status failed:", error.message);
    return Response.json({ error: "GitHub App connection failed" }, { status: 502, headers });
  }
}

export const config = { path: "/api/github/status", method: "GET" };
