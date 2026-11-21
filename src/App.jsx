import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  Upload, Search, Download, X, ChevronDown, ChevronRight, Settings,
  Link as LinkIcon, MapPin, Briefcase, StopCircle, Info, RotateCw, Globe, ExternalLink,
  Cpu, AlertTriangle, Ban, Undo2, Pencil, Radar,
  RefreshCw, LogOut, LogIn, Cloud, CloudUpload, UploadCloud,
} from "lucide-react";

const POOL = 4; // concurrent enrichment requests

/* ----------------------------- styles ----------------------------- */
const STYLE = `
.cd-root{--ink:#15171c;--ink2:#23262e;--page:#e8eaed;--paper:#fbfbfa;
  --signal:#c0851a;--signal-soft:#f1e6cd;--line:#d9d9d4;--muted:#6b6f76;
  --good:#2f7d4f;--bad:#b1442f;
  background:var(--page);min-height:100vh;color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;padding:32px 20px 80px;}
.cd-wrap{max-width:1120px;margin:0 auto;}
.cd-mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;}
.cd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:8px;flex-wrap:wrap;}
.cd-word{font-family:Georgia,"Times New Roman",serif;font-size:30px;line-height:1;
  letter-spacing:-.01em;font-weight:600;}
.cd-word em{font-style:italic;color:var(--signal);}
.cd-sub{font-size:12.5px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:6px;}
.cd-stamp{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);
  border:1px solid var(--line);border-radius:2px;padding:5px 9px;background:var(--paper);}
.cd-acct{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--muted);}
.cd-acct img{width:26px;height:26px;border-radius:50%;}
.cd-acct .em{color:var(--ink);font-weight:600;}
.cd-acct button{background:none;border:none;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-size:12.5px;}
.cd-acct button:hover{color:var(--ink);}

.cd-drop{margin-top:26px;border:1.5px dashed #b9bbbd;border-radius:6px;background:var(--paper);
  padding:46px 24px;text-align:center;cursor:pointer;transition:.15s;}
.cd-drop:hover,.cd-drop.over{border-color:var(--signal);background:#fffdf7;}
.cd-drop h3{font-size:17px;margin:14px 0 4px;font-weight:600;}
.cd-drop p{font-size:13px;color:var(--muted);margin:0;}
.cd-circle{width:46px;height:46px;border-radius:50%;background:var(--ink);color:#fff;
  display:inline-flex;align-items:center;justify-content:center;}

.cd-picker{margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.cd-card{border:1px solid var(--line);border-radius:8px;background:var(--paper);padding:28px 22px;
  text-align:center;cursor:pointer;transition:.15s;}
.cd-card:hover{border-color:var(--signal);background:#fffdf7;}
.cd-card h3{margin:14px 0 5px;font-size:16px;font-weight:600;}
.cd-card p{margin:0;font-size:12.5px;color:var(--muted);line-height:1.5;}
@media(max-width:640px){.cd-picker{grid-template-columns:1fr;}}

.cd-login{max-width:430px;margin:13vh auto 0;text-align:center;}
.cd-login .cd-word{font-size:34px;}
.cd-login p{color:var(--muted);font-size:13.5px;margin:12px 0 22px;line-height:1.55;}
.cd-gbtn{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:600;padding:11px 20px;
  border-radius:6px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer;text-decoration:none;}
.cd-gbtn:hover{background:var(--ink2);}

.cd-bar{margin-top:22px;background:var(--paper);border:1px solid var(--line);border-radius:6px;
  padding:14px 16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;}
.cd-map{display:flex;gap:14px;flex-wrap:wrap;flex:1;min-width:240px;}
.cd-field{display:flex;flex-direction:column;gap:3px;}
.cd-field label{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);}
.cd-field select,.cd-field input{font-size:13px;padding:6px 8px;border:1px solid var(--line);border-radius:4px;
  background:#fff;color:var(--ink);}
.cd-field select{min-width:128px;}
.cd-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.cd-syncbar{display:flex;align-items:center;gap:10px;flex:1;min-width:200px;font-size:12.5px;color:var(--muted);}
.cd-syncbar b{color:var(--ink);font-weight:600;}
.spin{animation:spin 1s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}

.cd-btn{font-size:13px;font-weight:600;padding:9px 16px;border-radius:5px;border:1px solid var(--ink);
  background:var(--ink);color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:.12s;}
.cd-btn:hover{background:var(--ink2);}
.cd-btn:disabled{opacity:.4;cursor:not-allowed;}
.cd-btn.alt{background:var(--paper);color:var(--ink);}
.cd-btn.alt:hover{background:#fff;}
.cd-btn.warn{background:var(--signal);border-color:var(--signal);}
.cd-btn.warn:hover{filter:brightness(.95);}
.cd-btn.danger{background:#fff;color:var(--bad);border-color:#e3c4bc;}
.cd-btn.danger:hover{background:#fbf0ed;}
.cd-btn.go{background:#1a6b3a;border-color:#1a6b3a;}
.cd-btn.go:hover{background:#155e32;}
.cd-iconbtn{padding:9px 11px;}

.cd-prog{font-size:12px;color:var(--muted);min-width:140px;}
.cd-progbar{height:4px;background:var(--line);border-radius:2px;overflow:hidden;margin-top:5px;}
.cd-progfill{height:100%;background:var(--signal);transition:width .3s;}

.cd-engine{margin-top:10px;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:16px 18px;}
.cd-engine h4{margin:0 0 10px;font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:8px;}
.cd-kv{display:flex;flex-wrap:wrap;gap:24px;font-size:13px;}
.cd-kv div span{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
.cd-kv div b{font-weight:600;}
.cd-engine p{margin:12px 0 0;font-size:12px;color:var(--muted);line-height:1.55;}
.cd-engine code{background:#eee;border-radius:3px;padding:1px 5px;font-size:11.5px;}
.cd-warnpill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;
  letter-spacing:.05em;color:#7a560f;background:var(--signal-soft);border-radius:3px;padding:4px 8px;}

.cd-table{margin-top:18px;background:var(--paper);border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.cd-trow{display:grid;grid-template-columns:36px 34px 44px 1.4fr 1.5fr 1.05fr 100px;gap:0;
  align-items:center;border-bottom:1px solid var(--line);}
.cd-trow.h{background:var(--ink);color:#fff;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;}
.cd-trow.h>div{padding:11px 12px;}
.cd-trow.body{cursor:pointer;transition:background .1s;}
.cd-trow.body:hover{background:#fff;}
.cd-trow.rej{opacity:.6;}
.cd-trow>div{padding:12px;min-width:0;}
.cd-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-namesub{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-cell{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-cell.empty{color:#b6b8ba;}
.cd-edited{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--signal);margin-left:6px;vertical-align:middle;}

.cd-av{width:34px;height:34px;border-radius:50%;background:var(--ink);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;overflow:hidden;}
.cd-av img{width:100%;height:100%;object-fit:cover;}

.cd-chip{font-size:10px;font-weight:700;letter-spacing:.08em;padding:4px 7px;border-radius:3px;
  display:inline-block;text-align:center;white-space:nowrap;}
.cd-chip.match{background:var(--signal-soft);color:#7a560f;}
.cd-chip.partial{background:#e7e3d7;color:#6a6347;}
.cd-chip.none{background:#e6e7e9;color:var(--muted);}
.cd-chip.pend{background:var(--ink);color:#fff;animation:pulse 1.1s infinite;}
.cd-chip.err{background:#f1dcd6;color:var(--bad);}
.cd-chip.rej{background:#ececec;color:#9a9a9a;}
@keyframes pulse{50%{opacity:.55;}}

.cd-detail{grid-column:1/-1;background:#fff;border-top:1px solid var(--line);padding:18px 20px 20px;}
.cd-detgrid{display:grid;grid-template-columns:120px 1fr;gap:20px;}
.cd-bigav{width:120px;height:120px;border-radius:6px;background:var(--ink);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:600;overflow:hidden;border:1px solid var(--line);}
.cd-bigav img{width:100%;height:100%;object-fit:cover;}
.cd-av.logo,.cd-bigav.logo{background:#fff;border:1px solid var(--line);}
.cd-av.logo img,.cd-bigav.logo img{object-fit:contain;padding:3px;}
.cd-detrow{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;margin-bottom:9px;color:var(--ink2);}
.cd-detrow svg{margin-top:2px;flex-shrink:0;color:var(--muted);}
.cd-detrow a{color:var(--signal);text-decoration:none;}
.cd-detrow a:hover{text-decoration:underline;}
.cd-logo{width:18px;height:18px;border-radius:3px;object-fit:contain;background:#fff;}
.cd-sum{font-size:13px;line-height:1.55;color:var(--ink2);margin:6px 0 14px;}
.cd-banner{font-size:12.5px;background:#f3f3f1;border:1px solid var(--line);border-radius:5px;
  padding:9px 12px;color:var(--muted);margin-bottom:12px;display:flex;gap:8px;align-items:center;}
.cd-verify{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
.cd-vlink{font-size:11.5px;font-weight:600;padding:6px 10px;border:1px solid var(--line);border-radius:4px;
  color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:var(--paper);}
.cd-vlink:hover{background:#fff;border-color:var(--signal);}
.cd-srclabel{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
  margin:16px 0 8px;display:flex;align-items:center;gap:7px;}
.cd-editgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;}
.cd-editgrid .cd-field.full{grid-column:1/-1;}
.cd-editgrid input,.cd-editgrid textarea{width:100%;box-sizing:border-box;font-size:13px;padding:7px 9px;
  border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);font-family:inherit;}
.cd-editgrid textarea{resize:vertical;min-height:46px;}
.cd-detactions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;}

.cd-note{margin-top:24px;border:1px solid var(--line);border-radius:6px;background:var(--paper);overflow:hidden;}
.cd-notehead{display:flex;align-items:center;gap:9px;padding:12px 16px;cursor:pointer;font-size:13px;font-weight:600;}
.cd-notebody{padding:0 16px 16px 41px;font-size:12.8px;line-height:1.6;color:var(--muted);}
.cd-notebody b{color:var(--ink2);font-weight:600;}
.cd-notebody code{background:#eee;border-radius:3px;padding:1px 5px;font-size:11.5px;}

.cd-controls{margin-top:12px;display:flex;align-items:center;gap:12px 18px;flex-wrap:wrap;justify-content:space-between;}
.cd-pills{display:flex;gap:6px;flex-wrap:wrap;}
.cd-pill{font-size:12px;padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--paper);
  cursor:pointer;color:var(--muted);display:inline-flex;gap:6px;align-items:center;transition:.12s;}
.cd-pill:hover{background:#fff;}
.cd-pill.active{background:var(--ink);color:#fff;border-color:var(--ink);}
.cd-pill b{font-weight:700;}
.cd-pill.dim{opacity:.45;}
.cd-selinfo{font-size:12.5px;color:var(--muted);display:flex;gap:12px;align-items:center;}
.cd-link{color:var(--signal);cursor:pointer;font-weight:600;}
.cd-ck{width:15px;height:15px;cursor:pointer;accent-color:var(--ink);vertical-align:middle;}
.cd-empty{padding:40px;text-align:center;color:var(--muted);font-size:13px;grid-column:1/-1;}

.cd-toggle{display:flex;align-items:center;gap:12px;margin-top:14px;font-size:13px;color:var(--ink2);}
.cd-toggle .sub{display:block;font-size:11.5px;color:var(--muted);margin-top:2px;}
.cd-switch{position:relative;width:38px;height:22px;flex:0 0 auto;}
.cd-switch input{opacity:0;width:0;height:0;}
.cd-slider{position:absolute;inset:0;background:#cfcfca;border-radius:999px;transition:.15s;cursor:pointer;}
.cd-slider:before{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s;}
.cd-switch input:checked + .cd-slider{background:var(--signal);}
.cd-switch input:checked + .cd-slider:before{transform:translateX(16px);}
`;

