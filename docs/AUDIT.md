# Audit and verification

Reviewed the active static app against the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) and the frontend-design brief. The restored commit already contained the redesigned HTML boards and game engine; this pass preserves that work and fixes its remaining integration issues.

## Findings resolved

- `src/app.js:169` — intact-cell counter ignored partial damage; now subtracts every successful hit, with a browser regression reproducing the original failure.
- `src/app.js:407` — leaving or reloading an active match discarded progress without warning; browser navigation warns, and the home link opens the reset confirmation.
- `src/app.js:136` — probability overlay was visual only; target labels now include relative likelihood when the lens is enabled.
- `styles/styles.css:1038` — mobile controls and the inactive enemy preview pushed the usable chart far down the page; compact controls, hidden preview during setup and target-first order during play.
- `styles/styles.css:1082` — tight phone grids and header needed explicit handling at 320px; narrow-screen wrapping and smaller grid gaps retain at least 24px target cells.
- `index.html:12` — favicon URL could not resolve from a plain static root; moved the favicon, error page and hosting headers from `public/` to the root.
- `index.html:81` — specialist wording made controls and rules harder to understand; simplified opponent/map labels, instructions and feedback.
- `README.md:1` — only the original p5.js setup was documented; added current static-server, test and deployment instructions while keeping the course archive.

## Verification performed

- Six Node tests: fleet size/straightness/non-overlap, 100 seeded maps with islands, bounded island generation, shot validation and turns, bot targeting, and 20 complete bot-vs-bot matches.
- Thirteen Chromium checks: keyboard shots; reset cancellation/confirmation; hidden, non-dismissible shared-device handoffs; lens reset between players; immediate victory and single record update; navigation warning; unavailable storage; corrupted records; queued-bot cancellation; static assets/help; and responsive/accessibility checks at 320, 375, 768, 1024 and 1440px.
- Axe reported zero violations in setup and play at all five widths and in the help dialog.
- JavaScript syntax checks and `git diff --check` passed.
- The deployment allowlist was checked with Git's ignore matcher: active HTML/CSS/JS assets are included; repository metadata, old scripts, docs and tests are excluded.
- Desktop and mobile screenshots were inspected. No browser JavaScript errors were reported during the final preview capture.

## Scope and limits

No framework, application package manifest, compilation step, cf configuration or Vite configuration is required. Node and the optional browser tools are development checks only. The unused original `scripts/`, bundled `libs/p5.js` and `styles/normalize.css` were removed after checking active source and test references. Course assets remain because the README archive references them; they are excluded from deployment.

The app stores completed solo records in this browser; it does not store active games or synchronize devices. Pass & play is intended for two people sharing one device. Fleets live in client memory, so this is not a security boundary against someone inspecting browser developer tools.

Cloudflare account configuration, a Git push, actual Workers Builds execution and production headers were not tested against a live deployment. The deployment guide describes these remaining account-side steps and the host-dependent custom-404 behavior. Browser automation ran in Chromium; Safari, Firefox and physical touch devices were not exercised.
