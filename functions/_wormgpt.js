// Optional WormGPT-labelled OpenAI-compatible inference backend.
// This adapter does NOT bundle, download or attest to the original WormGPT model.
const RESPONSE_LIMIT = 160;

export function wormgptEndpoint(env) {
  const raw = String(env.STAR_WORMGPT_URL || "").trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.port ||
      !["/v1/chat/completions", "/chat/completions"].includes(url.pathname) ||
      !host.includes(".") || host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal")) return null;
  return url.toString();
}

export function wormgptConfigured(env) {
  const model = env.STAR_WORMGPT_MODEL;
  return Boolean(
    wormgptEndpoint(env) &&
    typeof env.STAR_WORMGPT_TOKEN === "string" &&
    env.STAR_WORMGPT_TOKEN.length >= 32 &&
    typeof model === "string" && model.length > 0 && model.length <= RESPONSE_LIMIT &&
    /^[a-zA-Z0-9_./:-]+$/.test(model)
  );
}

export async function wormgptChat(env, options, safePrompt) {
  if (!wormgptConfigured(env)) throw new Error("WormGPT-compatible backend is not configured");
  const model = options.modelOverride || env.STAR_WORMGPT_MODEL;
  const upstream = await fetch(wormgptEndpoint(env), {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.STAR_WORMGPT_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: [
        {role: "system", content: options.system + " Answer in the user's language. Never claim to have executed actions you did not execute."},
        {role: "user", content: safePrompt}
      ]
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!upstream.ok) throw new Error("WormGPT-compatible upstream rejected the request");
  const data = await upstream.json();
  const raw = data?.choices?.[0]?.message?.content;
  const content = typeof raw === "string" ? raw.trim()
    : Array.isArray(raw) ? raw.filter(x => x && typeof x.text === "string").map(x => x.text).join("\n").trim() : "";
  if (!content) throw new Error("WormGPT-compatible upstream returned no text");
  return {ok: true, provider: "wormgpt", model: data.model || model, content};
}
