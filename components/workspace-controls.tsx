"use client";
import { useEffect, useState } from "react";
export default function WorkspaceControls() {
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState("");
  const notify = (next: "live" | "demo") => {
    setMode(next);
    window.dispatchEvent(new CustomEvent("trippie-workspace", { detail: next }));
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!cancelled) {
        setCanManage(data.canManage === true);
        let initial = data.mode;
        if (!data.canManage) {
          try { const saved = sessionStorage.getItem("trippie-view-mode"); if (saved === "live" || saved === "demo") initial = saved; } catch {}
        }
        notify(initial);
      }
    }).catch(() => { if (!cancelled) setMessage("Workspace unavailable"); });
    return () => { cancelled = true; };
  }, []);
  async function change(next: "live" | "demo") {
    if (!canManage) {
      setMessage(""); notify(next);
      try { sessionStorage.setItem("trippie-view-mode", next); } catch {}
      return;
    }
    setBusy(true); setMessage(""); setConfirmClear(false);
    try {
      const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw new Error();
      notify(next);
    } catch { setMessage("Could not switch workspace"); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspace", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "demo" }) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      notify("demo");
      setMessage(result.fileErrors ? "Demo entries cleared; some stored files need cleanup." : "Demo data cleared. LIVE data kept.");
      setConfirmClear(false);
    } catch { setMessage("Could not clear demo data"); }
    finally { setBusy(false); }
  }
  return <div className="workspace-controls">
    <div className="workspace-toggle" role="group" aria-label="Data workspace">
      {(["live", "demo"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} disabled={busy || !mode} onClick={() => change(value)}>{value.toUpperCase()}</button>)}
    </div>
    {mode === "demo" && canManage && <button className="workspace-clear" type="button" disabled={busy} onClick={() => setConfirmClear(!confirmClear)}>Clear demo data</button>}
    {confirmClear && <div className="workspace-confirm"><p>Delete all DEMO observations, cases and photos? LIVE data stays.</p><button type="button" disabled={busy} onClick={clear}>Clear DEMO</button><button type="button" disabled={busy} onClick={() => setConfirmClear(false)}>Cancel</button></div>}
    {message && <span className="workspace-message" role="status">{message}</span>}
  </div>;
}
