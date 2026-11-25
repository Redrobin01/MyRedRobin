# My Red Robin

The Red Robin Art Academy app for families (home-screen name "My Red Robin"). Version 0.1: class swaps. GitHub Pages publishes the `site/` folder on every push to `main` (.github/workflows/pages.yml), at https://app.redrobinart.co.uk (site/CNAME; DNS: GoDaddy CNAME app → redrobin01.github.io). Until then: https://redrobin01.github.io/MyRedRobin/. (Netlify was used first, until its free plan's monthly publish allowance ran out on 25-Nov-2026.)

- `site/` – what Netlify publishes: `index.html` (built), `manifest.webmanifest`, `sw.js`, `icons/`.
- `src/` – the parts: `app.js` (login, personal links, remember-me, add-to-home-screen help), `portal.js` + `portal.css`
  (the screens, copied from the Rocker's Portal tab), `rocker.css` (the Rocker's styles), `site.css`, `template.html`,
  `config.json` (bridge URL, version, demo flag).
- `build/build.py` – joins the parts into `site/index.html`. Run `python3 build/build.py` after any change.
- `api/Code.gs` – the bridge script. It lives in Carla's Google account (script.google.com, "Red Robin Swaps bridge"),
  runs as Carla and reads the Red Robin Database and the registration forms. Version 1 is read-only (swaps are a demo).
- `test/` – a local test server (runs the bridge against a copy of the data) and the browser tests.

Personal links: `https://<site>/?c=<code>` – the code is in the PortalLinks tab of the Red Robin Database.
