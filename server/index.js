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
const MODEL_DEEP = process.env.AI_MODEL_DEEP || MODEL; // optional stronger model for deep checks
const CONFIGURED = Boolean(PROVIDER && KEY && DEFAULT_MODEL[PROVIDER]);

// how hard to search per mode
const LIMITS = {
  normal: { maxTokens: 1024, maxUses: 5 },
  deep: { maxTokens: 1500, maxUses: 8 },
};

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

/* ------------------------- name extraction ------------------------- */
const PARTICLES = new Set(["de", "del", "della", "der", "van", "von", "da", "di", "la", "le", "du", "den", "ten", "ter", "dos", "das"]);

function titleCaseWord(w) {
  const lw = w.toLowerCase();
  return lw.replace(/(^|[-'’.])([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
}

function smartTitleCase(name) {
  return name.split(/\s+/).map((w, i) => {
    const lw = w.toLowerCase();
    if (i > 0 && PARTICLES.has(lw)) return lw;
    return titleCaseWord(w);
  }).join(" ");
}

function fromEmailLocal(local) {
  const base = (local || "").split("+")[0];
  const tokens = base.split(/[._\-]+|\d+/).filter((t) => /[a-zA-Z]{2,}/.test(t));
  if (tokens.length >= 2) return tokens.map((t) => titleCaseWord(t.toLowerCase())).join(" ");
  return null; // e.g. "jsmith" — too ambiguous to split safely
}

function cleanName(raw, email) {
  let name = String(raw || "").trim().replace(/^["']+|["']+$/g, "").trim();

  // name that is actually an email / contains an address → treat as missing
  if (!name || /\S+@\S+/.test(name)) name = "";

  // "Last, First" → "First Last"
  if (name.includes(",")) {
    const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2 && !/\d/.test(parts[0])) name = parts[1] + " " + parts[0];
  }

  // drop parenthetical/bracketed extras and collapse whitespace
  name = name.replace(/\s*[([].*?[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();

  // recase only when ALL CAPS or all lowercase (don't break McDonald, DeAngelo, etc.)
  if (name && (name === name.toUpperCase() || name === name.toLowerCase())) name = smartTitleCase(name);

  // still nothing usable → reconstruct from the email local-part
  if (!name) {
    const local = ((email || "").split("@")[0] || "").split("+")[0];
    const derived = fromEmailLocal(local);
    if (derived) name = derived;
    else {
      const tok = local.replace(/[._\-]+/g, " ").replace(/\d+/g, "").trim();
      if (tok && /[a-zA-Z]/.test(tok)) name = smartTitleCase(tok);
    }
  }

  // never return a raw email address as a name
  if (!name) {
    const rawTrim = String(raw || "").trim();
    name = /\S+@\S+/.test(rawTrim) ? "" : rawTrim;
  }

  return name;
}

/* ----------------------------- AI layer ----------------------------- */
function extraLines(extra) {
  if (!extra || typeof extra !== "object") return "";
  const skip = new Set(["__id", "_e"]);
  const lines = [];
  for (const [k, v] of Object.entries(extra)) {
    if (skip.has(k) || v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    lines.push(`- ${k}: ${s.slice(0, 80)}`);
    if (lines.length >= 10) break;
  }
  return lines.join("\n");
}

function buildPrompt({ name, email, company }, { deep, extra } = {}) {
  const domain = emailDomain(email);
  let p = `You are a contact-enrichment researcher. Use web search of PUBLIC sources only to find current professional information for ONE specific person.

Person:
- Name: ${name || "(unknown)"}
- Email: ${email || "(none)"}
- Email domain: ${domain || "(none)"}
- Company hint: ${company || "(none)"}
`;

  if (deep) {
    const hints = extraLines(extra);
    p += `
Additional fields from the user's record (hints; may be noisy):
${hints || "(none)"}

Search strategy — be thorough and try several angles:
1. name + company, 2. name + email domain, 3. the email address itself, 4. name + any title/location hint above.
Check firm or company team/"about" pages, professional directories and bar/association listings, conference
speaker bios, news mentions, and LinkedIn. A strong best match corroborated by at least two independent signals
may be reported at "medium" confidence. Still never fabricate; if nothing checks out, use "none".
`;
  }

  p += `
Return ONLY a single JSON object, no prose, no markdown, with exactly these keys:
{"fullName":string|null,"jobTitle":string|null,"company":string|null,"location":string|null,"linkedinUrl":string|null,"links":[{"label":string,"url":string}],"summary":string|null,"confidence":"high"|"medium"|"low"|"none"}

Rules:
- "fullName" = the person's correct, properly-capitalized full name if you confidently identify them (fix casing/typos, expand from the email if needed); else null.
- Only report facts you actually find. Never guess${deep ? " beyond a corroborated best match" : ", infer,"} or fabricate.
- Prefer a match corroborated by the email domain or company hint. If you cannot identify THIS specific person, set confidence "none" and other fields null/[].
- "location" = city/region/country only. Do NOT include home or street addresses.
- "summary" <= 240 characters.`;
  return p;
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

async function anthropic({ prompt, model, search, maxTokens, maxUses }) {
  const body = { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }];
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

async function openai({ prompt, model, search, maxTokens }) {
  const body = { model, input: prompt, max_output_tokens: maxTokens };
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

async function gemini({ prompt, model, search, maxTokens }) {
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } };
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

async function callAI(ctx, { deep = false, extra = null } = {}) {
  const fn = PROVIDERS[PROVIDER];
  if (!fn) throw new Error("unknown provider: " + PROVIDER);
  const lim = deep ? LIMITS.deep : LIMITS.normal;
  const args = {
    prompt: buildPrompt(ctx, { deep, extra }),
    model: deep ? MODEL_DEEP : MODEL,
    maxTokens: lim.maxTokens,
    maxUses: lim.maxUses,
  };
  let text;
  try {
    text = await fn({ ...args, search: SEARCH });
  } catch (e) {
    if (SEARCH) text = await fn({ ...args, search: false }); // model rejected the search tool → retry plain
    else throw e;
  }
  return extractJson(text);
}

/* ------------------------------ server ------------------------------ */
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_req, res) => {
  res.json({
    provider: PROVIDER || null,
    model: MODEL || null,
    deepModel: MODEL_DEEP || null,
    webSearch: SEARCH,
    configured: CONFIGURED,
  });
});

app.post("/api/enrich", async (req, res) => {
  const { name = "", email = "", company = "", deep = false, extra = null } = req.body || {};
  const data = deriveLocal({ email, company });

  const original = String(name || "").trim();
  const cleaned = cleanName(name, email);
  data.originalName = original;
  data.name = cleaned;
  data.nameSource = cleaned && cleaned !== original ? "cleaned" : "original";

  let aiError = null;
  let usedAI = false;

  if (CONFIGURED) {
    try {
      const ai = await callAI({ name: cleaned || original, email, company }, { deep, extra });
      if (ai && ai.confidence !== "none") {
        for (const k of ["jobTitle", "company", "location", "linkedinUrl", "summary"]) {
          if (ai[k]) { data[k] = ai[k]; usedAI = true; }
        }
        if (ai.photo) data.photo = ai.photo;
        if (Array.isArray(ai.links) && ai.links.length) data.links = ai.links;
        if (ai.fullName && String(ai.fullName).trim()) {
          data.name = String(ai.fullName).trim();
          data.nameSource = "ai";
          usedAI = true;
        }
      }
    } catch (e) {
      aiError = String(e.message || e);
    }
  }

  res.json({ ...data, source: usedAI ? (deep ? "ai-deep" : "ai") : "derived", aiError });
});

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
    ? `AI provider: ${PROVIDER} (${MODEL}${MODEL_DEEP !== MODEL ? `, deep: ${MODEL_DEEP}` : ""}), web search ${SEARCH ? "on" : "off"}`
    : `No AI provider configured — serving email-derived data only.`);
});
