"use client";
import Link from "next/link";
import WorkspaceControls from "./workspace-controls";
import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Layers } from "lucide-react";
import TrippieAvatar from "./trippie-avatar";
import { loadObservations } from "@/lib/storage";
type Props = {
  active: string;
  onTab?: (tab: string) => void;
  observations?: number;
  cases?: number;
};
export default function AppHeader({
  active,
  onTab,
  observations,
  cases,
}: Props) {
  const [counts, setCounts] = useState({ observations: 3, cases: 1 });
  useEffect(() => {
    if (observations !== undefined) return;
    let cancelled = false;
    loadObservations()
      .then((items) => {
        if (items && !cancelled)
          setCounts({
            observations: items.length,
            cases: items.filter((x) => x.status !== "Needs review").length,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [observations]);
  return (
    <header className="app-header">
      <Link className="brand" href="/">
        <TrippieAvatar />
        trippie<span className="brand-dot">.</span>
      </Link>
      <nav aria-label="App navigation">
        {[
          { name: "Overview", icon: Layers },
          { name: "Observations", icon: ImageIcon },
          { name: "Cases", icon: FileText },
        ].map(({ name, icon: Icon }) => (
          <Link
            key={name}
            href={name === "Overview" ? "/" : `/?tab=${name.toLowerCase()}`}
            className={active === name ? "nav active" : "nav"}
            aria-current={active === name ? "page" : undefined}
            onClick={(e) => {
              if (onTab) {
                e.preventDefault();
                onTab(name);
              }
            }}
          >
            <Icon size={18} />
            {name}
            {name === "Observations" && (
              <span>{observations ?? counts.observations}</span>
            )}
            {name === "Cases" && <span>{cases ?? counts.cases}</span>}
          </Link>
        ))}
      </nav>
      <WorkspaceControls />
      <Link
        className={`hackathon-nav-link ${active === "Hackathon" ? "current" : ""}`}
        aria-current={active === "Hackathon" ? "page" : undefined}
        href="/hackathon"
      >
        Meta <span>|</span> Hackathon Home
      </Link>
      <Link className={`documentation-nav-link ${active === "Documentation" ? "current" : ""}`} aria-current={active === "Documentation" ? "page" : undefined} href="/documentation">Documentation</Link>
    </header>
  );
}
