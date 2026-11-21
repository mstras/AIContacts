// Central configuration — every environment variable is read here.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, "..");
export const DIST = path.join(ROOT, "dist");
export const PORT = Number(process.env.PORT || 8787);

// Where SQLite + the persisted secret live (mount this as a volume).
export const DATA_DIR = process.env.DATA_DIR || "/data";

// Public origin, used to build the OAuth redirect and to decide cookie security.
export const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");

/* ----------------------------- auth ----------------------------- */
// Optional outer HTTP Basic Auth gate (shared password).
export const AUTH_USER = process.env.AUTH_USER || "admin";
export const AUTH_PASS = process.env.AUTH_PASSWORD || "";
export const AUTH_ON = Boolean(AUTH_PASS);

// Google OAuth (per-user login). Enabled only when a client id + secret are present.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
export const OAUTH_REDIRECT_URL =
  process.env.OAUTH_REDIRECT_URL ||
  (PUBLIC_URL ? `${PUBLIC_URL}/auth/google/callback` : "");

// Allowlist: only these Google emails may sign in. Empty = nobody (fail closed).
export const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// Secret for session cookies + token encryption. If unset, a random one is
// generated and persisted under DATA_DIR so logins survive restarts.
export const SESSION_SECRET = process.env.SESSION_SECRET || "";

// Secure cookies by default when served over https.
export const COOKIE_SECURE =
  (process.env.COOKIE_SECURE ?? (PUBLIC_URL.startsWith("https://") ? "true" : "false")) === "true";

export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

/* ------------------------------ AI ------------------------------ */
export const PROVIDER = (process.env.AI_PROVIDER || "").toLowerCase();
export const AI_KEY = process.env.AI_API_KEY || "";
export const SEARCH = (process.env.AI_WEB_SEARCH ?? "true").toLowerCase() !== "false";
export const REQUEST_TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 60000);

export const DEFAULT_MODEL = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
};
export const MODEL = process.env.AI_MODEL || DEFAULT_MODEL[PROVIDER] || "";
export const MODEL_DEEP = process.env.AI_MODEL_DEEP || MODEL;
export const AI_CONFIGURED = Boolean(PROVIDER && AI_KEY && DEFAULT_MODEL[PROVIDER]);

export const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/contacts",
].join(" ");
