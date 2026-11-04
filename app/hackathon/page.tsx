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
    title: "Give Trippie a mission",
    tech: "Native Android · speech recognition · CameraX · Bluetooth LE",
    body: "Speak or select a saved mission. The Pixel shows the transcript and mission status. Muse Spark Open assesses fresh camera frames; Android validates each action, sends one bounded robot command over Bluetooth, stops and observes again. Evidence capture runs alongside this control loop.",
    output: "Persistent mission + camera-guided actions",
  },
  {
    title: "Capture and interpret",
    tech: "Pixel 10 · authenticated HTTPS · Muse Spark Open on Fireworks",
    body: "Android saves the original JPEG, capture time, mission and available fresh GPS, then uploads them to the cloud. Muse Spark Open returns visible facts, uncertainty, a city request type and concise report text. Images with no actionable finding stay in the observation feed.",
    output: "Stored photo + structured finding",
  },
  {
    title: "Locate and group the finding",
    tech: "City of Plano GIS · Muse Spark Open multi-image reasoning",
    body: "Photo GPS is matched to nearby roads and connected intersections. Muse Spark Open compares nearby candidate images before grouping views of one physical issue. The report keeps the estimated intersection, offset and uncertainty; reused GPS alone does not establish a duplicate.",
    output: "Estimated location + grouped evidence",
  },
  {
    title: "Highlight the problem area",
    tech: "SAM 3.1 · Meta Model API · Muse Spark Open quality check",
    body: "Muse Spark Open supplies a tight point and box around the finding. SAM segments that region, then a second Muse Spark Open pass checks that the overlay matches the defect. Android and the portal show the original photo with a SAM toggle. SAM highlights visible damage; it does not measure defect height.",
    output: "Original photo + verified SAM highlight",
  },
  {
    title: "Submit to Fix It Plano",
    tech: "Android WebView agent · official city form · submission reservation",
    body: "The phone opens the official city form, selects Curb Repair, enters the GPS location and report, checks map placement and attaches the original photo. Submit sends the form through the city’s reporting flow, including its anonymous option. A durable reservation prevents automatic duplicate sends.",
    output: "Submitted report + submission history",
  },
  {
    title: "Follow the case",
    tech: "Supabase Postgres and Storage · Next.js · Leaflet / OpenStreetMap",
    body: "The public portal refreshes observations and case posts with the report, location, original photo and SAM highlight. Submission history stays with the evidence, and a city reference is saved when returned. The original report remains traceable through its capture and submission records.",
    output: "Live case feed + evidence and submission history",
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
            <div className="hackathon-story">
            <article className="brief-block">
              <h2>What</h2>
              <p>
                Trippie is an AI agent running in an Android app on a phone mounted to a rugged toy robot. It uses the camera to see its surroundings, Muse Spark Open to interpret the scene and mission, and Bluetooth commands to drive the car.
              </p>
              <ul>
                <li><strong>See, reason, drive:</strong> the Android agent uses cloud-hosted Muse Spark Open to choose its next move, sends a bounded Bluetooth command, then observes again to navigate around obstacles.</li>
                <li><strong>Find and report:</strong> it captures hazards, highlights the issue with SAM, and fills and submits actual cases to Fix It Plano from the phone.</li>
                <li><strong>Follow along:</strong> the web portal shows observations, photos, SAM highlights and submitted cases.</li>
              </ul>
            </article>
            <article className="brief-block">
              <h2>Why</h2>
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
              <ul>
                <li>Plano spends about <strong>$38 million annually</strong> on street operations, maintenance and damage claims—costs Trippie aims to reduce.</li>
                <li>City-based projections estimate <strong>$3 million in annual savings</strong>, reaching <strong>$7 million</strong> under aggressive assumptions—over <strong>$50 million in eight years</strong>.</li>
                <li>Early detection pays: FHWA guidance puts avoided rehabilitation costs at <strong>$6–$10 for every $1</strong> spent preserving pavement.</li>
                <li>Plano’s sidewalk fixes cost about <strong>$55 to saw-cut a hazard</strong> versus <strong>$864 to replace a panel</strong>. Catching damage early keeps repairs smaller.</li>
                <li>Plano found <strong>AI road surveys 90% cheaper</strong> than manual inspection. Trippie brings AI inspection to sidewalks and residents’ phones.</li>
              </ul>
            </article>
            </div>
            <div className="hackathon-phone-demo">
              <video autoPlay muted loop playsInline preload="auto" aria-label="Trippie Android app demo" src="/videos/trippie-android-demo-60s.mp4">
                Your browser does not support video playback.
              </video>
            </div>
          </div>
          <div className="hackathon-process">
            <section className="brief-block process-steps">
              <h2>How it works, step by step</h2>
              <p className="brief-muted">
                Follow the mission-to-report workflow and the technology used at each step.
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
                Phone control, cloud reasoning, checked evidence, city reporting and public tracking.
              </p>
              <ArchitectureDiagram />
              <p className="diagram-note">
                Android owns Bluetooth execution and the city-form browser. Cloud services analyze evidence; Supabase stores it. The current submission adapter supports LIVE Curb Repair cases. Case posts bring the original evidence and submitted description together.
              </p>
            </section>
          </div>
          <div className="hackathon-bottom">
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
                  <strong>Technical execution · 20%</strong> Traceable model outputs, verified image migration, durable storage, duplicate-send protection and a public evidence portal.
                </li>
                <li>
                  <strong>Demo · 25%</strong> Follow one finding from camera capture
                  through model reasoning, SAM highlighting, and phone-owned city submission.
                </li>
              </ul>

            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
