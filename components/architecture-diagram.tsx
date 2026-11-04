"use client";
import { useEffect, useId, useState } from "react";
const chart = `flowchart TB
  accTitle: Trippie verified photo-to-draft workflow
  accDescr: Imported Pixel photos are interpreted by Muse Spark Open on Fireworks. Plano GIS estimates location and Muse groups views of one issue. Reviewed SAM 3.1 highlights and draft city cases are stored in Supabase and displayed in the public Next.js portal. Observations with no actionable issue are retained without creating a case. City submission is outside this workflow.
  A["1 · CAPTURE\nPixel photo + EXIF"] --> B["2 · INTERPRET\nMuse Spark Open on Fireworks"]
  B --> C["3 · LOCATE & GROUP\nPlano GIS + Muse multi-image reasoning"]
  C --> D["4 · HIGHLIGHT & CHECK\nSAM 3.1 via Meta Model API"]
  D --> E["5 · PREPARE\nDraft city case + original attachment"]
  B -->|"No actionable finding"| O["Observation only"]
  E --> S["SUPABASE\nPostgres records + image storage"]
  O --> S
  S --> P["6 · PUBLISH & INSPECT\nNext.js portal + OpenStreetMap"]
  classDef model fill:#e5efd5,stroke:#9ab67c,color:#344d2b
  classDef local fill:#f7f9f1,stroke:#c2d0b0,color:#415837
  class B,C,D model
  class A,E,O,S,P local`;
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
