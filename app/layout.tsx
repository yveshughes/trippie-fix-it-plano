import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Trippie · Neighborhood watch, reimagined",
  description: "Patrols, evidence, and actionable reports for safer sidewalks.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // The in-app browser may inject probe attributes before React hydrates.
    // Limit suppression to this root element; child mismatches still surface.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
