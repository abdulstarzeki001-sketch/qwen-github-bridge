export default async () => {
  const model = Netlify.env.get("STAR_NETLIFY_MODEL") || "openrouter/free";
  const gatewayActive = Boolean(Netlify.env.get("OPENROUTER_BASE_URL"));

  return Response.json(
    {
      ok: true,
      version: "0.5.0",
      runtime: "netlify",
      ai_gateway: gatewayActive,
      ai_model: model,
      full_backend: false,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};

export const config = {
  path: "/api/health",
  method: "GET",
};
