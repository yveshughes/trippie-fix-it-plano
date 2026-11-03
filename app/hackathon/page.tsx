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
    title: "Patrol and capture",
    tech: "Android camera + location · Bluetooth · Rugged Robot",
    body: "Muse Spark Open is the driving agent: it reads the mounted phone’s camera view and chooses forward, turn, or stop actions. The Android app translates validated commands into Bluetooth Low Energy (BLE) messages for the Rugged Robot, while capturing photos, time, and location accuracy.",
    output: "Photo + location + capture time",
  },
  {
    title: "Assess the scene",
    tech: "Muse Spark Open · Fireworks · server-side API gateway",
    body: "The gateway sends the image and enabled inspection targets to Muse Spark Open. The model identifies potential concerns, explains uncertainty, and decides whether another view is needed.",
    output: "Potential finding + next inspection action",
  },
  {
    title: "Avoid obstacles and investigate",
    tech: "Muse tool calls · Android controller · Bluetooth",
    body: "The control loop checks for obstacles before movement. Muse chooses a clear route or requests another view; the Android controller limits each move and stops on stale images, lost connectivity, or an unsafe command. Fresh camera evidence returns to Muse before continuing. Onboard obstacle avoidance is an additional local safeguard, not a substitute for scene checks.",
    output: "Follow-up image + reassessed finding",
  },
  {
    title: "Outline the evidence",
    tech: "SAM 3.1 · Meta Model API",
    body: "SAM receives an image and region prompt to outline the suspected defect. Preserve the original beside the mask so a reviewer can inspect what the model highlighted.",
    output: "Original image + segmentation outline",
  },
  {
    title: "Review and prepare a case",
    tech: "Next.js 16 · React 19 · TypeScript · Leaflet / OpenStreetMap",
    body: "The portal presents the location, photos, interpretation, and suggested priority. An administrator reviews the observation queue and scrolls through case photos, SAM highlights, and case submission text.",
    output: "Human-reviewed evidence package",
  },
  {
    title: "Report and follow up",
    tech: "Reporting agent · Fix It Plano forms",
    body: "The reporting agent selects the correct city form, fills supported fields from reviewed evidence, and requests approval before sending. Confirmed city references and the exact submitted text return to the case feed.",
    output: "Case reference + follow-up record",
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
                A rugged toy robot with an Android phone, designed to find
                potential sidewalk hazards and prepare evidence for city
                maintenance reports.
              </p>
              <ul>
                <li>
                  Configurable targets: uneven pavement, obstructions, debris,
                  and other maintenance concerns.
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
                From camera capture to a city case: what happens and which technology does it.
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
                Cloud reasoning, local control, human review.
              </p>
              <ArchitectureDiagram />
              <p className="diagram-note">
                Muse Spark Open chooses driving and inspection actions; Android executes them over Bluetooth with local movement limits. Obstacle avoidance is part of the control loop. SAM outlines
                a region; it does not determine severity. The phone’s
                calibrated, stationary tilt reading could support slope
                observations, not measure crack height.
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
                  <strong>Model-driven robot control:</strong> Muse Spark Open → validated movement tool → Android → Bluetooth LE → robot. Camera feedback closes the obstacle-avoidance loop; local stop rules remain on the phone.
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
                  <strong>Technical execution · 20%</strong> Robot + phone +
                  inspection loop + evidence portal.
                </li>
                <li>
                  <strong>Demo · 25%</strong> Follow one finding from camera capture
                  through model reasoning, SAM highlighting, and city reporting.
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
