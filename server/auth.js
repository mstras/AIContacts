// Google OAuth login, session cookies, and the email allowlist.
import crypto from "node:crypto";
import {
  GOOGLE_ENABLED, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URL,
  ALLOWED_EMAILS, GOOGLE_SCOPES, COOKIE_SECURE,
} from "./config.js";
import { upsertUser, createSession, getSessionUser, destroySession } from "./db.js";

const SID = "aic_sid";
const OAUTH_STATE = "aic_oauth";

/* ----------------------------- cookies ----------------------------- */
export function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res, name, value, { maxAge, clear } = {}) {
  const bits = [`${name}=${clear ? "" : encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (COOKIE_SECURE) bits.push("Secure");
  if (clear) bits.push("Max-Age=0");
  else if (maxAge) bits.push(`Max-Age=${maxAge}`);
  res.append("Set-Cookie", bits.join("; "));
}

export function isAllowed(email) {
  return ALLOWED_EMAILS.includes(String(email || "").toLowerCase());
}

/* ------------------------- current user ------------------------- */
// In local mode (no Google) a single implicit user owns everything.
const LOCAL_USER = { id: 0, email: "local", name: "Local", local: true };

export function currentUser(req) {
  if (!GOOGLE_ENABLED) return LOCAL_USER;
  const sid = parseCookies(req)[SID];
  return getSessionUser(sid) || null;
}

// Blocks API routes for logged-out users when Google is enabled.
export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "login required" });
  req.user = user;
  next();
}

/* --------------------------- OAuth routes --------------------------- */
async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return json;
}

export function mountAuth(app) {
  app.get("/api/me", (req, res) => {
    if (!GOOGLE_ENABLED) return res.json({ googleEnabled: false, local: true });
    const user = currentUser(req);
    if (!user) return res.json({ googleEnabled: true, needsLogin: true });
    res.json({ googleEnabled: true, email: user.email, name: user.name, picture: user.picture });
  });

  if (!GOOGLE_ENABLED) return;

  app.get("/auth/google", (req, res) => {
    if (!OAUTH_REDIRECT_URL) return res.status(500).send("Set PUBLIC_URL or OAUTH_REDIRECT_URL.");
    const state = crypto.randomBytes(16).toString("hex");
    setCookie(res, OAUTH_STATE, state, { maxAge: 600 });
    const p = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URL,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });
    res.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + p.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const cookies = parseCookies(req);
      if (!code || !state || state !== cookies[OAUTH_STATE]) {
        return res.status(400).send("Invalid OAuth state. Try signing in again.");
      }
      setCookie(res, OAUTH_STATE, "", { clear: true });

      const tok = await fetchJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: OAUTH_REDIRECT_URL, grant_type: "authorization_code",
        }).toString(),
      });

      const info = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: "Bearer " + tok.access_token },
      });
      const email = String(info.email || "").toLowerCase();

      if (!info.email_verified || !isAllowed(email)) {
        return res.status(403).send(denyPage(email));
      }

      const userId = upsertUser({
        email, name: info.name || info.given_name || email, picture: info.picture || null,
        refreshToken: tok.refresh_token || null,
        accessToken: tok.access_token || null,
        tokenExpiry: tok.expires_in ? Date.now() + tok.expires_in * 1000 : null,
      });
      const sid = createSession(userId);
      setCookie(res, SID, sid, { maxAge: 30 * 86400 });
      res.redirect("/");
    } catch (e) {
      res.status(500).send("Sign-in failed: " + String(e.message || e));
    }
  });

  app.post("/auth/logout", (req, res) => {
    destroySession(parseCookies(req)[SID]);
    setCookie(res, SID, "", { clear: true });
    res.json({ ok: true });
  });
}

function denyPage(email) {
  return `<!doctype html><meta charset="utf-8"><title>Not authorized</title>
<body style="font-family:system-ui;max-width:420px;margin:12vh auto;padding:0 20px;color:#15171c;text-align:center">
<h2>Not authorized</h2>
<p style="color:#6b6f76">${email ? `<b>${email}</b> isn't on the allowlist for this instance.` : "This account isn't allowed."}
Ask the owner to add you to <code>ALLOWED_EMAILS</code>.</p>
<p><a href="/" style="color:#c0851a">Back</a></p></body>`;
}
