# In-app register ("Sign in with GitHub") — setup

This enables **Option B**: users register **inside the SLED app** (no GitHub page).
It needs two one-time things you set up: a **GitHub OAuth App** and a **tiny token
helper** (this folder). Until both are configured, the app safely keeps using the
GitHub **Issue Forms** — nothing breaks.

## 1. Register a GitHub OAuth App (2 min)

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**:

- **Application name:** SLED Use Case Library
- **Homepage URL:** `https://shaikhanwar.github.io/gitsledge/`
- **Authorization callback URL:** `https://shaikhanwar.github.io/gitsledge/`
- Register, then **Generate a new client secret**.
- Copy the **Client ID** (public) and the **Client secret** (keep private).

## 2. Deploy the token helper (this folder)

The helper does only the OAuth code→token exchange (GitHub's token endpoint has no
CORS). Cloudflare Workers is free and fastest:

```bash
npm i -g wrangler
cd auth-worker
wrangler login
# edit wrangler.toml -> ALLOWED_ORIGIN = https://shaikhanwar.github.io
wrangler deploy
wrangler secret put GITHUB_CLIENT_ID        # paste the Client ID
wrangler secret put GITHUB_CLIENT_SECRET     # paste the Client secret (type/paste in terminal only)
```

`wrangler deploy` prints your worker URL, e.g. `https://sled-auth.<you>.workers.dev`.
Your token endpoint is that URL (the worker handles POST at `/`).

> Prefer Azure? The same ~30 lines work as an HTTP-triggered Azure Function; set the
> two secrets as app settings and point `authProxy` at the function URL.

## 3. Turn it on in the app

Edit `site/index.html` → `window.SLED_GITHUB`:

```js
window.SLED_GITHUB = {
  repo: 'shaikhanwar/gitsledge',
  clientId: 'PASTE_CLIENT_ID',
  authProxy: 'https://sled-auth.<you>.workers.dev',
  scope: 'public_repo'      // 'repo' if the repo is private
};
```

Commit + push. The **Deploy site** Action republishes Pages. Now a **Sign in with
GitHub** button appears; after signing in, Register happens fully in-app and opens a
PR behind the scenes (approval still enforced by CODEOWNERS).

## Security notes

- The **client secret lives only in the worker** (as a secret), never in the site.
- The worker returns only the access token and is locked to your Pages origin.
- Tokens are held in `sessionStorage` (cleared when the tab closes); sign-out clears them.
- `public_repo` scope is enough for the public DEV repo. For a private/org repo use `repo`.
- **PROD (org/EMU):** register the OAuth App in the org, host the helper on an approved
  service (e.g. Azure Function in your tenant), and set `ALLOWED_ORIGIN` to the org Pages URL.
