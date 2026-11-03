"use client";
import { useEffect, useId, useState } from "react";
const chart = `flowchart TB
  accTitle: Trippie inspection process
  accDescr: An Android phone controls the robot via Bluetooth and captures photos and location. A backend gateway calls Muse Spark Open on Fireworks for inspection decisions. Follow-up requests return to local command validation. Meta SAM 3.1 outlines the selected region. Evidence is reviewed in the Next.js portal before an approved reporting agent submits a city case. Muse chooses driving actions and Android validates Bluetooth movement, with obstacle checks and local stop rules.
  A["1 · PATROL & CAPTURE\nAndroid + Rugged Robot"] -->|"Photo, location, accuracy, time"| G["API gateway\nServer-side credentials"]
  G --> B["2 · ASSESS\nMuse Spark Open on Fireworks"]
  B --> C{"Enough evidence?"}
  C -->|"Drive, avoid, or inspect"| D["3 · AVOID & INVESTIGATE\nAndroid safety controller"]
  D -->|"Bluetooth LE + camera feedback"| A
  C -->|"Yes: region to inspect"| E["4 · OUTLINE\nSAM 3.1 via Meta Model API"]
  E --> F["5 · REVIEW\nNext.js evidence portal"]
  F -->|"Human-approved case"| H["6 · REPORT\nReporting agent"]
  classDef model fill:#e5efd5,stroke:#9ab67c,color:#344d2b
  classDef local fill:#f7f9f1,stroke:#c2d0b0,color:#415837
  class B,E model
  class A,D,F,G,H local`;
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
