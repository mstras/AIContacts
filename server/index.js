import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");
const PORT = process.env.PORT || 8787;

const PROVIDER = (process.env.AI_PROVIDER || "").toLowerCase();
const KEY = process.env.AI_API_KEY || "";
const SEARCH = (process.env.AI_WEB_SEARCH ?? "true").toLowerCase() !== "false";
const REQUEST_TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 60000);

const DEFAULT_MODEL = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
};
const MODEL = process.env.AI_MODEL || DEFAULT_MODEL[PROVIDER] || "";
const CONFIGURED = Boolean(PROVIDER && KEY && DEFAULT_MODEL[PROVIDER]);

/* ------------------------- deterministic layer ------------------------- */
const FREE = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "mail.com", "zoho.com",
  "yandex.com", "fastmail.com", "hey.com", "comcast.net", "verizon.net", "att.net",
]);
const SLD = new Set(["co", "com", "org", "gov", "ac", "net", "edu"]);

const emailDomain = (email) => {
  const at = (email || "").split("@")[1];
  return at ? at.trim().toLowerCase().replace(/[>,;].*$/, "") : "";
};

function guessCompany(domain) {
  const parts = domain.replace(/^www\./, "").split(".");
  let core = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  if (parts.length > 2 && SLD.has(parts[parts.length - 2])) core = parts[parts.length - 3];
  return (core || "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function gravatar(email) {
  if (!email || !/@/.test(email)) return null;
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=240`;
}

function deriveLocal({ email, company }) {
  const d = {
    jobTitle: null, company: company || null, location: null, linkedinUrl: null,
    links: [], summary: null, photo: null, logo: null, website: null,
  };
  const domain = emailDomain(email);
  if (domain && !FREE.has(domain)) {
    d.website = "https://" + domain;
    d.logo = `https://logo.clearbit.com/${domain}`;
    if (!d.company) d.company = guessCompany(domain);
  }
  d.photo = gravatar(email);
  return d;
}

/* ----------------------------- AI layer ----------------------------- */
function buildPrompt({ name, email, company }) {
  return `You are a contact-enrichment researcher. Use web search of PUBLIC sources only to find current professional information for ONE specific person.

Person:
- Name: ${name || "(unknown)"}
- Email: ${email || "(none)"}
- Company hint: ${company || "(none)"}

Return ONLY a single JSON object, no prose, no markdown, with exactly these keys:
{"jobTitle":string|null,"company":string|null,"location":string|null,"linkedinUrl":string|null,"links":[{"label":string,"url":string}],"summary":string|null,"confidence":"high"|"medium"|"low"|"none"}

Rules:
- Only report facts you actually find. Never guess, infer, or fabricate.
- Prefer a match corroborated by the email domain or the company hint. If you cannot confidently identify THIS specific person, set confidence to "none" and all other fields to null/[].
- "location" = city/region/country only. Do NOT include home or street addresses.
- "summary" <= 240 characters. Be terse so the JSON fits.`;
}

function extractJson(text) {
  if (!text) return null;
  const t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function withTimeout() {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), REQUEST_TIMEOUT);
  return { signal: c.signal, clear: () => clearTimeout(t) };
}

async function anthropic({ prompt, model, search }) {
  const body = { model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  const { signal, clear } = withTimeout();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 200));
    const d = await r.json();
    return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } finally { clear(); }
}

async function openai({ prompt, model, search }) {
  const body = { model, input: prompt, max_output_tokens: 1024 };
  if (search) body.tools = [{ type: "web_search" }];
  const { signal, clear } = withTimeout();
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("openai " + r.status + " " + (await r.text()).slice(0, 200));
    const d = await r.json();
    if (d.output_text) return d.output_text;
    return (d.output || [])
      .flatMap((o) => (o.content || []).filter((c) => c.type === "output_text").map((c) => c.text))
      .join("\n");
  } finally { clear(); }
}

async function gemini({ prompt, model, search }) {
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024 } };
  if (search) body.tools = [{ google_search: {} }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const { signal, clear } = withTimeout();
  try {
    const r = await fetch(url, {
      method: "POST", signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("gemini " + r.status + " " + (await r.text()).slice(0, 200));
    const d = await r.json();
    return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("\n");
  } finally { clear(); }
}

const PROVIDERS = { anthropic, openai, gemini };

async function callAI(ctx) {
  const fn = PROVIDERS[PROVIDER];
  if (!fn) throw new Error("unknown provider: " + PROVIDER);
  const args = { prompt: buildPrompt(ctx), model: MODEL };
  let text;
  try {
    text = await fn({ ...args, search: SEARCH });
  } catch (e) {
    // If web-search tooling isn't accepted by the chosen model, retry once without it.
    if (SEARCH) text = await fn({ ...args, search: false });
    else throw e;
  }
  return extractJson(text);
}

/* ------------------------------ server ------------------------------ */
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_req, res) => {
  res.json({ provider: PROVIDER || null, model: MODEL || null, webSearch: SEARCH, configured: CONFIGURED });
});

app.post("/api/enrich", async (req, res) => {
  const { name = "", email = "", company = "" } = req.body || {};
  const data = deriveLocal({ email, company });
  let aiError = null;
  let usedAI = false;

  if (CONFIGURED) {
    try {
      const ai = await callAI({ name, email, company });
      if (ai && ai.confidence !== "none") {
        for (const k of ["jobTitle", "company", "location", "linkedinUrl", "summary"]) {
          if (ai[k]) { data[k] = ai[k]; usedAI = true; }
        }
        if (ai.photo) data.photo = ai.photo;
        if (Array.isArray(ai.links) && ai.links.length) data.links = ai.links;
      }
    } catch (e) {
      aiError = String(e.message || e);
    }
  }

  res.json({ ...data, source: usedAI ? "ai" : "derived", aiError });
});

// Static frontend (built by Vite into /dist)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("*", (_req, res) =>
    res.status(200).send("Frontend not built yet. Run `npm run build`, then restart. API is live at /api/config."));
}

app.listen(PORT, () => {
  console.log(`Contact Dossier listening on :${PORT}`);
  console.log(CONFIGURED
    ? `AI provider: ${PROVIDER} (${MODEL}), web search ${SEARCH ? "on" : "off"}`
    : `No AI provider configured — serving email-derived data only.`);
});
