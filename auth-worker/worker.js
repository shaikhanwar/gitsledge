// Cloudflare Worker: exchange a GitHub OAuth "code" for a user access token.
//
// This is the ONLY server-side piece of the in-app register path. It exists only
// because GitHub's token endpoint has no CORS, so the browser cannot call it
// directly. It never exposes the client secret and returns only the access token.
//
// Deploy (free): install `npm i -g wrangler`, then from this folder:
//   wrangler deploy
//   wrangler secret put GITHUB_CLIENT_ID       # paste your OAuth App client id
//   wrangler secret put GITHUB_CLIENT_SECRET   # paste your OAuth App client secret
// Set ALLOWED_ORIGIN in wrangler.toml to your Pages origin.
//
// Azure Functions / any host work too - it's ~30 lines; replicate the POST logic.

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    if (allow !== '*' && origin && origin !== allow) return json({ error: 'origin_not_allowed' }, 403, cors);

    let code;
    try { ({ code } = await request.json()); } catch { return json({ error: 'bad_request' }, 400, cors); }
    if (!code) return json({ error: 'missing_code' }, 400, cors);

    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await resp.json().catch(() => ({}));
    // Return ONLY the access token (never the secret).
    return json({ access_token: data.access_token || '', error: data.error || '' }, 200, cors);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
