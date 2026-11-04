"use client";
import Link from "next/link";
import WorkspaceControls from "./workspace-controls";
import TrippieAvatar from "./trippie-avatar";
type Props = {
  active: string;
  onTab?: (tab: string) => void;
  observations?: number;
  cases?: number;
};
export default function AppHeader({ active }: Props) {
  return (
    <header className="app-header">
      <Link className="brand" href="/">
        <TrippieAvatar />
        trippie<span className="brand-dot">.</span>
      </Link>
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
