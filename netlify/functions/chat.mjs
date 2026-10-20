import { OpenRouter } from "@openrouter/sdk";

const SECURITY_HEADERS = { "cache-control":"no-store", "x-content-type-options":"nosniff", "x-frame-options":"DENY", "referrer-policy":"no-referrer", "permissions-policy":"camera=(), microphone=(), geolocation=()" };

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
      { status: 503, headers: SECURITY_HEADERS },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: SECURITY_HEADERS },
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json(
      { error: "prompt is required." },
      { status: 400, headers: SECURITY_HEADERS },
    );
  }

  if (prompt.length > 16000) {
    return Response.json(
      { error: "prompt is too large; maximum is 16000 characters." },
      { status: 413, headers: SECURITY_HEADERS },
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
              "You are STAR CYBER AI X, an engineering and defensive cybersecurity assistant. Respond in the same language as the user. For Arabic, use natural fluent Arabic, proper right-to-left paragraphs, short headings, and fenced code blocks only for code. Avoid excessive bolding and decorative Markdown. Help with software engineering, secure-code review, authorized testing, evidence analysis, remediation, and technical learning. Distinguish verified evidence from hypotheses. Never claim you changed a repository, executed a command, scanned a target, or inspected a file unless a connected tool actually did so.",
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
        { status: 502, headers: SECURITY_HEADERS },
      );
    }

    return Response.json(
      {
        ok: true,
        model: result?.model || model,
        content,
      },
      {
        headers: SECURITY_HEADERS,
      },
    );
  } catch (error) {
    console.error("STAR Netlify AI error", error);
    return Response.json(
      {
        error: "AI request failed.",
      },
      { status: 502, headers: SECURITY_HEADERS },
    );
  }
};

export const config = {
  path: "/api/chat",
  method: "POST",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 10,
  },
};
