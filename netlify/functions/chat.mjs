import { OpenRouter } from "@openrouter/sdk";

function normalizeContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item.text === "string") return item.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export default async (req) => {
  const gatewayBaseUrl = Netlify.env.get("OPENROUTER_BASE_URL");
  if (!gatewayBaseUrl) {
    return Response.json(
      {
        error:
          "Netlify AI Gateway is not active yet. Publish one production deploy first.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json(
      { error: "prompt is required." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  if (prompt.length > 16000) {
    return Response.json(
      { error: "prompt is too large; maximum is 16000 characters." },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  }

  const model = Netlify.env.get("STAR_NETLIFY_MODEL") || "openrouter/free";
  const client = new OpenRouter();

  try {
    const result = await client.chat.send({
      chatRequest: {
        model,
        maxTokens: 1400,
        temperature: 0.15,
        messages: [
          {
            role: "system",
            content:
              "You are STAR CYBER AI X. Help with software engineering, secure-code review, defensive security, authorized testing workflows, evidence analysis, remediation, and technical learning. Distinguish confirmed evidence from hypotheses and do not invent files, outputs, vulnerabilities, or test results.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      },
    });

    const content = normalizeContent(result?.choices?.[0]?.message?.content);

    if (!content) {
      return Response.json(
        {
          error: "The AI provider returned no readable text.",
          model: result?.model || model,
        },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      {
        ok: true,
        model: result?.model || model,
        content,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("STAR Netlify AI error", error);
    return Response.json(
      {
        error: "AI request failed.",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
};

export const config = {
  path: "/api/chat",
  method: "POST",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 60,
    windowLimit: 10,
  },
};
