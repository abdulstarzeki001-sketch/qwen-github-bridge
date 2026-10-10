# Cloudflare Pages deployment

Connect the private GitHub repository in Cloudflare Workers & Pages > Create > Pages > Connect to Git.

Repository: abdulstarzeki001-sketch/qwen-github-bridge
Production branch: main
Project name: star-cyber-ai-x
Framework: None
Build output directory: web
Build command: leave blank
Root directory: /

Configure production environment secrets in Cloudflare:
STAR_API_TOKEN (random, 32+ characters)
OPENROUTER_API_KEY (OpenRouter credential)
STAR_GITHUB_ADMIN_TOKEN (random, 32+ characters)
GITHUB_APP_ID
GITHUB_INSTALLATION_ID
GITHUB_APP_PRIVATE_KEY (complete PEM)
Optional STAR_CLOUDFLARE_MODEL (defaults to openrouter/free)

Redeploy after configuring secrets. Netlify variables are not automatically copied.
Visit /api/health to confirm runtime cloudflare. GitHub browsing is read-only.
Configure a Cloudflare rate limiting rule for POST /api/chat before public use.
Never paste secrets into the repository or screenshots.