/* --------------------------- helpers --------------------------- */
const findCol = (hs, res) => hs.find((h) => res.some((r) => r.test(h))) || "";

function detectColumns(headers) {
  return {
    name: findCol(headers, [/^full ?name$/i, /^name$/i, /contact ?name/i]),
    first: findCol(headers, [/first ?name/i, /^first$/i, /given/i]),
    last: findCol(headers, [/last ?name/i, /^last$/i, /surname/i, /family/i]),
    email: findCol(headers, [/e-?mail/i]),
    company: findCol(headers, [/company/i, /organi[sz]ation/i, /employer/i, /^org$/i]),
  };
}
const GOOGLE_MAP = { name: "name", email: "email", company: "company" };

const getName = (row, m) => {
  if (m.name && row[m.name]) return String(row[m.name]).trim();
  return [m.first && row[m.first], m.last && row[m.last]].filter(Boolean).join(" ").trim();
};

const initials = (s) =>
  (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

const EDIT_FIELDS = [
  ["name", "Full name"], ["jobTitle", "Job title"], ["company", "Company"], ["location", "Location"],
  ["linkedinUrl", "LinkedIn URL"], ["website", "Website"], ["photo", "Photo URL"],
];

const hasEdits = (e) => e.edits && Object.values(e.edits).some((v) => v && String(v).trim());

/* effective value = manual edit wins; reject discards machine data; else use AI/derived */
function effective(e) {
  const data = e.data || {}, ed = e.edits || {}, rej = e.rejected;
  const pick = (k) => (ed[k] != null && String(ed[k]).trim() !== "") ? ed[k] : (rej ? "" : (data[k] || ""));
  return {
    jobTitle: pick("jobTitle"), company: pick("company"), location: pick("location"),
    linkedinUrl: pick("linkedinUrl"), website: pick("website"), summary: pick("summary"),
    photo: pick("photo"),
    logo: rej ? "" : (data.logo || ""),
    links: rej ? [] : (Array.isArray(data.links) ? data.links : []),
  };
}

function chipFor(e) {
  if (e.status === "loading") return ["pend", "WORKING"];
  if (e.status === "error") return ["err", "ERROR"];
  if (e.rejected) return ["rej", "REJECTED"];
  if (e.status !== "done" && !hasEdits(e)) return ["none", "—"];
  const f = effective(e);
  if (f.jobTitle || f.location) return ["match", "ENRICHED"];
  if (f.company || f.photo || f.website) return ["partial", "DERIVED"];
  return ["none", "MINIMAL"];
}

/* tier of a row: enriched | derived | minimal | idle | loading | error | rejected */
function tierOf(e) {
  if (e.rejected) return "rejected";
  if (e.status !== "done") return e.status;
  const f = effective(e);
  if (f.jobTitle || f.location) return "enriched";
  if (f.company || f.photo || f.website) return "derived";
  return "minimal";
}
const isWeak = (e) => tierOf(e) === "derived" || tierOf(e) === "minimal";

const FILTERS = [
  ["all", "All"], ["enriched", "Enriched"], ["derived", "Derived"],
  ["minimal", "Minimal"], ["pending", "Not enriched"], ["rejected", "Rejected"],
];
function inFilter(e, f) {
  if (f === "all") return true;
  const t = tierOf(e);
  if (f === "pending") return t === "idle" || t === "loading" || t === "error";
  return t === f;
}

function effectiveName(row, map, e) {
  const ed = e.edits || {};
  if (ed.name && String(ed.name).trim()) return String(ed.name).trim();
  const orig = getName(row, map);
  if (e.rejected) return orig;
  const dn = e.data && e.data.name;
  return (dn && String(dn).trim()) ? String(dn).trim() : orig;
}

// contact can be pushed to Google if it has any effective data and isn't rejected
function pushable(r) {
  if (r._e.rejected) return false;
  const f = effective(r._e);
  return !!(f.jobTitle || f.company || f.location || f.linkedinUrl || f.website || f.summary || (r._e.edits && r._e.edits.name));
}

// merge an enrich result into the previous _e, preserving edits + an existing (e.g. Google) photo
function mergeApplied(prevE, result) {
  const data = result.data || {};
  const prevPhoto = prevE && prevE.data && prevE.data.photo;
  const mergedData = (!data.photo && prevPhoto) ? { ...data, photo: prevPhoto } : data;
  return { ...result, data: mergedData, edits: (prevE && prevE.edits) || {}, rejected: false };
}

/* recognized Google Contacts CSV columns — passed through untouched on CSV export */
const GCOL = /^(Name|Given Name|Additional Name|Family Name|Yomi Name|Name Prefix|Name Suffix|Initials|Nickname|Short Name|Maiden Name|First Name|Middle Name|Last Name|Phonetic First Name|Phonetic Middle Name|Phonetic Last Name|File As|Birthday|Gender|Location|Occupation|Notes|Photo|Group Membership|Labels|Organization.*|E-?mail \d+.*|Phone \d+.*|Address \d+.*|Website \d+.*|IM \d+.*|Relation \d+.*|Event \d+.*|Custom Field \d+.*)$/i;

const GOOGLE_FIELDS = [
  "First Name", "Middle Name", "Last Name", "Organization Name", "Organization Title",
  "E-mail 1 - Label", "E-mail 1 - Value", "Phone 1 - Label", "Phone 1 - Value",
  "Website 1 - Label", "Website 1 - Value", "Website 2 - Label", "Website 2 - Value",
  "Photo", "Notes", "Labels",
];

/* ============================= app ============================= */
export default function App() {
  const [me, setMe] = useState(null);           // null=loading, {...}
  const [source, setSource] = useState(null);   // null | 'csv' | 'google'
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0 });
  const [open, setOpen] = useState(null);
  const [showNote, setShowNote] = useState(false);
  const [showEngine, setShowEngine] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [fileName, setFileName] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [requireSearch, setRequireSearch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  const [msg, setMsg] = useState("");
  const stopRef = useRef(false);
  const fileRef = useRef(null);
  const selAllRef = useRef(null);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => setMe({ googleEnabled: false, local: true }));
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ configured: false }));
  }, []);

  const enrichedCount = useMemo(() => rows.filter((r) => r._e && r._e.status === "done").length, [rows]);
  const weakRows = useMemo(() => rows.filter((r) => isWeak(r._e)), [rows]);
  const counts = useMemo(() => {
    const c = { all: rows.length, enriched: 0, derived: 0, minimal: 0, pending: 0, rejected: 0 };
    rows.forEach((r) => {
      const t = tierOf(r._e);
      if (t === "enriched") c.enriched++;
      else if (t === "derived") c.derived++;
      else if (t === "minimal") c.minimal++;
      else if (t === "rejected") c.rejected++;
      else c.pending++;
    });
    return c;
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter((r) => inFilter(r._e, filter)), [rows, filter]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.__id));
  useEffect(() => {
    if (selAllRef.current) selAllRef.current.indeterminate = selected.size > 0 && !allFilteredSelected;
  }, [selected, allFilteredSelected]);

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allFilteredSelected) filteredRows.forEach((r) => n.delete(r.__id));
    else filteredRows.forEach((r) => n.add(r.__id));
    return n;
  });

  /* --------- persistence (Google mode only) --------- */
  const persistEnrichment = useCallback((row, e) => {
    if (source !== "google" || !row.resourceName) return;
    fetch("/api/contacts", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceName: row.resourceName, enrichment: e }),
    }).catch(() => {});
  }, [source]);

  /* --------- sources --------- */
  const toRows = (contacts) => contacts.map((c, i) => ({
    __id: i, resourceName: c.resourceName, etag: c.etag,
    name: c.name || "", email: c.email || "", company: c.company || "", title: c.title || "",
    _e: c.enrichment || {
      status: "idle", edits: {}, rejected: false,
      data: { photo: c.photo || null, company: c.company || null },
    },
  }));

  const syncGoogle = useCallback(async () => {
    setSyncing(true); setMsg("Pulling contacts from Google…");
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "sync failed");
      setRows(toRows(d.contacts)); setSyncedAt(d.syncedAt);
      setMsg(`Pulled ${d.pulled} contacts from Google.`);
    } catch (e) { setMsg("Sync failed: " + String(e.message || e)); }
    setSyncing(false); setSelected(new Set()); setFilter("all"); setOpen(null);
  }, []);

  const openGoogle = useCallback(async () => {
    setSource("google"); setFileName("google-contacts"); setMap(GOOGLE_MAP); setHeaders([]);
    try {
      const r = await fetch("/api/contacts");
      const d = await r.json();
      if (r.ok && d.contacts && d.contacts.length) { setRows(toRows(d.contacts)); setSyncedAt(d.syncedAt); }
      else await syncGoogle();
    } catch { await syncGoogle(); }
  }, [syncGoogle]);

  const pushGoogle = useCallback(async () => {
    const scope = selected.size ? rows.filter((r) => selected.has(r.__id)) : rows.filter(pushable);
    if (!scope.length) { setMsg("Nothing to push — enrich or select some contacts first."); return; }
    setPushing(true); setMsg(`Pushing ${scope.length} contact(s) to Google…`);
    try {
      const r = await fetch("/api/push", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceNames: scope.map((x) => x.resourceName) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "push failed");
      setMsg(`Pushed ${d.pushed} · skipped ${d.skipped} · failed ${d.failed}.`);
    } catch (e) { setMsg("Push failed: " + String(e.message || e)); }
    setPushing(false);
  }, [rows, selected]);

  const logout = async () => { await fetch("/auth/logout", { method: "POST" }).catch(() => {}); location.reload(); };

  /* --------- CSV --------- */
  const handleFile = useCallback((file) => {
    if (!file) return;
    setSource("csv"); setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setMap(detectColumns(hs));
        setRows(res.data.map((r, i) => ({ ...r, __id: i, _e: { status: "idle", edits: {}, rejected: false } })));
        setOpen(null); setProg({ done: 0, total: 0 }); setSelected(new Set()); setFilter("all");
      },
    });
  }, []);

  /* --------- enrichment --------- */
  const enrichOne = useCallback(async (row, deep = false) => {
    const { __id, _e, resourceName, etag, ...extra } = row;
    const body = {
      name: getName(row, map), email: row[map.email] || "", company: row[map.company] || "",
      deep, extra, requireSearch,
    };
    try {
      const res = await fetch("/api/enrich", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d = await res.json();
      return { status: "done", data: d, aiError: d.aiError };
    } catch (e) {
      return { status: "error", error: String(e.message || e), data: {} };
    }
  }, [map, requireSearch]);

  const setStatus = (id, status) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, status } } : r)));
  const applyResult = (id, result) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: mergeApplied(r._e, result) } : r)));
  const commitEdits = (id, edits) => {
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, edits } } : r)));
    const row = rowsRef.current.find((r) => r.__id === id);
    if (row) persistEnrichment(row, { ...row._e, edits });
  };
  const setRejected = (id, rejected) => {
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, rejected } } : r)));
    const row = rowsRef.current.find((r) => r.__id === id);
    if (row) persistEnrichment(row, { ...row._e, rejected });
  };

  const processTargets = useCallback(async (targets, deep) => {
    if (!targets.length) return;
    stopRef.current = false; setRunning(true); setProg({ done: 0, total: targets.length });
    let done = 0;
    const it = targets[Symbol.iterator]();
    const worker = async () => {
      for (const row of it) {
        if (stopRef.current) return;
        setStatus(row.__id, "loading");
        const result = await enrichOne(row, deep);
        applyResult(row.__id, result);
        persistEnrichment(row, mergeApplied(row._e, result));
        done += 1; setProg({ done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, targets.length) }, worker));
    setRunning(false);
  }, [enrichOne, persistEnrichment]);

  const runAll = useCallback(
    () => processTargets(rows.filter((r) => r._e.status !== "done" && !r._e.rejected), false),
    [processTargets, rows]);
  const runWeakDeep = useCallback(
    () => processTargets(rows.filter((r) => isWeak(r._e)), true),
    [processTargets, rows]);
  const runRow = useCallback(async (row) => {
    setStatus(row.__id, "loading");
    const result = await enrichOne(row, false);
    applyResult(row.__id, result);
    persistEnrichment(row, mergeApplied(row._e, result));
  }, [enrichOne, persistEnrichment]);
  const deepRow = useCallback(async (row) => {
    setStatus(row.__id, "loading");
    const result = await enrichOne(row, true);
    applyResult(row.__id, result);
    persistEnrichment(row, mergeApplied(row._e, result));
  }, [enrichOne, persistEnrichment]);

  /* --------- CSV exports --------- */
  const download = (csv, suffix) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName.replace(/\.csv$/i, "") || "contacts") + suffix;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportGoogle = useCallback(() => {
    const scope = selected.size ? rows.filter((r) => selected.has(r.__id)) : rows;
    const preserved = headers.filter((h) => GCOL.test(h));
    const data = scope.map((r) => {
      const eff = effective(r._e);
      const o = {};
      preserved.forEach((h) => (o[h] = r[h] ?? ""));
      const nm = effectiveName(r, map, r._e);
      const origNm = getName(r, map);
      const hasFirst = (o["First Name"] || "").trim() || (o["Given Name"] || "").trim();
      if (nm && (nm !== origNm || !hasFirst)) {
        const p = nm.split(/\s+/);
        o["First Name"] = p[0] || ""; o["Last Name"] = p.slice(1).join(" ") || "";
      }
      const email = r[map.email] || "";
      if (email && !(o["E-mail 1 - Value"] || "").trim()) {
        o["E-mail 1 - Value"] = email;
        if (!o["E-mail 1 - Label"]) o["E-mail 1 - Label"] = "Work";
      }
      if (eff.company) o["Organization Name"] = eff.company;
      if (eff.jobTitle) o["Organization Title"] = eff.jobTitle;
      if (eff.linkedinUrl) { o["Website 1 - Label"] = "LinkedIn"; o["Website 1 - Value"] = eff.linkedinUrl; }
      if (eff.website) { o["Website 2 - Label"] = "Company"; o["Website 2 - Value"] = eff.website; }
      const noteBits = [];
      if (eff.location) noteBits.push("Location: " + eff.location);
      if (eff.summary) noteBits.push(eff.summary);
      if (noteBits.length) {
        const existing = (o["Notes"] || "").trim();
        o["Notes"] = (existing ? existing + "\n" : "") + noteBits.join("\n");
      }
      if (eff.photo) o["Photo"] = eff.photo;
      if (!r._e.rejected && (eff.company || eff.jobTitle || eff.location)) {
        const ex = (o["Labels"] || o["Group Membership"] || "").trim();
        o["Labels"] = ex ? ex + " ::: Enriched" : "Enriched";
      }
      return o;
    });
    const inFields = new Set(GOOGLE_FIELDS);
    const extra = preserved.filter((h) => !inFields.has(h));
    download(Papa.unparse({ fields: [...GOOGLE_FIELDS, ...extra], data }), "-google.csv");
  }, [rows, headers, map, fileName, selected]);

  const exportFull = useCallback(() => {
    const scope = selected.size ? rows.filter((r) => selected.has(r.__id)) : rows;
    const data = scope.map((r) => {
      const eff = effective(r._e);
      const base = {};
      headers.forEach((h) => (base[h] = r[h]));
      return {
        ...base,
        "Enriched Name": effectiveName(r, map, r._e) || "",
        "Enriched Title": eff.jobTitle || "",
        "Enriched Company": eff.company || "",
        "Location": eff.location || "",
        "LinkedIn": eff.linkedinUrl || "",
        "Website": eff.website || "",
        "Profile Summary": eff.summary || "",
        "Photo URL": eff.photo || "",
        "Enrichment": r._e.rejected ? "rejected" : (r._e.data?.source || (r._e.status === "done" ? "derived" : "")),
      };
    });
    download(Papa.unparse(data), "-enriched.csv");
  }, [rows, headers, map, fileName, selected]);

  const reset = () => {
    setRows([]); setHeaders([]); setMap({}); setFileName(""); setOpen(null);
    setSelected(new Set()); setFilter("all"); setSource(null); setMsg(""); setSyncedAt(null);
  };

  const notConfigured = cfg && !cfg.configured;
  const isGoogle = source === "google";

  /* ----------------------------- gates ----------------------------- */
  if (me === null) {
    return <div className="cd-root"><style>{STYLE}</style><div className="cd-wrap" style={{ textAlign: "center", marginTop: "16vh", color: "var(--muted)" }}>Loading…</div></div>;
  }
  if (me.needsLogin) {
    return (
      <div className="cd-root">
        <style>{STYLE}</style>
        <div className="cd-login">
          <div className="cd-word">AI<em>Contacts</em></div>
          <p>Sign in with Google to enrich and sync your contacts. Your workspace is private to your account.</p>
          <a className="cd-gbtn" href="/auth/google"><LogIn size={16} /> Sign in with Google</a>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-root">
      <style>{STYLE}</style>
      <div className="cd-wrap">
        <header className="cd-head">
          <div>
            <div className="cd-word">AI<em>Contacts</em></div>
            <div className="cd-sub">Enrich via your own AI · correct · sync with Google Contacts</div>
          </div>
          {me.email ? (
            <div className="cd-acct">
              {me.picture && <img src={me.picture} alt="" referrerPolicy="no-referrer" />}
              <span className="em">{me.email}</span>
              <button onClick={logout}><LogOut size={14} /> Sign out</button>
            </div>
          ) : (
            <div className="cd-stamp cd-mono">{rows.length ? `${enrichedCount} / ${rows.length} filed` : "local mode"}</div>
          )}
        </header>

        {rows.length === 0 ? (
          isGoogle ? (
            <div className="cd-drop" style={{ cursor: "default" }}>
              <div className="cd-circle"><Cloud size={20} /></div>
              <h3>No contacts cached yet</h3>
              <p style={{ marginBottom: 16 }}>{msg || "Pull your contacts from Google to begin."}</p>
              <button className="cd-btn go" onClick={syncGoogle} disabled={syncing}>
                <RefreshCw size={15} className={syncing ? "spin" : ""} /> {syncing ? "Syncing…" : "Sync from Google"}
              </button>
              <div style={{ marginTop: 14 }}><span className="cd-link" onClick={reset}>← back</span></div>
            </div>
          ) : (source === "csv" || !me.googleEnabled) ? (
            <div
              className={"cd-drop" + (over ? " over" : "")}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <div className="cd-circle"><Upload size={20} /></div>
              <h3>Drop a contacts CSV, or click to choose</h3>
              <p>Needs a name column. An email column unlocks company, logo, website, and photo.</p>
              {me.googleEnabled && <div style={{ marginTop: 14 }}><span className="cd-link" onClick={reset}>← back</span></div>}
              <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="cd-picker">
              <div className="cd-card" onClick={openGoogle}>
                <div className="cd-circle" style={{ margin: "0 auto" }}><Cloud size={20} /></div>
                <h3>Google Contacts</h3>
                <p>Pull your contacts straight from Google, enrich them, and sync changes back.</p>
              </div>
              <div className="cd-card" onClick={() => setSource("csv")}>
                <div className="cd-circle" style={{ margin: "0 auto" }}><UploadCloud size={20} /></div>
                <h3>Upload a CSV</h3>
                <p>Import a contacts export, enrich it, and download an enriched or Google-ready CSV.</p>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="cd-bar">
              {isGoogle ? (
                <div className="cd-syncbar">
                  <Cloud size={16} /> <b>Google Contacts</b> · {rows.length}
                  {syncedAt ? <span>· synced {new Date(syncedAt).toLocaleString()}</span> : null}
                  {msg ? <span style={{ color: "var(--ink2)" }}>· {msg}</span> : null}
                </div>
              ) : (
                <div className="cd-map">
                  {[["name", "Name"], ["email", "Email"], ["company", "Company"]].map(([k, lbl]) => (
                    <div className="cd-field" key={k}>
                      <label>{lbl} column</label>
                      <select value={map[k] || ""} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                        <option value="">—</option>
                        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="cd-actions">
                <button className="cd-btn alt cd-iconbtn" onClick={() => setShowEngine(!showEngine)} title="Enrichment engine">
                  <Settings size={15} />
                </button>
                {running ? (
                  <button className="cd-btn warn" onClick={() => (stopRef.current = true)}>
                    <StopCircle size={15} /> Stop
                  </button>
                ) : (
                  <button className="cd-btn" onClick={runAll}><Search size={15} /> Enrich all</button>
                )}
                <button className="cd-btn alt" onClick={runWeakDeep} disabled={running || !weakRows.length}
                  title="Re-run a deeper, multi-angle search on contacts that came back minimal or derived">
                  <Radar size={15} /> Deep re-check{weakRows.length ? ` (${weakRows.length})` : ""}
                </button>
                {isGoogle ? (
                  <>
                    <button className="cd-btn go" onClick={pushGoogle} disabled={pushing || running}
                      title="Write enriched fields back to Google Contacts">
                      <CloudUpload size={15} className={pushing ? "spin" : ""} /> Push to Google{selected.size ? ` (${selected.size})` : ""}
                    </button>
                    <button className="cd-btn alt cd-iconbtn" onClick={syncGoogle} disabled={syncing || running} title="Re-pull from Google">
                      <RefreshCw size={15} className={syncing ? "spin" : ""} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="cd-btn alt" onClick={exportGoogle} disabled={!rows.length} title="CSV ready for Google Contacts import">
                      <Download size={15} /> Google CSV{selected.size ? ` (${selected.size})` : ""}
                    </button>
                    <button className="cd-btn alt" onClick={exportFull} disabled={!rows.length} title="Original columns plus enrichment columns">
                      <Download size={15} /> Full CSV{selected.size ? ` (${selected.size})` : ""}
                    </button>
                  </>
                )}
                <button className="cd-btn alt cd-iconbtn" onClick={reset} title={isGoogle ? "Switch source" : "Load a different file"}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {isGoogle && (
              <div className="cd-bar" style={{ marginTop: 10, paddingTop: 10, paddingBottom: 10 }}>
                <div className="cd-selinfo"><Info size={14} /> Google export also available:</div>
                <div className="cd-actions">
                  <button className="cd-btn alt" onClick={exportGoogle}><Download size={15} /> Google CSV{selected.size ? ` (${selected.size})` : ""}</button>
                  <button className="cd-btn alt" onClick={exportFull}><Download size={15} /> Full CSV{selected.size ? ` (${selected.size})` : ""}</button>
                </div>
              </div>
            )}

            {showEngine && (
              <div className="cd-engine">
                <h4><Cpu size={15} /> Enrichment engine</h4>
                <div className="cd-kv">
                  <div><span>Provider</span><b>{cfg?.provider || "—"}</b></div>
                  <div><span>Model</span><b>{cfg?.model || "—"}</b></div>
                  <div><span>Deep model</span><b>{cfg?.deepModel || cfg?.model || "—"}</b></div>
                  <div><span>Web search</span><b>{cfg?.webSearch ? "on" : "off"}</b></div>
                  <div><span>Status</span><b style={{ color: cfg?.configured ? "var(--good)" : "var(--bad)" }}>
                    {cfg?.configured ? "connected" : "not configured"}</b></div>
                </div>
                {notConfigured && (
                  <p>
                    <span className="cd-warnpill"><AlertTriangle size={12} /> email-derived data only</span><br /><br />
                    No AI provider is set, so you’ll get company, website, logo, and photo from each email — but not job
                    titles or locations. Set <code>AI_PROVIDER</code> and <code>AI_API_KEY</code> in <code>.env</code>, then restart.
                  </p>
                )}
                {cfg?.configured && (
                  <p>Job titles, locations, and profiles come from <b>{cfg.provider}</b> using your own key, which stays on the server.</p>
                )}
                <label className="cd-toggle">
                  <span className="cd-switch">
                    <input type="checkbox" checked={requireSearch} onChange={(e) => setRequireSearch(e.target.checked)} />
                    <span className="cd-slider" />
                  </span>
                  <span>
                    Require search — no email-derived data
                    <span className="sub">When on, company/website/logo/photo are only kept if a live search finds them (needs a provider).</span>
                  </span>
                </label>
              </div>
            )}

            <div className="cd-controls">
              <div className="cd-pills">
                {FILTERS.map(([key, label]) => {
                  const n = counts[key] ?? 0;
                  return (
                    <button key={key}
                      className={"cd-pill" + (filter === key ? " active" : "") + (key !== "all" && n === 0 ? " dim" : "")}
                      onClick={() => setFilter(key)}>
                      {label} <b>{n}</b>
                    </button>
                  );
                })}
              </div>
              <div className="cd-selinfo">
                {selected.size > 0 ? (
                  <>
                    <span>{selected.size} selected</span>
                    <span className="cd-link" onClick={() => setSelected(new Set())}>Clear</span>
                  </>
                ) : (
                  <span>{isGoogle ? "Tick rows to push only those; none ticked pushes all enriched." : "Tick rows to export only those; none ticked exports all."}</span>
                )}
              </div>
            </div>

            {running && (
              <div className="cd-bar" style={{ marginTop: 10 }}>
                <div className="cd-prog cd-mono" style={{ flex: 1 }}>
                  Filing {prog.done} of {prog.total}…
                  <div className="cd-progbar">
                    <div className="cd-progfill" style={{ width: `${(prog.done / Math.max(prog.total, 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            <div className="cd-table">
              <div className="cd-trow h">
                <div><input ref={selAllRef} className="cd-ck" type="checkbox" checked={allFilteredSelected} onChange={toggleAll} title="Select all in view" /></div>
                <div></div><div></div><div>Contact</div><div>Role / Employer</div><div>Location</div><div>Result</div>
              </div>
              {filteredRows.length === 0 && (
                <div className="cd-trow"><div className="cd-empty">No contacts in this view.</div></div>
              )}
              {filteredRows.map((r) => {
                const nm = effectiveName(r, map, r._e);
                const f = effective(r._e);
                const isOpen = open === r.__id;
                const [chipCls, chipTxt] = chipFor(r._e);
                return (
                  <React.Fragment key={r.__id}>
                    <div className={"cd-trow body" + (r._e.rejected ? " rej" : "")} onClick={() => setOpen(isOpen ? null : r.__id)}>
                      <div onClick={(ev) => ev.stopPropagation()}>
                        <input className="cd-ck" type="checkbox" checked={selected.has(r.__id)} onChange={() => toggleSel(r.__id)} />
                      </div>
                      <div>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                      <div><Avatar photo={f.photo} logo={f.logo} name={nm} small /></div>
                      <div>
                        <div className="cd-name">
                          {nm || <span style={{ color: "#b6b8ba" }}>unnamed</span>}
                          {hasEdits(r._e) && <span className="cd-edited" title="Has your edits" />}
                        </div>
                        <div className="cd-namesub cd-mono">{r[map.email] || ""}</div>
                      </div>
                      <div>
                        {f.jobTitle || f.company
                          ? <div className="cd-cell">{[f.jobTitle, f.company].filter(Boolean).join(" · ")}</div>
                          : <div className="cd-cell empty">{r[map.company] || "—"}</div>}
                      </div>
                      <div className="cd-cell">{f.location || <span className="empty">—</span>}</div>
                      <div><span className={"cd-chip " + chipCls}>{chipTxt}</span></div>
                    </div>
                    {isOpen && (
                      <Detail row={r} nm={nm} onCommit={commitEdits}
                        onReject={(id) => setRejected(id, true)}
                        onRestore={(id) => setRejected(id, false)}
                        onRetrace={runRow} onDeep={deepRow} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        <div className="cd-note">
          <div className="cd-notehead" onClick={() => setShowNote(!showNote)}>
            <Info size={16} /> How it works
            {showNote ? <ChevronDown size={15} style={{ marginLeft: "auto" }} /> : <ChevronRight size={15} style={{ marginLeft: "auto" }} />}
          </div>
          {showNote && (
            <div className="cd-notebody">
              <b>Sources.</b> Pull contacts from <b>Google</b> (your workspace is saved per account, so enrichment persists
              between visits) or upload a <b>CSV</b>. Either way, enrichment is the same.<br /><br />
              <b>Enrich.</b> Each contact gets email-derived data (company, website, logo, photo), then — if an AI provider is
              configured — a web-grounded job title, location, profile, and corrected name merged on top. <b>Deep re-check</b>
              re-runs the MINIMAL/DERIVED ones with a more thorough search.<br /><br />
              <b>Correct or reject.</b> Open a contact to type your own values (these always win) or reject the machine’s data.<br /><br />
              <b>Sync back (Google).</b> <b>Push to Google</b> writes enriched fields back to Google Contacts — the ticked
              rows, or all enriched rows if none are ticked. It merges onto each contact (adding org/title, URLs, and a notes
              line) using a fresh copy, so existing phones and addresses are preserved. Rejected contacts are never written.
              Photos are read-only. You can also still export a Google-ready or full CSV.<br /><br />
              <b>Verify.</b> AI results can be wrong or stale — the per-contact LinkedIn/Google links are there to confirm.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------- contact detail panel ----------------------- */
function Detail({ row, nm, onCommit, onReject, onRestore, onRetrace, onDeep }) {
  const e = row._e;
  const f = effective(e);
  const [form, setForm] = useState(e.edits || {});
  useEffect(() => { setForm(e.edits || {}); }, [e.edits, e.status]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const commit = () => onCommit(row.__id, form);
  const placeholderFor = (k) => (e.rejected ? "" : (e.data?.[k] || ""));

  return (
    <div className="cd-detail">
      <div className="cd-detgrid">
        <div><Avatar photo={f.photo} logo={f.logo} name={nm} /></div>
        <div>
          {e.status === "error" && (
            <div className="cd-banner" style={{ color: "var(--bad)" }}>
              <Info size={15} /> Request failed ({e.error}). Check the server is running, then retry.
            </div>
          )}
          {e.aiError && !e.rejected && (
            <div className="cd-banner" style={{ color: "var(--bad)" }}>
              <Info size={15} /> AI step failed ({e.aiError}). Showing email-derived data only.
            </div>
          )}
          {e.rejected && (
            <div className="cd-banner"><Ban size={15} /> Enrichment rejected — only original data and your edits will sync/export.</div>
          )}
          {!e.rejected && e.data?.name && e.data.name !== (e.data.originalName || "") && !(e.edits?.name || "").trim() && (
            <div className="cd-banner">
              <Pencil size={15} /> Name set to <b style={{ color: "var(--ink)" }}>{e.data.name}</b>
              {e.data.originalName ? <> (was “{e.data.originalName}”)</> : <> (from email)</>}
            </div>
          )}

          {!e.rejected && f.summary && <div className="cd-sum">{f.summary}</div>}
          {!e.rejected && (f.jobTitle || f.company) && (
            <div className="cd-detrow"><Briefcase size={15} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {f.logo && <CompanyLogo src={f.logo} />}
                {[f.jobTitle, f.company].filter(Boolean).join(" — ")}
              </span></div>
          )}
          {!e.rejected && f.location && (<div className="cd-detrow"><MapPin size={15} /><span>{f.location}</span></div>)}
          {!e.rejected && f.website && (
            <div className="cd-detrow"><Globe size={15} />
              <a href={f.website} target="_blank" rel="noreferrer">{f.website.replace(/^https?:\/\//, "")}</a></div>
          )}
          {!e.rejected && f.linkedinUrl && (
            <div className="cd-detrow"><LinkIcon size={15} />
              <a href={f.linkedinUrl} target="_blank" rel="noreferrer">{f.linkedinUrl}</a></div>
          )}
          {!e.rejected && f.links.map((l, i) => (
            <div className="cd-detrow" key={i}><LinkIcon size={15} />
              <a href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></div>
          ))}

          <div className="cd-srclabel"><Pencil size={12} /> Add or override (your values win)</div>
          <div className="cd-editgrid">
            {EDIT_FIELDS.map(([k, lbl]) => (
              <div className="cd-field" key={k}>
                <label>{lbl}</label>
                <input value={form[k] || ""} placeholder={placeholderFor(k) || ("Add " + lbl.toLowerCase())}
                  onChange={(ev) => set(k, ev.target.value)} onBlur={commit} />
              </div>
            ))}
            <div className="cd-field full">
              <label>Summary / notes</label>
              <textarea value={form.summary || ""} placeholder={placeholderFor("summary") || "Add a short note"}
                onChange={(ev) => set("summary", ev.target.value)} onBlur={commit} />
            </div>
          </div>

          {(nm || f.company) && (
            <>
              <div className="cd-srclabel">Verify by hand</div>
              <div className="cd-verify">
                <a className="cd-vlink" target="_blank" rel="noreferrer"
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([nm, f.company].filter(Boolean).join(" "))}`}>
                  <ExternalLink size={13} /> LinkedIn
                </a>
                <a className="cd-vlink" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/search?q=${encodeURIComponent([nm, f.company].filter(Boolean).join(" "))}`}>
                  <ExternalLink size={13} /> Google
                </a>
                {f.website && (
                  <a className="cd-vlink" target="_blank" rel="noreferrer" href={f.website}>
                    <ExternalLink size={13} /> Company site
                  </a>
                )}
              </div>
            </>
          )}

          <div className="cd-detactions">
            <button className="cd-btn alt" onClick={() => onRetrace(row)} disabled={e.status === "loading"}>
              <RotateCw size={14} /> {e.status === "done" ? "Re-file" : "Trace this contact"}
            </button>
            <button className="cd-btn alt" onClick={() => onDeep(row)} disabled={e.status === "loading"}
              title="Run a deeper, multi-angle search using more web lookups">
              <Radar size={14} /> Deep check
            </button>
            {e.rejected ? (
              <button className="cd-btn alt" onClick={() => onRestore(row.__id)}><Undo2 size={14} /> Restore enrichment</button>
            ) : (
              <button className="cd-btn danger" onClick={() => onReject(row.__id)}><Ban size={14} /> Reject enrichment</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ photo, logo, name, small }) {
  const sources = [
    photo ? { url: photo, kind: "photo" } : null,
    logo ? { url: logo, kind: "logo" } : null,
  ].filter(Boolean);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [photo, logo]);
  const cls = small ? "cd-av" : "cd-bigav";
  const cur = sources[idx];
  if (cur) {
    return (
      <div className={cls + (cur.kind === "logo" ? " logo" : "")}>
        <img src={cur.url} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setIdx((i) => i + 1)} />
      </div>
    );
  }
  return <div className={cls}>{initials(name)}</div>;
}

function CompanyLogo({ src }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (err) return null;
  return <img className="cd-logo" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} />;
}
