# Contact Dossier

Upload a CSV of contacts and enrich it with employment info, location, links, and photos —
using **your own** AI provider (Anthropic, OpenAI, or Gemini). Self-hosted, no third-party
SaaS, your API key stays on the server. Built to run in Docker.

![status](https://img.shields.io/badge/self--hosted-ready-success)

## What it does

Enrichment happens in two layers:

1. **Email-derived (always on, no key, no AI).** From each contact's email domain the server
   works out the **company name, website, and logo** (personal domains like gmail are skipped),
   and pulls a **Gravatar photo** if the person has one.
2. **AI-grounded (optional).** If you configure a provider, the server asks it — with
   **web-search grounding** — for the **job title, location, and a short profile**, then merges
   what it finds on top of layer 1. The prompt is tuned to report only what's actually found and
   to mark anything unconfirmed rather than guess.

Each contact also gets one-click **LinkedIn / Google / company-site** links so you can verify by
hand before acting on anything.

## Architecture

```
browser ── static React app ──► /api/enrich ──► your AI provider (key held here)
                                      └────────► email-derived data + Gravatar
```

A tiny Express server serves the built frontend and exposes `/api/enrich`. Your API key lives in
the server's environment and is **never sent to the browser** — which also sidesteps the CORS and
key-exposure problems you hit calling providers directly from client-side code.

## Quick start (Docker)

```bash
git clone https://github.com/<you>/contact-dossier.git
cd contact-dossier
cp .env.example .env       # then edit .env: set AI_PROVIDER and AI_API_KEY
docker compose up -d --build
```

Open **http://localhost:8787** (or your server's host/port). To put it behind your existing reverse
proxy, point the proxy at the container's port `8787`.

## Configuration

All config is via environment variables (see `.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | _(blank)_ | `anthropic`, `openai`, or `gemini`. Blank = email-derived only. |
| `AI_API_KEY` | _(blank)_ | Your key for that provider. |
| `AI_MODEL` | per-provider | Override the model. Defaults: `claude-sonnet-4-6` / `gpt-4o` / `gemini-2.0-flash`. |
| `AI_WEB_SEARCH` | `true` | Use the provider's web-search grounding. Auto-retries without it if the model rejects the tool. |
| `AI_TIMEOUT_MS` | `60000` | Per-request timeout for the AI call. |
| `PORT` | `8787` | Listen port. |

After changing `.env`, restart: `docker compose up -d`.

### Provider notes

- **Anthropic** — uses the Messages API with the `web_search` tool. Any model your key can access
  works; set `AI_MODEL` accordingly.
- **OpenAI** — uses the Responses API with the `web_search` tool. If your chosen model doesn't
  support the tool, the server falls back to a plain call automatically (results then rely on the
  model's own knowledge).
- **Gemini** — uses `generateContent` with `google_search` grounding. The default
  `gemini-2.0-flash` supports it; older 1.5 models use a different grounding API, so prefer a 2.x
  model.

## Local development

```bash
npm install
cp .env.example .env        # set your provider + key
npm run dev                 # server on :8787, Vite dev server on :5173 (proxies /api)
```

Open http://localhost:5173. Build a production bundle with `npm run build` (outputs to `dist/`),
then `npm start` to serve it from the Express server on `:8787`.

## CSV format

Any CSV with a header row. The app auto-detects common column names and lets you remap them:

- **Name** — `name`, `full name`, or `first name` + `last name`
- **Email** — `email` (unlocks company/website/logo/photo)
- **Company** — `company`, `organization`, `employer` (optional hint)

Export produces your original columns plus `Enriched Title`, `Enriched Company`, `Location`,
`LinkedIn`, `Website`, `Profile Summary`, `Photo URL`, `Source`, and `Result`.

## A note on accuracy & privacy

AI results — even with web search — can be wrong, mismatched, or out of date, which is why every
row links out for manual verification. Enriching contact data is your responsibility: make sure
your use is consistent with the contacts' reasonable expectations and with applicable law
(e.g. GDPR / CCPA). This tool does not return home or street addresses by design.

## License

MIT — see [LICENSE](./LICENSE).
