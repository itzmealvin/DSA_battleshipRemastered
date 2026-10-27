# Deploy the static site with Workers Builds

The app is plain HTML, CSS and browser JavaScript. There is no build step, package manifest, Vite configuration or Cloudflare CLI configuration in the source tree. Workers Builds only needs a command to upload the files.

## Connect GitHub once

1. Push this repository, including `.assetsignore`, to GitHub.
2. In the Cloudflare dashboard, open **Workers & Pages → Create application → Import a repository**. Choose the Workers Git integration and authorize access to this repository.
3. Select `itzmealvin/DSA_battleshipRemastered` and enter these settings:

| Setting           | Value                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Worker name       | `battleship-remastered`                                                                         |
| Production branch | `main`                                                                                          |
| Root directory    | Repository root (`/`)                                                                           |
| Build command     | Leave empty                                                                                     |
| Deploy command    | `npx wrangler@4 deploy --name battleship-remastered --compatibility-date 2026-10-27 --assets .` |
| Preview builds    | Disable initially                                                                               |

The deploy command uses Cloudflare's uploader in their build environment. It does not add Wrangler, a bundler or runtime dependencies to the app. If you choose another Worker name, use that exact name in the deploy command too. Do not leave the default deploy command: this repository intentionally has no Wrangler configuration file.

4. Use Cloudflare's generated build API token, or select a deployment token for the intended account. Do not commit tokens. No application environment variables, database bindings or secrets are needed.
5. Save and deploy. Open the resulting `workers.dev` URL from the deployment page.

Cloudflare supports an assets directory directly on the deploy command, and custom commands in Workers Builds: [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## Publish updates with Git push

Review and commit your changes locally, then push the production branch:

```sh
git push origin main
```

Each push to the connected production branch starts a new deployment. Check **Worker → Settings → Build** for the Git connection, branch and commands, and the build history for failures. The source files do not need compilation or an output directory.

## Files and routing

`.assetsignore` allows only `index.html`, `404.html`, `favicon.svg`, `_headers`, the two active JavaScript modules and `styles/styles.css`. Git metadata, tests, documents and course assets stay out of the upload. Keep the allowlist current if you add a runtime asset. Cloudflare documents this format under [Ignoring assets](https://developers.cloudflare.com/workers/static-assets/binding/#ignoring-assets).

`_headers` applies security headers on Cloudflare. A basic local HTTP server does not apply this file. The minimal deploy command uses the host's default response for unknown paths; `404.html` is available as a standalone error page. Automatically using the branded page for every missing path requires the host's `404-page` routing setting, which is intentionally not added as source configuration here. See [Custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/#custom-404-pages).

## Verify the first deployment

- Load the site and confirm CSS, the favicon and both boards appear.
- Shuffle and deploy; fire with the mouse and the keyboard.
- Finish a solo match and reload to check the browser's saved record.
- Check pass & play: the workspace must disappear until the next player reveals it.
- Open a narrow mobile viewport and verify the target board can be used without horizontal scrolling.
- Confirm repository files such as `/README.md`, `/tests/browser.mjs` and `/.git/config` are unavailable publicly.
- Inspect the response headers in browser DevTools to confirm `_headers` was applied.

The GitHub connection and production deployment must be configured in your Cloudflare account. No repository push, account change or live deployment was performed as part of the local code audit.
