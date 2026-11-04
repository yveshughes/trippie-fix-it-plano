import type { Metadata } from "next";
import AppHeader from "@/components/app-header";
import ArchitectureDiagram from "@/components/architecture-diagram";
import "./home.css";
export const metadata: Metadata = {
  title: "Trippie · Meta Hackathon Home",
  description:
    "What Trippie does, why it matters, and the technologies behind each inspection step.",
};
const steps = [
  {
    title: "Capture the evidence",
    tech: "Pixel 10 camera · JPEG / EXIF · local intake",
    body: "Street-level photos supply the original evidence, capture time, and available GPS. The field trial uses 15 imported Pixel photos. Location accuracy is recorded when available; an unreported value stays unknown.",
    output: "Original photo + capture metadata",
  },
  {
    title: "Interpret the scene",
    tech: "Muse Spark Open · Fireworks",
    body: "Muse identifies visible maintenance concerns, records observed facts and uncertainty, and suggests a city form and draft description. Photos with no actionable finding stay in the observation feed.",
    output: "Structured observation + model request ID",
  },
  {
    title: "Locate and group the finding",
    tech: "City of Plano GIS · Muse multi-image reasoning",
    body: "Photo GPS is matched to nearby road geometry and connected intersections. Muse compares multiple views to group one physical issue into one case. Locations remain estimates, with intersection offsets; reused GPS alone does not establish a duplicate.",
    output: "Estimated intersection + grouped evidence",
  },
  {
    title: "Highlight the problem area",
    tech: "SAM 3.1 · Meta Model API · mask review",
    body: "SAM uses region, box, and point prompts to segment the selected surface or object. Each published highlight is checked against the source photo, request, prompt and image hash. The portal preserves the original alongside the reviewed mask.",
    output: "Original + reviewed SAM highlight",
  },
  {
    title: "Prepare the city case",
    tech: "Audited Fix It Plano forms · draft case payload",
    body: "The draft contains the request type, estimated location, concise description and original-photo attachment. The field trial produces two draft cases. Form preparation was checked in the browser; no city request was submitted.",
    output: "Draft case ready for final form review",
  },
  {
    title: "Publish and inspect",
    tech: "Supabase · Next.js · React · Leaflet / OpenStreetMap",
    body: "Supabase stores observations, case records and image assets. The public portal shows the map, original/SAM comparison, magnifier and case feed without sign-in. Protected operator commands manage capture mode and disposable DEMO data.",
    output: "Public evidence portal + durable case records",
  },
];
export default function HackathonHome() {
  return (
    <div className="shell">
      <main>
        <AppHeader active="Hackathon" />
        <section className="hackathon-content">
          <div className="hackathon-heading">
            <h1>Trippie: a favorite toy, a new purpose.</h1>
            <p>
              Meta Global AI Developer Hackathon · Indie / Push the
              Frontier entry
            </p>
          </div>
          <div className="hackathon-intro">
            <article className="brief-block">
              <h2>What</h2>
              <p>
                A neighborhood inspection prototype that turns street-level photos into located, highlighted evidence and draft city maintenance cases. A Pixel phone mounted on a favorite toy robot gives Trippie its point of view.
              </p>
              <ul>
                <li>
                  Verified field trial: 15 Pixel photos, two draft cases, and three reviewed SAM highlights.
                </li>
                <li>
                  Original photos, highlighted regions, AI interpretation, and
                  case review in one portal.
                </li>
              </ul>
            </article>
            <article className="brief-block">
              <h2>Why</h2>
              <p>
                “It was a terrible fall. I know—because it was me.” A fall in my
                neighborhood inspired Trippie: notice the hazard before the next
                person trips.
              </p>
              <p>
                A study of 2019 U.S. EMS records identified{" "}
                <strong>
                  118,520 injurious falls on streets and sidewalks
                </strong>
                —not all caused by damaged pavement.{" "}
                <a
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10897068/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Study ↗
                </a>
              </p>
            </article>
          </div>
          <div className="hackathon-process">
            <section className="brief-block process-steps">
              <h2>How it works, step by step</h2>
              <p className="brief-muted">
                Follow the verified photo-to-draft workflow and the technology used at each step.
              </p>
              <ol>
                {steps.map((step, index) => (
                  <li key={step.title}>
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p className="step-tech">{step.tech}</p>
                      <p>{step.body}</p>
                      <p className="step-output">
                        <strong>Produces:</strong> {step.output}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <section className="brief-block process-diagram">
              <h2>Architecture · Mermaid</h2>
              <p className="brief-muted">
                Photo capture, model interpretation, checked evidence, public review.
              </p>
              <ArchitectureDiagram />
              <p className="diagram-note">
                The diagram follows the implemented imported-photo workflow. SAM marks visible regions; the photos do not establish defect height. Draft cases are distinct from submitted city requests.
              </p>
            </section>
          </div>
          <div className="hackathon-bottom">
            <section className="brief-block">
              <h2>What matters technically</h2>
              <ul>
                <li>
                  <strong>Open-weight reasoning:</strong> Muse Spark Open is
                  hosted on Fireworks; it runs in the cloud, not on the phone.
                </li>
                <li>
                  <strong>Hardware baseline:</strong> the replacement Rugged Robot travelled five forward steps straight through its official app. That bench test is separate from the photo-analysis workflow shown here.
                </li>
                <li>
                  <strong>Evidence integrity:</strong> keep original + SAM
                  output, timestamps, location accuracy, and model request IDs
                  with every case.
                </li>
                <li>
                  <strong>Original work:</strong> new portal and inspection
                  workflow. Existing toy hardware and earlier Pi experiments are
                  the starting point.
                </li>
              </ul>
            </section>
            <section className="brief-block">
              <h2>Judging alignment</h2>
              <ul className="rubric-list">
                <li>
                  <strong>Impact · 30%</strong> Earlier hazard discovery and
                  actionable evidence for city maintenance teams.
                </li>
                <li>
                  <strong>Meta tooling · 25%</strong> Muse Spark Open for
                  reasoning; SAM 3.1 for segmentation.
                </li>
                <li>
                  <strong>Technical execution · 20%</strong> Traceable model outputs, verified image migration, durable storage and a working public evidence portal.
                </li>
                <li>
                  <strong>Demo · 25%</strong> Follow one finding from camera capture
                  through model reasoning, SAM highlighting, and a prepared city case.
                </li>
              </ul>
              <p className="brief-source">
                Weights: participant guide reviewed Oct. 31.{" "}
                <a
                  href="https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details"
                  target="_blank"
                  rel="noreferrer"
                >
                  Guide ↗
                </a>
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
