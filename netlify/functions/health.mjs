const SECURITY_HEADERS = { "cache-control":"no-store", "x-content-type-options":"nosniff", "x-frame-options":"DENY", "referrer-policy":"no-referrer", "permissions-policy":"camera=(), microphone=(), geolocation=()" };

export default async () => {
  const model = Netlify.env.get("STAR_NETLIFY_MODEL") || "openrouter/free";
  const gatewayActive = Boolean(Netlify.env.get("OPENROUTER_BASE_URL"));

  return Response.json(
    {
      ok: true,
      version: "0.7.0",
      runtime: "netlify",
      ai_gateway: gatewayActive,
      ai_model: model,
      full_backend: false,
    },
    {
      headers: SECURITY_HEADERS,
    },
  );
};

export const config = {
  path: "/api/health",
  method: "GET",
};
