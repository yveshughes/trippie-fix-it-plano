"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
const storageKey = "trippie-affiliation-dismissed";
export default function AffiliationBanner() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try { setVisible(sessionStorage.getItem(storageKey) !== "yes"); } catch { /* Dismissal still works without storage. */ }
  }, []);
  if (!visible) return null;
  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(storageKey, "yes"); } catch { /* Keep this visit usable. */ }
  }
  return <aside className="affiliation-banner" aria-label="City affiliation notice">
    <p>This is not affiliated with the City of Plano (but we can hope).</p>
    <button type="button" onClick={dismiss} aria-label="Dismiss city affiliation notice"><X size={17} aria-hidden="true" /></button>
  </aside>;
}
