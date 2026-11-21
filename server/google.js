// Google People API: refresh tokens, pull connections, and push enriched fields back.
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "./config.js";
import { getUserById, saveAccessToken, decrypt } from "./db.js";

const PERSON_FIELDS = "names,emailAddresses,organizations,urls,biographies,photos,metadata";

/* --------------------------- access token --------------------------- */
export async function getAccessToken(userId) {
  const user = getUserById(userId);
  if (!user) throw new Error("no user");
  const access = decrypt(user.access_token);
  if (access && user.token_expiry && user.token_expiry > Date.now() + 60_000) return access;

  const refresh = decrypt(user.refresh_token);
  if (!refresh) throw new Error("Google not connected — sign in again to grant access.");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refresh, grant_type: "refresh_token",
    }).toString(),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("token refresh failed: " + (d.error_description || d.error || r.status));
  saveAccessToken(userId, d.access_token, Date.now() + (d.expires_in || 3600) * 1000);
  return d.access_token;
}

async function api(userId, url, opts = {}) {
  const token = await getAccessToken(userId);
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), authorization: "Bearer " + token } });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) throw new Error(`People API ${r.status}: ${(json?.error?.message) || text.slice(0, 200)}`);
  return json;
}

/* ------------------------------ pull ------------------------------ */
function mapPerson(p) {
  const name = p.names?.[0]?.displayName || "";
  const email = p.emailAddresses?.[0]?.value || "";
  const org = p.organizations?.[0] || {};
  const photo = (p.photos || []).find((x) => !x.default)?.url || p.photos?.[0]?.url || "";
  return {
    resourceName: p.resourceName, etag: p.etag,
    name, email, company: org.name || "", title: org.title || "", photo,
    raw: p,
  };
}

export async function listConnections(userId) {
  const out = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ pageSize: "1000", personFields: PERSON_FIELDS, sortOrder: "LAST_MODIFIED_DESCENDING" });
    if (pageToken) params.set("pageToken", pageToken);
    const d = await api(userId, "https://people.googleapis.com/v1/people/me/connections?" + params.toString());
    for (const p of d.connections || []) out.push(mapPerson(p));
    pageToken = d.nextPageToken || "";
  } while (pageToken);
  return out;
}

/* ------------------------- effective fields ------------------------- */
// Mirror of the frontend's effective()/effectiveName(): manual edits win; reject discards AI data.
function effective(e) {
  const data = e?.data || {}, ed = e?.edits || {}, rej = e?.rejected;
  const pick = (k) => (ed[k] != null && String(ed[k]).trim() !== "") ? String(ed[k]).trim() : (rej ? "" : (data[k] || ""));
  return {
    name: pick("name"),
    jobTitle: pick("jobTitle"), company: pick("company"), location: pick("location"),
    linkedinUrl: pick("linkedinUrl"), website: pick("website"), summary: pick("summary"),
    rejected: !!rej,
  };
}

function hasUrl(urls, value) {
  return (urls || []).some((u) => (u.value || "").toLowerCase() === value.toLowerCase());
}

// Keep only writable subfields — People API rejects output-only ones (metadata, displayName…).
const W_ORG = ["name", "title", "department", "type", "jobDescription", "domain", "location", "symbol", "phoneticName"];
const cleanOrg = (o) => { const c = {}; for (const k of W_ORG) if (o && o[k] != null) c[k] = o[k]; return c; };
const cleanUrl = (u) => ({ value: u.value, ...(u.type ? { type: u.type } : {}) });

/** Build a merge-safe updateContact body from the live person + stored enrichment. */
function buildUpdate(person, enrichment, fallbackName) {
  const f = effective(enrichment);
  const fields = [];
  const body = { etag: person.etag };

  if (f.name) {
    const parts = f.name.split(/\s+/);
    const ex = person.names?.[0] || {};
    const nm = { givenName: parts[0] || "", familyName: parts.slice(1).join(" ") || "" };
    for (const k of ["middleName", "honorificPrefix", "honorificSuffix"]) if (ex[k]) nm[k] = ex[k];
    body.names = [nm];
    fields.push("names");
  }

  if (f.company || f.jobTitle) {
    const org = cleanOrg(person.organizations?.[0] || {});
    if (f.company) org.name = f.company;
    if (f.jobTitle) org.title = f.jobTitle;
    body.organizations = [org, ...(person.organizations || []).slice(1).map(cleanOrg)];
    fields.push("organizations");
  }

  const urls = (person.urls || []).map(cleanUrl);
  let urlsChanged = false;
  if (f.linkedinUrl && !hasUrl(urls, f.linkedinUrl)) { urls.push({ value: f.linkedinUrl, type: "LinkedIn" }); urlsChanged = true; }
  if (f.website && !hasUrl(urls, f.website)) { urls.push({ value: f.website, type: "homepage" }); urlsChanged = true; }
  if (urlsChanged) { body.urls = urls; fields.push("urls"); }

  const noteBits = [];
  if (f.location) noteBits.push("Location: " + f.location);
  if (f.summary) noteBits.push(f.summary);
  if (noteBits.length) {
    const existing = (person.biographies?.[0]?.value || "").trim();
    const addition = noteBits.join("\n");
    const value = existing.includes(addition) ? existing : (existing ? existing + "\n" : "") + addition;
    body.biographies = [{ value, contentType: "TEXT_PLAIN" }];
    fields.push("biographies");
  }

  return { fields, body };
}

/** Push enrichment for one contact. Returns {ok, skipped?, reason?, error?}. */
export async function pushContact(userId, resourceName, enrichment, cachedName) {
  if (enrichment?.rejected) return { ok: false, skipped: true, reason: "rejected" };

  // Fetch the live person for a fresh etag + current fields to merge against.
  const person = await api(userId,
    `https://people.googleapis.com/v1/${resourceName}?personFields=${PERSON_FIELDS}`);

  const { fields, body } = buildUpdate(person, enrichment, cachedName);
  if (!fields.length) return { ok: false, skipped: true, reason: "nothing to update" };

  const url = `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=${fields.join(",")}`;
  const updated = await api(userId, url, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { ok: true, fields, etag: updated.etag };
}
