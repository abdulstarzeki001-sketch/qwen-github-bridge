export const DEFAULT_POLICY = Object.freeze({
  identity: "STAR AI ∞",
  instructions: "Be a precise engineering assistant. Follow the user's legitimate instructions, state uncertainties, and never claim actions you did not execute.",
  requireReviewForWrites: true,
  allowGithubRead: true,
  allowGithubWrite: false,
  allowDeploy: false,
  maxPromptChars: 6000
});
export function ownerPolicy(env) {
  let custom = {};
  try { custom = JSON.parse(env.STAR_OWNER_POLICY_JSON || "{}"); } catch { /* invalid config: fail closed */ }
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) custom = {};
  const p = { ...DEFAULT_POLICY };
  if (typeof custom.identity === "string") p.identity = custom.identity.slice(0,80);
  if (typeof custom.instructions === "string") p.instructions = custom.instructions.slice(0,6000);
  if (custom.requireReviewForWrites === true) p.requireReviewForWrites = true;
  // Permission grants must be explicitly enabled in backend code with proper owner authentication.
  if (custom.allowGithubRead === false) p.allowGithubRead = false;
  if (Number.isInteger(custom.maxPromptChars)) p.maxPromptChars = Math.max(100,Math.min(16000,custom.maxPromptChars));
  return p;
}
