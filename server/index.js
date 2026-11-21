import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  PORT, DIST, AUTH_ON, AUTH_USER, AUTH_PASS, GOOGLE_ENABLED, ALLOWED_EMAILS, PUBLIC_URL,
} from "./config.js";
import { enrichContact, aiStatus } from "./enrich.js";
import { mountAuth, requireAuth } from "./auth.js";
import { markSynced } from "./db.js";
import * as store from "./db.js";
import { listConnections, pushContact } from "./google.js";

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const app = express();
app.disable("x-powered-by");

// Optional shared-password gate in front of everything (incl. Google login).
app.use((req, res, next) => {
  if (!AUTH_ON) return next();
  const m = (req.headers.authorization || "").match(/^Basic\s+(.+)$/i);
  if (m) {
    const dec = Buffer.from(m[1], "base64").toString();
    const i = dec.indexOf(":");
    if (i >= 0 && safeEqual(dec.slice(0, i), AUTH_USER) && safeEqual(dec.slice(i + 1), AUTH_PASS)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="AIContacts", charset="UTF-8"');
  return res.status(401).send("Authentication required.");
});

app.use(express.json({ limit: "2mb" }));

/* ------------------------------ config ------------------------------ */
app.get("/api/config", (_req, res) => {
  res.json({ ...aiStatus(), googleEnabled: GOOGLE_ENABLED });
});

mountAuth(app);

/* ------------------------------ enrich ------------------------------ */
app.post("/api/enrich", async (req, res) => {
  const { name = "", email = "", company = "", deep = false, extra = null, requireSearch = false } = req.body || {};
  try {
    const data = await enrichContact({ name, email, company, deep, extra, requireSearch });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* -------------------------- Google contacts -------------------------- */
function needGoogle(res) {
  if (!GOOGLE_ENABLED) { res.status(400).json({ error: "Google login is not configured on this server." }); return true; }
  return false;
}

// Cached contacts for the logged-in user.
app.get("/api/contacts", requireAuth, (req, res) => {
  res.json({ contacts: store.listContacts(req.user.id), syncedAt: req.user.synced_at || null });
});

// Pull fresh from Google and update the cache.
app.post("/api/sync", requireAuth, async (req, res) => {
  if (needGoogle(res)) return;
  try {
    const people = await listConnections(req.user.id);
    store.upsertContacts(req.user.id, people);
    markSynced(req.user.id);
    res.json({ contacts: store.listContacts(req.user.id), syncedAt: Date.now(), pulled: people.length });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Persist a contact's enrichment / edits / rejection.
app.patch("/api/contacts", requireAuth, (req, res) => {
  const rn = req.body?.resourceName;
  if (!rn) return res.status(400).json({ error: "resourceName required" });
  store.saveEnrichment(req.user.id, rn, req.body?.enrichment ?? null);
  res.json({ ok: true });
});

// Review-then-push: write enriched fields back to the given contacts.
app.post("/api/push", requireAuth, async (req, res) => {
  if (needGoogle(res)) return;
  const names = Array.isArray(req.body?.resourceNames) ? req.body.resourceNames : [];
  if (!names.length) return res.status(400).json({ error: "no contacts selected" });

  const results = [];
  for (const rn of names) {
    const enrichment = store.getEnrichment(req.user.id, rn);
    try {
      const r = await pushContact(req.user.id, rn, enrichment, null);
      results.push({ resourceName: rn, ...r });
    } catch (e) {
      results.push({ resourceName: rn, ok: false, error: String(e.message || e) });
    }
  }
  res.json({
    results,
    pushed: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.ok && !r.skipped).length,
  });
});

/* ------------------------------ static ------------------------------ */
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("*", (_req, res) =>
    res.status(200).send("Frontend not built yet. Run `npm run build`, then restart. API is live at /api/config."));
}

app.listen(PORT, () => {
  console.log(`AIContacts listening on :${PORT}`);
  console.log(`Basic auth: ${AUTH_ON ? `on (user "${AUTH_USER}")` : "off"}`);
  if (GOOGLE_ENABLED) {
    console.log(`Google login: on — ${ALLOWED_EMAILS.length} allowed email(s)${PUBLIC_URL ? `, redirect ${PUBLIC_URL}/auth/google/callback` : ""}`);
    if (!ALLOWED_EMAILS.length) console.log("  WARNING: ALLOWED_EMAILS is empty — nobody can sign in. Set it in .env.");
  } else {
    console.log("Google login: off (local single-user mode) — set GOOGLE_CLIENT_ID/SECRET to enable.");
  }
  const ai = aiStatus();
  console.log(ai.configured
    ? `AI provider: ${ai.provider} (${ai.model}${ai.deepModel !== ai.model ? `, deep: ${ai.deepModel}` : ""}), web search ${ai.webSearch ? "on" : "off"}`
    : "No AI provider configured — serving email-derived data only.");
});
