import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  Upload, Search, Download, X, ChevronDown, ChevronRight, Settings,
  Link as LinkIcon, MapPin, Briefcase, StopCircle, Info, RotateCw, Globe, ExternalLink,
  Cpu, AlertTriangle,
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
.cd-field select{font-size:13px;padding:6px 8px;border:1px solid var(--line);border-radius:4px;
  background:#fff;color:var(--ink);min-width:128px;}
.cd-actions{display:flex;gap:10px;align-items:center;}

.cd-btn{font-size:13px;font-weight:600;padding:9px 16px;border-radius:5px;border:1px solid var(--ink);
  background:var(--ink);color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:.12s;}
.cd-btn:hover{background:var(--ink2);}
.cd-btn:disabled{opacity:.4;cursor:not-allowed;}
.cd-btn.alt{background:var(--paper);color:var(--ink);}
.cd-btn.alt:hover{background:#fff;}
.cd-btn.warn{background:var(--signal);border-color:var(--signal);}
.cd-btn.warn:hover{filter:brightness(.95);}
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
.cd-trow>div{padding:12px;min-width:0;}
.cd-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-namesub{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-cell{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cd-cell.empty{color:#b6b8ba;}

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
.cd-verify{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
.cd-vlink{font-size:11.5px;font-weight:600;padding:6px 10px;border:1px solid var(--line);border-radius:4px;
  color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:var(--paper);}
.cd-vlink:hover{background:#fff;border-color:var(--signal);}
.cd-srclabel{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px;}

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

const confChip = {
  high: ["match", "ENRICHED"], medium: ["partial", "DERIVED"],
  low: ["none", "MINIMAL"], none: ["none", "MINIMAL"],
};

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
        setRows(res.data.map((r, i) => ({ ...r, __id: i, _e: { status: "idle" } })));
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
      const confidence = d.jobTitle || d.location ? "high" : (d.company || d.photo || d.website) ? "medium" : "low";
      return { status: "done", data: d, confidence, aiError: d.aiError };
    } catch (e) {
      return { status: "error", error: String(e.message || e) };
    }
  }, [map]);

  const setRowState = (id, e) =>
    setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, _e: e } : r)));

  const runAll = useCallback(async () => {
    const targets = rows.filter((r) => r._e.status !== "done");
    if (!targets.length) return;
    stopRef.current = false;
    setRunning(true);
    setProg({ done: 0, total: targets.length });

    let done = 0;
    const it = targets[Symbol.iterator]();
    const worker = async () => {
      for (const row of it) {
        if (stopRef.current) return;
        setRowState(row.__id, { status: "loading" });
        const result = await enrichOne(row);
        setRowState(row.__id, result);
        done += 1;
        setProg({ done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, targets.length) }, worker));
    setRunning(false);
  }, [rows, enrichOne]);

  const runRow = useCallback(async (row) => {
    setRowState(row.__id, { status: "loading" });
    setRowState(row.__id, await enrichOne(row));
  }, [enrichOne]);

  const exportCsv = useCallback(() => {
    const out = rows.map((r) => {
      const d = (r._e && r._e.data) || {};
      const base = {};
      headers.forEach((h) => (base[h] = r[h]));
      return {
        ...base,
        "Enriched Title": d.jobTitle || "",
        "Enriched Company": d.company || "",
        "Location": d.location || "",
        "LinkedIn": d.linkedinUrl || "",
        "Website": d.website || "",
        "Profile Summary": d.summary || "",
        "Photo URL": d.photo || "",
        "Source": d.source || "",
        "Result": r._e.confidence || "",
      };
    });
    const blob = new Blob([Papa.unparse(out)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = (fileName.replace(/\.csv$/i, "") || "contacts") + "-enriched.csv";
    a.click(); URL.revokeObjectURL(url);
  }, [rows, headers, fileName]);

  const reset = () => { setRows([]); setHeaders([]); setMap({}); setFileName(""); setOpen(null); };

  const notConfigured = cfg && !cfg.configured;

  return (
    <div className="cd-root">
      <style>{STYLE}</style>
      <div className="cd-wrap">
        <header className="cd-head">
          <div>
            <div className="cd-word">Contact <em>Dossier</em></div>
            <div className="cd-sub">Upload a roster · enrich via your own AI · file the results</div>
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
                  <button className="cd-btn" onClick={runAll} disabled={enrichedCount === rows.length}>
                    <Search size={15} /> Enrich all
                  </button>
                )}
                <button className="cd-btn alt" onClick={exportCsv} disabled={!enrichedCount}>
                  <Download size={15} /> Export
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
                    titles or locations. To switch it on, set <code>AI_PROVIDER</code> (anthropic / openai / gemini) and
                    <code>AI_API_KEY</code> in your <code>.env</code>, then restart the container.
                  </p>
                )}
                {cfg?.configured && (
                  <p>Job titles, locations, and profiles come from <b>{cfg.provider}</b> using your own key, which stays
                    on the server. Change the provider, model, or key in <code>.env</code> and restart to take effect.</p>
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
                const d = r._e.data || {};
                const isOpen = open === r.__id;
                const [chipCls, chipTxt] =
                  r._e.status === "loading" ? ["pend", "WORKING"] :
                  r._e.status === "error" ? ["err", "ERROR"] :
                  r._e.status === "done" ? (confChip[r._e.confidence] || confChip.none) :
                  ["none", "—"];
                return (
                  <React.Fragment key={r.__id}>
                    <div className="cd-trow body" onClick={() => setOpen(isOpen ? null : r.__id)}>
                      <div>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                      <div><Avatar photo={d.photo} name={nm} small /></div>
                      <div>
                        <div className="cd-name">{nm || <span style={{ color: "#b6b8ba" }}>unnamed</span>}</div>
                        <div className="cd-namesub cd-mono">{r[map.email] || ""}</div>
                      </div>
                      <div>
                        {d.jobTitle || d.company
                          ? <div className="cd-cell">{[d.jobTitle, d.company].filter(Boolean).join(" · ")}</div>
                          : <div className="cd-cell empty">{r[map.company] || "—"}</div>}
                      </div>
                      <div className="cd-cell">{d.location || <span className="empty">—</span>}</div>
                      <div><span className={"cd-chip " + chipCls}>{chipTxt}</span></div>
                    </div>
                    {isOpen && (
                      <div className="cd-detail">
                        <div className="cd-detgrid">
                          <div><Avatar photo={d.photo} name={nm} /></div>
                          <div>
                            {r._e.status === "idle" && (
                              <div className="cd-detrow"><Info size={15} /> Not yet filed — run “Enrich all” or trace this one.</div>
                            )}
                            {r._e.status === "error" && (
                              <div className="cd-detrow" style={{ color: "var(--bad)" }}>
                                <Info size={15} /> Request failed ({r._e.error}). Check the server is running, then retry.
                              </div>
                            )}
                            {r._e.aiError && (
                              <div className="cd-detrow" style={{ color: "var(--bad)" }}>
                                <Info size={15} /> AI step failed ({r._e.aiError}). Showing email-derived data only.
                              </div>
                            )}
                            {d.summary && <div className="cd-sum">{d.summary}</div>}
                            {(d.jobTitle || d.company) && (
                              <div className="cd-detrow"><Briefcase size={15} />
                                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {d.logo && <CompanyLogo src={d.logo} />}
                                  {[d.jobTitle, d.company].filter(Boolean).join(" — ")}
                                </span></div>
                            )}
                            {d.location && (
                              <div className="cd-detrow"><MapPin size={15} /><span>{d.location}</span></div>
                            )}
                            {d.website && (
                              <div className="cd-detrow"><Globe size={15} />
                                <a href={d.website} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\//, "")}</a></div>
                            )}
                            {d.linkedinUrl && (
                              <div className="cd-detrow"><LinkIcon size={15} />
                                <a href={d.linkedinUrl} target="_blank" rel="noreferrer">{d.linkedinUrl}</a></div>
                            )}
                            {Array.isArray(d.links) && d.links.map((l, i) => (
                              <div className="cd-detrow" key={i}><LinkIcon size={15} />
                                <a href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></div>
                            ))}

                            {(nm || d.company) && (
                              <>
                                <div className="cd-srclabel">Verify by hand</div>
                                <div className="cd-verify">
                                  <a className="cd-vlink" target="_blank" rel="noreferrer"
                                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([nm, d.company].filter(Boolean).join(" "))}`}>
                                    <ExternalLink size={13} /> LinkedIn
                                  </a>
                                  <a className="cd-vlink" target="_blank" rel="noreferrer"
                                    href={`https://www.google.com/search?q=${encodeURIComponent([nm, d.company].filter(Boolean).join(" "))}`}>
                                    <ExternalLink size={13} /> Google
                                  </a>
                                  {d.website && (
                                    <a className="cd-vlink" target="_blank" rel="noreferrer" href={d.website}>
                                      <ExternalLink size={13} /> Company site
                                    </a>
                                  )}
                                </div>
                              </>
                            )}

                            <div style={{ marginTop: 14 }}>
                              <button className="cd-btn alt" onClick={() => runRow(r)} disabled={r._e.status === "loading"}>
                                <RotateCw size={14} /> {r._e.status === "done" ? "Re-file" : "Trace this contact"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        <div className="cd-note">
          <div className="cd-notehead" onClick={() => setShowNote(!showNote)}>
            <Info size={16} /> Where the data comes from
            {showNote ? <ChevronDown size={15} style={{ marginLeft: "auto" }} /> : <ChevronRight size={15} style={{ marginLeft: "auto" }} />}
          </div>
          {showNote && (
            <div className="cd-notebody">
              <b>Two layers.</b> Every contact first gets <b>email-derived</b> data computed on the server — company name,
              website, and logo from the domain (personal domains like gmail are skipped), plus a Gravatar photo if one
              exists. Then, if you’ve configured an AI provider, the server asks it (with web-search grounding) for the
              <b> job title, location, and profile</b>, and merges what it finds on top.<br /><br />
              <b>Your key stays server-side.</b> The browser never sees it — it only talks to this app’s own
              <code>/api/enrich</code> endpoint, which calls Anthropic, OpenAI, or Gemini for you.<br /><br />
              <b>Verify before acting.</b> AI results can be wrong or stale, so each contact has one-click LinkedIn and
              Google links to confirm. Make sure your use fits the contacts’ expectations and applicable privacy law.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ photo, name, small }) {
  const [err, setErr] = useState(false);
  const cls = small ? "cd-av" : "cd-bigav";
  if (photo && !err)
    return <div className={cls}><img src={photo} alt={name} onError={() => setErr(true)} /></div>;
  return <div className={cls}>{initials(name)}</div>;
}

function CompanyLogo({ src }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img className="cd-logo" src={src} alt="" onError={() => setErr(true)} />;
}
