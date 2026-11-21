// Per-user persistence: users, encrypted Google tokens, sessions, and cached contacts.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, SESSION_SECRET, SESSION_TTL_DAYS } from "./config.js";

fs.mkdirSync(DATA_DIR, { recursive: true });

/* --- token encryption key: env secret, else a persisted random one --- */
function resolveSecret() {
  if (SESSION_SECRET) return SESSION_SECRET;
  const p = path.join(DATA_DIR, "secret.key");
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(p, s, { mode: 0o600 });
    console.log("Generated a persistent session secret at", p);
    return s;
  }
}
const KEY = crypto.scryptSync(resolveSecret(), "aicontacts.enc.v1", 32);

export function encrypt(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(b64) {
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------ schema ------------------------------ */
const db = new Database(path.join(DATA_DIR, "aicontacts.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  refresh_token TEXT,
  access_token TEXT,
  token_expiry INTEGER,
  created_at INTEGER,
  synced_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS contacts (
  user_id INTEGER NOT NULL,
  resource_name TEXT NOT NULL,
  etag TEXT,
  name TEXT, email TEXT, company TEXT, title TEXT, photo TEXT,
  raw_json TEXT,
  enrichment_json TEXT,
  updated_at INTEGER,
  PRIMARY KEY (user_id, resource_name)
);
`);

const now = () => Date.now();

/* ------------------------------ users ------------------------------ */
export function upsertUser({ email, name, picture, refreshToken, accessToken, tokenExpiry }) {
  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (existing) {
    db.prepare(`UPDATE users SET name=?, picture=?,
        refresh_token = COALESCE(?, refresh_token),
        access_token=?, token_expiry=? WHERE id=?`)
      .run(name, picture,
        refreshToken ? encrypt(refreshToken) : null,
        accessToken ? encrypt(accessToken) : null, tokenExpiry || null, existing.id);
    return existing.id;
  }
  const info = db.prepare(`INSERT INTO users (email, name, picture, refresh_token, access_token, token_expiry, created_at)
      VALUES (?,?,?,?,?,?,?)`)
    .run(email, name, picture,
      refreshToken ? encrypt(refreshToken) : null,
      accessToken ? encrypt(accessToken) : null, tokenExpiry || null, now());
  return info.lastInsertRowid;
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function saveAccessToken(userId, accessToken, tokenExpiry) {
  db.prepare("UPDATE users SET access_token=?, token_expiry=? WHERE id=?")
    .run(accessToken ? encrypt(accessToken) : null, tokenExpiry || null, userId);
}

export function markSynced(userId) {
  db.prepare("UPDATE users SET synced_at=? WHERE id=?").run(now(), userId);
}

/* ----------------------------- sessions ----------------------------- */
export function createSession(userId) {
  const id = crypto.randomBytes(24).toString("base64url");
  const created = now();
  const expires = created + SESSION_TTL_DAYS * 86400_000;
  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)")
    .run(id, userId, created, expires);
  return id;
}

export function getSessionUser(sid) {
  if (!sid) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sid);
  if (!s) return null;
  if (s.expires_at < now()) { destroySession(sid); return null; }
  return getUserById(s.user_id);
}

export function destroySession(sid) {
  if (sid) db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
}

/* ----------------------------- contacts ----------------------------- */
export function upsertContacts(userId, list) {
  const stmt = db.prepare(`INSERT INTO contacts
      (user_id, resource_name, etag, name, email, company, title, photo, raw_json, enrichment_json, updated_at)
      VALUES (@user_id,@resource_name,@etag,@name,@email,@company,@title,@photo,@raw_json,
        COALESCE((SELECT enrichment_json FROM contacts WHERE user_id=@user_id AND resource_name=@resource_name), NULL),
        @updated_at)
      ON CONFLICT(user_id, resource_name) DO UPDATE SET
        etag=excluded.etag, name=excluded.name, email=excluded.email, company=excluded.company,
        title=excluded.title, photo=excluded.photo, raw_json=excluded.raw_json, updated_at=excluded.updated_at`);
  const tx = db.transaction((rows) => {
    for (const c of rows) {
      stmt.run({
        user_id: userId, resource_name: c.resourceName, etag: c.etag || null,
        name: c.name || null, email: c.email || null, company: c.company || null,
        title: c.title || null, photo: c.photo || null,
        raw_json: c.raw ? JSON.stringify(c.raw) : null, updated_at: now(),
      });
    }
  });
  tx(list);
}

function rowToContact(r) {
  return {
    resourceName: r.resource_name, etag: r.etag,
    name: r.name, email: r.email, company: r.company, title: r.title, photo: r.photo,
    enrichment: r.enrichment_json ? JSON.parse(r.enrichment_json) : null,
  };
}

export function listContacts(userId) {
  return db.prepare("SELECT * FROM contacts WHERE user_id=? ORDER BY name COLLATE NOCASE")
    .all(userId).map(rowToContact);
}

export function getContactRaw(userId, resourceName) {
  const r = db.prepare("SELECT raw_json FROM contacts WHERE user_id=? AND resource_name=?").get(userId, resourceName);
  return r && r.raw_json ? JSON.parse(r.raw_json) : null;
}

export function saveEnrichment(userId, resourceName, enrichment) {
  db.prepare("UPDATE contacts SET enrichment_json=?, updated_at=? WHERE user_id=? AND resource_name=?")
    .run(enrichment ? JSON.stringify(enrichment) : null, now(), userId, resourceName);
}

export function getEnrichment(userId, resourceName) {
  const r = db.prepare("SELECT enrichment_json FROM contacts WHERE user_id=? AND resource_name=?").get(userId, resourceName);
  return r && r.enrichment_json ? JSON.parse(r.enrichment_json) : null;
}

export default db;
