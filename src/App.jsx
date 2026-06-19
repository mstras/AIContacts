import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  Upload, Search, Download, X, ChevronDown, ChevronRight, Settings,
  Link as LinkIcon, MapPin, Briefcase, StopCircle, Info, RotateCw, Globe, ExternalLink,
  Cpu, AlertTriangle, Ban, Undo2, Pencil,
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

.cd-drop{margin-top:26px;border:1.5px dashed #b9bbbd;border-radius:6px;background:var(--paper);
  padding:46px 24px;text-align:center;cursor:pointer;transition:.15s;}
.cd-drop:hover,.cd-drop.over{border-color:var(--signal);background:#fffdf7;}
.cd-drop h3{font-size:17px;margin:14px 0 4px;font-weight:600;}
.cd-drop p{font-size:13px;color:var(--muted);margin:0;}
.cd-circle{width:46px;height:46px;border-radius:50%;background:var(--ink);color:#fff;
  display:inline-flex;align-items:center;justify-content:center;}

.cd-bar{margin-top:22px;background:var(--paper);border:1px solid var(--line);border-radius:6px;
  padding:14px 16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;}
.cd-map{display:flex;gap:14px;flex-wrap:wrap;flex:1;min-width:240px;}
.cd-field{display:flex;flex-direction:column;gap:3px;}
.cd-field label{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);}
.cd-field select,.cd-field input{font-size:13px;padding:6px 8px;border:1px solid var(--line);border-radius:4px;
  background:#fff;color:var(--ink);}
.cd-field select{min-width:128px;}
.cd-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}

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
.cd-trow{display:grid;grid-template-columns:38px 46px 1.4fr 1.6fr 1.1fr 100px;gap:0;
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

const getName = (row, m) => {
  if (m.name && row[m.name]) return String(row[m.name]).trim();
  return [m.first && row[m.first], m.last && row[m.last]].filter(Boolean).join(" ").trim();
};

const initials = (s) =>
  (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

const EDIT_FIELDS = [
  ["jobTitle", "Job title"], ["company", "Company"], ["location", "Location"],
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

/* recognized Google Contacts CSV columns — passed through untouched on export */
const GCOL = /^(Name|Given Name|Additional Name|Family Name|Yomi Name|Name Prefix|Name Suffix|Initials|Nickname|Short Name|Maiden Name|First Name|Middle Name|Last Name|Phonetic First Name|Phonetic Middle Name|Phonetic Last Name|File As|Birthday|Gender|Location|Occupation|Notes|Photo|Group Membership|Labels|Organization.*|E-?mail \d+.*|Phone \d+.*|Address \d+.*|Website \d+.*|IM \d+.*|Relation \d+.*|Event \d+.*|Custom Field \d+.*)$/i;

const GOOGLE_FIELDS = [
  "First Name", "Middle Name", "Last Name", "Organization Name", "Organization Title",
  "E-mail 1 - Label", "E-mail 1 - Value", "Phone 1 - Label", "Phone 1 - Value",
  "Website 1 - Label", "Website 1 - Value", "Website 2 - Label", "Website 2 - Value",
  "Photo", "Notes", "Labels",
];

/* ----------------------------- app ----------------------------- */
export default function App() {
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
  const stopRef = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ configured: false }));
  }, []);

  const enrichedCount = useMemo(
    () => rows.filter((r) => r._e && r._e.status === "done").length, [rows]
  );

  const handleFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setMap(detectColumns(hs));
        setRows(res.data.map((r, i) => ({ ...r, __id: i, _e: { status: "idle", edits: {}, rejected: false } })));
        setOpen(null);
        setProg({ done: 0, total: 0 });
      },
    });
  }, []);

  const enrichOne = useCallback(async (row) => {
    const body = { name: getName(row, map), email: row[map.email] || "", company: row[map.company] || "" };
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
  }, [map]);

  // state mutators that preserve manual edits
  const setStatus = (id, status) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, status } } : r)));
  const applyResult = (id, result) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...result, edits: r._e.edits || {}, rejected: false } } : r)));
  const commitEdits = (id, edits) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, edits } } : r)));
  const setRejected = (id, rejected) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: { ...r._e, rejected } } : r)));

  const runAll = useCallback(async () => {
    const targets = rows.filter((r) => r._e.status !== "done" && !r._e.rejected);
    if (!targets.length) return;
    stopRef.current = false;
    setRunning(true);
    setProg({ done: 0, total: targets.length });
    let done = 0;
    const it = targets[Symbol.iterator]();
    const worker = async () => {
      for (const row of it) {
        if (stopRef.current) return;
        setStatus(row.__id, "loading");
        const result = await enrichOne(row);
        applyResult(row.__id, result);
        done += 1;
        setProg({ done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, targets.length) }, worker));
    setRunning(false);
  }, [rows, enrichOne]);

  const runRow = useCallback(async (row) => {
    setStatus(row.__id, "loading");
    const result = await enrichOne(row);
    applyResult(row.__id, result);
  }, [enrichOne]);

  /* --------- exports --------- */
  const download = (csv, suffix) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName.replace(/\.csv$/i, "") || "contacts") + suffix;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGoogle = useCallback(() => {
    const preserved = headers.filter((h) => GCOL.test(h));
    const data = rows.map((r) => {
      const eff = effective(r._e);
      const o = {};
      preserved.forEach((h) => (o[h] = r[h] ?? ""));

      const nm = getName(r, map);
      const hasFirst = (o["First Name"] || "").trim() || (o["Given Name"] || "").trim();
      if (!hasFirst && nm) {
        const p = nm.split(/\s+/);
        o["First Name"] = p[0] || "";
        o["Last Name"] = p.slice(1).join(" ") || "";
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
  }, [rows, headers, map, fileName]);

  const exportFull = useCallback(() => {
    const data = rows.map((r) => {
      const eff = effective(r._e);
      const base = {};
      headers.forEach((h) => (base[h] = r[h]));
      return {
        ...base,
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
  }, [rows, headers, map, fileName]);

  const reset = () => { setRows([]); setHeaders([]); setMap({}); setFileName(""); setOpen(null); };
  const notConfigured = cfg && !cfg.configured;

  return (
    <div className="cd-root">
      <style>{STYLE}</style>
      <div className="cd-wrap">
        <header className="cd-head">
          <div>
            <div className="cd-word">Contact <em>Dossier</em></div>
            <div className="cd-sub">Upload · enrich via your own AI · correct · export for Google Contacts</div>
          </div>
          <div className="cd-stamp cd-mono">
            {rows.length ? `${enrichedCount} / ${rows.length} filed` : "no roster loaded"}
          </div>
        </header>

        {rows.length === 0 ? (
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
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <>
            <div className="cd-bar">
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
              <div className="cd-actions">
                <button className="cd-btn alt cd-iconbtn" onClick={() => setShowEngine(!showEngine)} title="Enrichment engine">
                  <Settings size={15} />
                </button>
                {running ? (
                  <button className="cd-btn warn" onClick={() => (stopRef.current = true)}>
                    <StopCircle size={15} /> Stop
                  </button>
                ) : (
                  <button className="cd-btn" onClick={runAll}>
                    <Search size={15} /> Enrich all
                  </button>
                )}
                <button className="cd-btn alt" onClick={exportGoogle} disabled={!rows.length} title="CSV ready for Google Contacts import">
                  <Download size={15} /> Google CSV
                </button>
                <button className="cd-btn alt" onClick={exportFull} disabled={!rows.length} title="Original columns plus enrichment columns">
                  <Download size={15} /> Full CSV
                </button>
                <button className="cd-btn alt cd-iconbtn" onClick={reset} title="Load a different file">
                  <X size={15} />
                </button>
              </div>
            </div>

            {showEngine && (
              <div className="cd-engine">
                <h4><Cpu size={15} /> Enrichment engine</h4>
                <div className="cd-kv">
                  <div><span>Provider</span><b>{cfg?.provider || "—"}</b></div>
                  <div><span>Model</span><b>{cfg?.model || "—"}</b></div>
                  <div><span>Web search</span><b>{cfg?.webSearch ? "on" : "off"}</b></div>
                  <div><span>Status</span><b style={{ color: cfg?.configured ? "var(--good)" : "var(--bad)" }}>
                    {cfg?.configured ? "connected" : "not configured"}</b></div>
                </div>
                {notConfigured && (
                  <p>
                    <span className="cd-warnpill"><AlertTriangle size={12} /> email-derived data only</span><br /><br />
                    No AI provider is set, so you’ll get company, website, logo, and photo from each email — but not job
                    titles or locations. Set <code>AI_PROVIDER</code> (anthropic / openai / gemini) and
                    <code> AI_API_KEY</code> in <code>.env</code>, then restart. You can still add data by hand on any contact.
                  </p>
                )}
                {cfg?.configured && (
                  <p>Job titles, locations, and profiles come from <b>{cfg.provider}</b> using your own key, which stays
                    on the server. Change provider, model, or key in <code>.env</code> and restart to take effect.</p>
                )}
              </div>
            )}

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
                <div></div><div></div><div>Contact</div><div>Role / Employer</div><div>Location</div><div>Result</div>
              </div>
              {rows.map((r) => {
                const nm = getName(r, map);
                const f = effective(r._e);
                const isOpen = open === r.__id;
                const [chipCls, chipTxt] = chipFor(r._e);
                return (
                  <React.Fragment key={r.__id}>
                    <div className={"cd-trow body" + (r._e.rejected ? " rej" : "")} onClick={() => setOpen(isOpen ? null : r.__id)}>
                      <div>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                      <div><Avatar photo={f.photo} name={nm} small /></div>
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
                      <Detail
                        row={r} nm={nm}
                        onCommit={commitEdits}
                        onReject={(id) => setRejected(id, true)}
                        onRestore={(id) => setRejected(id, false)}
                        onRetrace={runRow}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        <div className="cd-note">
          <div className="cd-notehead" onClick={() => setShowNote(!showNote)}>
            <Info size={16} /> How enrichment, edits, and export work
            {showNote ? <ChevronDown size={15} style={{ marginLeft: "auto" }} /> : <ChevronRight size={15} style={{ marginLeft: "auto" }} />}
          </div>
          {showNote && (
            <div className="cd-notebody">
              <b>Enrich.</b> Each contact gets email-derived data (company, website, logo, Gravatar photo) on the server,
              then — if an AI provider is configured — a web-grounded job title, location, and profile merged on top.<br /><br />
              <b>Correct or reject.</b> Open any contact to type your own values (these always win), or hit
              <b> Reject enrichment</b> to drop the machine’s data for that person. Your typed corrections survive a reject,
              so you can reject a bad guess and enter the right answer.<br /><br />
              <b>Export.</b> <b>Google CSV</b> maps everything into Google Contacts’ own columns (Organization Name/Title,
              Website, Notes, Photo, an “Enriched” label) and passes through any Google-format columns your file already had,
              so it re-imports cleanly without losing phones or addresses. <b>Full CSV</b> keeps all your original columns and
              appends the enrichment as extra columns. Both honor your edits and rejections.<br /><br />
              <b>Verify.</b> AI results can be wrong or stale — the per-contact LinkedIn/Google links are there to confirm,
              and your use should fit the contacts’ expectations and applicable privacy law.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------- contact detail panel ----------------------- */
function Detail({ row, nm, onCommit, onReject, onRestore, onRetrace }) {
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
        <div><Avatar photo={f.photo} name={nm} /></div>
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
            <div className="cd-banner"><Ban size={15} /> Enrichment rejected — only original data and your edits will export.</div>
          )}

          {!e.rejected && f.summary && <div className="cd-sum">{f.summary}</div>}
          {!e.rejected && (f.jobTitle || f.company) && (
            <div className="cd-detrow"><Briefcase size={15} />
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {f.logo && <CompanyLogo src={f.logo} />}
                {[f.jobTitle, f.company].filter(Boolean).join(" — ")}
              </span></div>
          )}
          {!e.rejected && f.location && (
            <div className="cd-detrow"><MapPin size={15} /><span>{f.location}</span></div>
          )}
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
            {e.rejected ? (
              <button className="cd-btn alt" onClick={() => onRestore(row.__id)}>
                <Undo2 size={14} /> Restore enrichment
              </button>
            ) : (
              <button className="cd-btn danger" onClick={() => onReject(row.__id)}>
                <Ban size={14} /> Reject enrichment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ photo, name, small }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [photo]);
  const cls = small ? "cd-av" : "cd-bigav";
  if (photo && !err)
    return <div className={cls}><img src={photo} alt={name} onError={() => setErr(true)} /></div>;
  return <div className={cls}>{initials(name)}</div>;
}

function CompanyLogo({ src }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (err) return null;
  return <img className="cd-logo" src={src} alt="" onError={() => setErr(true)} />;
}
