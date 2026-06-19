# AIContacts (Contact Dossier)

Upload a CSV of contacts and enrich it with employment info, location, links, and photos —
using **your own** AI provider (Anthropic, OpenAI, or Gemini). Self-hosted, no third-party
SaaS, your API key stays on the server. Ships as a prebuilt Docker image.

![status](https://img.shields.io/badge/self--hosted-ready-success)
![image](https://img.shields.io/badge/ghcr.io-mstras%2Faicontacts-blue)

Repo: <https://github.com/mstras/AIContacts> · Image: `ghcr.io/mstras/aicontacts`

## What it does

Enrichment happens in two layers:

1. **Email-derived (always on, no key, no AI).** From each contact's email domain the server
   works out the **company name, website, and logo** (personal domains like gmail are skipped),
   and pulls a **Gravatar photo** if the person has one.
2. **AI-grounded (optional).** If you configure a provider, the server asks it — with
   **web-search grounding** — for the **job title, location, and a short profile**, then merges
   what it finds on top of layer 1. The prompt is tuned to report only what's actually found and
   to mark anything unconfirmed rather than guess.

You can **edit or override** any field by hand (your values always win), **reject** the machine's
data for a contact, and export a CSV that imports cleanly into **Google Contacts**.

## Architecture

```
browser ── static React app ──► /api/enrich ──► your AI provider (key held here)
                                      └────────► email-derived data + Gravatar
```

A tiny Express server serves the built frontend and exposes `/api/enrich`. Your API key lives in
the server's environment and is **never sent to the browser** — which also sidesteps the CORS and
key-exposure problems you hit calling providers directly from client-side code.

## Quick start — pull the image (recommended)

The published image is at `ghcr.io/mstras/aicontacts`.

```bash
git clone https://github.com/mstras/AIContacts.git
cd AIContacts
cp .env.example .env       # then edit .env: set AI_PROVIDER and AI_API_KEY
docker compose up -d       # pulls ghcr.io/mstras/aicontacts:latest and starts it
```

Or without cloning, using `docker run`:

```bash
docker run -d --name aicontacts -p 8787:8787 --env-file .env \
  ghcr.io/mstras/aicontacts:latest
```

Open **http://localhost:8787** (or your server's host/port). To put it behind your existing
reverse proxy, point the proxy at the container's port `8787`. Update later with
`docker compose pull && docker compose up -d`.

> If the package is private, authenticate first:
> `echo $GHCR_TOKEN | docker login ghcr.io -u <your-username> --password-stdin`

## Build from source instead

```bash
git clone https://github.com/mstras/AIContacts.git
cd AIContacts
cp .env.example .env
# In docker-compose.yml: comment out `pull_policy: always` and uncomment `build: .`
docker compose up -d --build
```

## Publishing the image (GitHub Actions)

`.github/workflows/docker-publish.yml` builds and pushes to GHCR automatically:

- on every push to `main` → `ghcr.io/mstras/aicontacts:latest`
- on a `v*` git tag → a matching version tag

It uses the repo's built-in `GITHUB_TOKEN` (no secrets to add). After the first successful run,
open the package on GitHub and set its visibility to **public** if you want anyone to pull without
logging in.

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

- **Anthropic** — Messages API with the `web_search` tool. Any model your key can access works.
- **OpenAI** — Responses API with the `web_search` tool. If your model doesn't support it, the
  server falls back to a plain call automatically.
- **Gemini** — `generateContent` with `google_search` grounding. Prefer a 2.x model
  (default `gemini-2.0-flash`); older 1.5 models use a different grounding API.

## Local development

```bash
npm install
cp .env.example .env        # set your provider + key
npm run dev                 # server on :8787, Vite dev server on :5173 (proxies /api)
```

Open http://localhost:5173. Build a production bundle with `npm run build`, then `npm start`.

## CSV format

Any CSV with a header row. The app auto-detects common column names and lets you remap them:

- **Name** — `name`, `full name`, or `first name` + `last name`
- **Email** — `email` (unlocks company/website/logo/photo)
- **Company** — `company`, `organization`, `employer` (optional hint)

### Exports

- **Google CSV** — maps everything into Google Contacts' own columns (`Organization Name` /
  `Organization Title`, `Website`, `Notes`, `Photo`, and an `Enriched` label) and passes through any
  Google-format columns your file already had, so a re-import updates contacts without losing phones
  or addresses. Location goes into `Notes` (not a structured address) on purpose. Google's CSV import
  generally won't fetch photo URLs, so the `Photo` column is for reference.
- **Full CSV** — your original columns plus enrichment as extra columns.

Both honor your manual edits and per-contact rejections.

## A note on accuracy & privacy

AI results — even with web search — can be wrong, mismatched, or out of date, which is why every
row links out for manual verification. Enriching contact data is your responsibility: make sure
your use is consistent with the contacts' reasonable expectations and with applicable law
(e.g. GDPR / CCPA). This tool does not return home or street addresses by design.

## License

MIT — see [LICENSE](./LICENSE).
