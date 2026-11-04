"use client";
import { useEffect, useId, useState } from "react";
const chart = `flowchart TB
  accTitle: Trippie mission-to-city-report architecture
  accDescr: Android captures photos, fresh GPS and voice missions, executes validated Bluetooth actions and operates the official city form. Muse Spark Open on Fireworks interprets scenes and selects bounded navigation actions. Plano GIS estimates locations. SAM 3.1 on the Meta Model API produces highlights checked by Muse Spark Open. Supabase stores evidence and submission records. The Next.js portal shows observations, submitted reports and available city references.
  M["MISSION\nVoice transcript or saved goal"] --> A["ANDROID / PIXEL\nCameraX + GPS + original JPEG"]
  A --> N["NAVIGATE\nMuse Spark Open on Fireworks + action validation"]
  N --> R["ANDROID BLE\nOne action, stop, reobserve"]
  R --> A
  A --> B["INTERPRET\nMuse Spark Open on Fireworks"]
  B --> C["LOCATE & GROUP\nPlano GIS + image comparison"]
  C --> D["HIGHLIGHT & CHECK\nSAM 3.1 / Meta API + Muse Spark Open review"]
  D --> E["REPORT PAYLOAD\nCity form fields + original photo"]
  E --> F["ANDROID WEBVIEW AGENT\nFill, verify, reserve and submit"]
  F --> CITY["FIX IT PLANO\nOfficial Curb Repair form"]
  CITY --> CONF["RECONCILE\nSave city reference when returned"]
  F --> S["SUPABASE\nPostgres + private evidence storage"]
  CONF --> S
  B -->|"No actionable finding"| O["Observation only"]
  O --> S
  E --> S
  S --> P["PUBLIC NEXT.JS PORTAL\nOpenStreetMap + observations + case feed"]
  classDef model fill:#e5efd5,stroke:#9ab67c,color:#344d2b
  classDef local fill:#f7f9f1,stroke:#c2d0b0,color:#415837
  class B,C,D,N model
  class M,A,R,E,F,CITY,CONF,O,S,P local`;
export default function ArchitectureDiagram() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        await document.fonts.ready;
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            primaryColor: "#f7f9f1",
            primaryTextColor: "#415837",
            primaryBorderColor: "#c2d0b0",
            lineColor: "#82986c",
            edgeLabelBackground: "#f8faf4",
          },
          flowchart: {
            htmlLabels: false,
            curve: "basis",
            nodeSpacing: 18,
            rankSpacing: 28,
            useMaxWidth: true,
          },
        });
        const result = await mermaid.render(`trippie-${id}`, chart);
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [id]);
  return (
    <div className="mermaid-panel">
      {svg ? (
        <div
          className="rendered-mermaid"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p role="status">
          {error
            ? "Diagram unavailable. The process is described step by step alongside it."
            : "Rendering architecture diagram…"}
        </p>
      )}
      <details>
        <summary>Mermaid source</summary>
        <pre>{chart}</pre>
      </details>
    </div>
  );
}
