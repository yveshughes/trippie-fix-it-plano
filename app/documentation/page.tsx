import type { Metadata } from "next";
import AppHeader from "@/components/app-header";
import { reportingForms } from "@/lib/reporting-forms";
import "./docs.css";
export const metadata: Metadata = { title: "Trippie · Documentation" };
export default function Documentation() {
  return <div className="shell"><main className="docs-main"><AppHeader active="Documentation"/><section className="docs-content">
    <aside className="docs-sidebar"><div className="docs-title"><h1>Documentation</h1><p>Architecture, APIs, city reporting, and developer notes.</p></div>
      <nav className="docs-index" aria-label="Documentation sections"><a href="#stack">Technology stack</a><a href="#apis">APIs</a><a href="#photos">Photo workflow</a><a href="#forms">Case submission forms</a><a href="#agent">City submission agent</a><a href="#operators">Operator controls</a><a href="#developers">Developer notes</a></nav>
    </aside>
    <div className="docs-reading-pane" role="region" aria-label="Documentation content" tabIndex={0}>
      <section className="docs-block" id="stack"><h2>Technology stack</h2>
        <p>Trippie combines a native Android companion, cloud vision and reasoning, a Bluetooth robot, and a public web portal. Android owns camera capture, voice input, robot commands, and the official city-form browser. Provider credentials and model calls stay on the server.</p>
        <div className="docs-table-wrap"><table><thead><tr><th>Layer</th><th>Technology</th><th>Responsibility</th></tr></thead><tbody>
          <tr><td>Robot companion</td><td>Native Android / Java · CameraX · Android speech recognition</td><td>Animated face, voice transcripts, saved missions, rear-camera JPEGs, fresh GPS, progress and SAM toggle.</td></tr>
          <tr><td>Motion</td><td>Android Bluetooth LE / GATT · TTS Rugged Robot protocol</td><td>Connect, validate and serialize bounded motion commands, request onboard avoidance, stop and reobserve.</td></tr>
          <tr><td>Reasoning</td><td>Muse Spark Open · Fireworks</td><td>Interpret hazards, compare candidate evidence, route reports, write factual descriptions, select navigation actions and review masks.</td></tr>
          <tr><td>Segmentation</td><td>SAM 3.1 · Meta Model API · @meta-sam/parser</td><td>Turn point/box prompts into masks; decode and render the actual outline.</td></tr>
          <tr><td>Location</td><td>Pixel GPS · City of Plano GIS road geometry</td><td>Preserve capture coordinates and accuracy; estimate the nearest connected intersection and offset.</td></tr>
          <tr><td>City reporting</td><td>Android WebView · DOM form adapter</td><td>Operate the official Fix It Plano Curb Repair form, attach original evidence and submit through its reporting flow.</td></tr>
          <tr><td>Persistence</td><td>Supabase Postgres · private Supabase Storage</td><td>Observations, cases, jobs, submission reservations, event history and evidence assets. SQLite supplies the local fallback.</td></tr>
          <tr><td>Portal</td><td>Next.js 16 · React 19 · TypeScript · Vercel · Node 24</td><td>Public observation and case feeds, APIs, photo magnifier, presentation and documentation. Watch Intro and App Demo open video modals; the hackathon page also loops the silent phone demo.</td></tr>
          <tr><td>Map and diagrams</td><td>Leaflet · OpenStreetMap · Mermaid</td><td>The Pixel Trippie’s capture locations, observation pins and the architecture diagram.</td></tr>
        </tbody></table></div>
        <p>Production Android configuration uses <code>https://www.fixitplano.com</code> over HTTPS. The phone can upload and operate the city form away from the development laptop. USB and wireless debugging are development tools, not production dependencies.</p>
      </section>
      <section className="docs-block" id="apis"><h2>API details</h2>
        <h3>Workspaces and evidence</h3><p>LIVE holds real observations and reports. DEMO holds disposable practice data. The portal follows the configured workspace; the Live/DEMO toggle is hidden. Protected operator commands select the workspace for future captures. Each capture freezes its workspace and generation so clearing DEMO cannot bring back old queued photos.</p>
        <div className="docs-table-wrap"><table><thead><tr><th>Endpoint</th><th>Access</th><th>Behavior</th></tr></thead><tbody>
          <tr><td><code>GET /api/workspace</code></td><td>Public</td><td>Active capture mode, generation and DEMO generation.</td></tr>
          <tr><td><code>PATCH /api/workspace</code></td><td>Operator</td><td>Select LIVE or DEMO for capture producers.</td></tr>
          <tr><td><code>DELETE /api/workspace</code></td><td>Operator</td><td>Clear DEMO records and registered images; advance its generation.</td></tr>
          <tr><td><code>GET /api/patrols?mode=live</code></td><td>Public</td><td>Observation feed; use <code>mode=demo</code> for practice. No cache; portal refreshes every five seconds and shows the Pixel Trippie feed.</td></tr>
          <tr><td><code>POST /api/patrols</code></td><td>Operator or device</td><td>Save a validated observation with capture-time mode and generation.</td></tr>
          <tr><td><code>POST /api/captures</code></td><td>Operator or device</td><td>Multipart JPEG and JSON metadata; bounded upload, decoded image, SHA-256 and duplicate-ID checks; enqueue analysis.</td></tr>
          <tr><td><code>GET /api/media/[id]</code></td><td>Public</td><td>Serve an approved original or SAM image after checking workspace generation and stored hash.</td></tr>
        </tbody></table></div>
        <h3 id="capture-analysis">Analysis and navigation</h3><ul>
          <li><code>GET /api/analysis?mode=live</code> reads public queue counts. Adding <code>captureId</code> returns device-authenticated inspection progress, evidence and case state.</li>
          <li><code>POST /api/analysis</code> accepts an operator or device credential and queues processing for the selected workspace. Operators can add <code>retry: true</code> for failed jobs. Reading status does not start inference.</li>
          <li><code>POST /api/navigation</code> accepts an authenticated camera frame and mission. Muse Spark Open returns a structured action and explanation; Android validates and executes the immediate action over BLE.</li>
        </ul>
        <h3>Device request format</h3>
        <p>Device requests send <code>Authorization: Bearer &lt;device-token&gt;</code>. Operator requests use HTTP Basic authentication with username <code>trippie</code> and the server’s admin password. Neither credential belongs in browser code or the repository.</p>
        <ul>
          <li><strong>Capture:</strong> send multipart fields <code>photo</code> (JPEG) and <code>metadata</code> (JSON). The entire request is limited to 4 MiB; decoded images are limited to 25 megapixels and metadata to 16,000 characters.</li>
          <li><strong>Metadata:</strong> provide <code>id</code> (UUID), <code>requestedAt</code> (timestamp), <code>mode</code> and the current workspace <code>generation</code>. Optional fields are <code>mission</code> (goal and patrol/navigate mode), <code>purpose</code> (inspection or obstacle-practice), <code>targetHint</code> and <code>location</code> (latitude, longitude, accuracyMeters and ageAtRequestMs). Obstacle practice requires DEMO.</li>
          <li><strong>Navigation:</strong> send raw JPEG bytes with the device credential, <code>x-trippie-frame-id</code> (UUID), <code>x-trippie-goal</code> (URL-encoded mission text) and <code>x-trippie-mission-mode</code> (patrol or navigate). The response echoes the frame ID and contains a validated action, explanation and local plan. It does not drive the robot from the server.</li>
          <li><strong>Responses:</strong> capture returns 201 for new evidence or 200 for an identical retry; 409 rejects a cleared generation or conflicting capture ID, and 413 rejects oversized uploads. Unauthorized requests return 401. A failed navigation assessment returns 503 with a stop decision.</li>
        </ul>
        <h3>Submission commands</h3><p><code>POST /api/submissions</code> accepts an operator or device credential and a stable command identity:</p>
        <pre>{`{
  "mode": "live",
  "captureId": "capture-uuid",
  "attemptId": "stable-attempt-uuid",
  "action": "prepare | dispatch | confirm"
}`}</pre>
        <ul><li><code>prepare</code> loads the latest analyzed LIVE Curb Repair payload and original-image hash.</li><li><code>dispatch</code> atomically reserves one send. Android then submits the official city form; this endpoint does not post directly to a city REST API.</li><li><code>confirm</code> additionally requires <code>receipt</code>, <code>url</code> and <code>evidence</code>. It records the numeric city-issued reference (4–20 digits), HTTPS tracking URL on iframe.publicstuff.com and visible confirmation evidence containing that reference (up to 16,000 characters).</li></ul>
        <p>Submission records are separate from city references. The dispatch reservation records a send attempt separately from the case’s workflow status. <strong>Submitted</strong> is a stored case status; a city reference is saved only from the city’s response and is never synthesized. Received, In Progress and Completed are recorded only from supporting city information. An uncertain response retains its reservation for reconciliation, rather than automatically sending another request.</p>
        <h3>City API research</h3><p>Accela/PublicStuff publishes a REST API, but Trippie’s implemented reporting transport is the official city form inside Android. The form owns request-type IDs, custom-field handling and its vendor API calls. The adapter uses visible DOM controls rather than Angular private state or guessed city API IDs.</p>
        <p className="docs-source">Reference: <a href="https://api.publicstuff.com/apidocs" target="_blank" rel="noreferrer">Accela/PublicStuff API documentation</a>. Vendor integration credentials are separate from Trippie’s device and model credentials.</p>
      </section>
      <section className="docs-block" id="photos"><h2>Photo-to-report workflow</h2><ol>
        <li><strong>Capture.</strong> CameraX saves the original JPEG and JSON metadata in Android app-private storage. The record includes capture ID, time, mission, purpose, workspace and available GPS accuracy and freshness. Upload accepts a GPS fix only when its reported age at capture is at most 30 seconds; missing GPS remains unknown. Orientation is phone orientation, not a sidewalk slope measurement.</li>
        <li><strong>Upload.</strong> Android shows byte-based upload progress, sends the photo over authenticated HTTPS and records the portal acknowledgement. Unsent photos stay on the phone for retry; repeated capture IDs reuse the existing observation.</li>
        <li><strong>Interpret.</strong> Muse Spark Open on Fireworks identifies visible maintenance concerns, facts and uncertainty, selects an audited city form and writes a concise description. Indoor practice follows its own object-localization path. No issue is a valid observation outcome.</li>
        <li><strong>Locate and group.</strong> Use photo GPS with City of Plano road geometry to estimate an intersection and offset. Muse Spark Open compares nearby candidate images before merging evidence for the same physical defect. Matching coordinates alone do not establish a duplicate.</li>
        <li><strong>Segment and verify.</strong> Normalize the image orientation and send the localized point/box to Meta <code>sam-3.1</code>. Check that the decoded mask contains the target point, then ask Muse Spark Open whether the overlay matches the finding. Publish the highlight only after that check.</li>
        <li><strong>Prepare and submit.</strong> Assemble the city request type, location, factual description and original photo. Android opens the official city form, verifies the populated fields and map placement, attaches the original and sends the request through the city’s submission flow.</li>
        <li><strong>Publish and track.</strong> Supabase keeps evidence, model provenance and submission history together. The portal shows the map, live observation list, submitted case post, original/SAM toggle and magnifier. Save the city reference when the city supplies one.</li>
      </ol>
      <p><strong>Progress:</strong> Android sync runs every 12 seconds while the main screen is active; an open inspection refreshes its own status every two seconds. The city-form agent checks progress approximately every 1.2 seconds. These are observed workflow stages, not a simulated completion timer.</p>
      <p><strong>Batch intake:</strong> <code>npm run process:photos</code> analyzes imported Pixel photos, resolves locations, groups evidence and publishes reports for review. The Android capture and city-submission flow uses the API endpoints above. Batch import does not itself send city requests.</p>
      <p><strong>Evidence:</strong> originals are retained, with SHA-256 checks for storage and city attachments. Model input is normalized and re-encoded without EXIF. Capture GPS remains in structured metadata. The historical crop/grid experiment in <code>scripts/localize-edge-grid.mjs</code> is separate from the runtime point/box segmentation path.</p>
      </section>
      <section className="docs-block" id="forms"><h2>Case submission forms</h2><p>The inspection settings below map to audited city reporting screens and routing instructions. Automatic report preparation supports Curb Repair, Pothole Report, Sidewalk Repair Request, ADA Access Issues and Tree/Shrub Issue when their required evidence is available. The Android submission adapter currently implements <strong>LIVE Curb Repair</strong>. Other targets retain their audited routing and field requirements.</p>
        <div className="docs-table-wrap"><table><thead><tr><th>Inspection target</th><th>City form / route</th><th>Required fields</th><th>Rules and extra context</th></tr></thead><tbody>{reportingForms.map(([target,form,required,notes]) => <tr key={target}><th scope="row">{target}</th><td>{form}</td><td>{required}</td><td>{notes}</td></tr>)}</tbody></table></div>
        <p><strong>Curb Repair:</strong> the agent fills Address, Location (R) and Description, verifies the map center moved near the capture GPS and attaches the original JPEG. Direction of Travel is optional. The city offers account creation and a skip link for anonymous reporting; the agent follows the anonymous option when available.</p>
        <p><strong>Utility covers:</strong> Water Meter Boxes/Lids requires address, Meter Box Issue (METER BOX or METER LID), and description. A valve cover is not automatically a water-meter lid. Resolve asset type and ownership before selecting that route.</p>
        <p className="docs-source">Source: Plano’s public Accela CRM screens, client 162, reviewed November 3–4, 2026. Raw form labels and dropdown choices are preserved in <code>research/fixit-plano-forms.json</code> and <code>research/water-meter-lids-form.txt</code>.</p>
      </section>
      <section className="docs-block" id="agent"><h2>City submission agent</h2><p><strong>The agent runs in the Android app and submits the case from the phone.</strong> Muse Spark Open prepares the structured finding and report; a deterministic DOM adapter operates the official Fix It Plano form in an Android WebView. The development laptop is not the runtime form operator.</p><ol>
        <li><strong>Load verified evidence.</strong> Require the latest completed analysis, a supported LIVE case and the matching original-image hash.</li>
        <li><strong>Fill and check.</strong> Select the actual city category and Curb Repair form. Enter GPS, Location (R) and the report; trigger address lookup and check visible map placement.</li>
        <li><strong>Attach the original.</strong> Verify the phone’s JPEG hash against the analyzed source, then attach that file to the city form. SAM remains an inspection view in Trippie.</li>
        <li><strong>Reserve and send.</strong> A stable attempt ID and atomic dispatch reservation prevent a second automatic send. The native Submit control authorizes the form action; the adapter handles the city’s anonymous reporting option.</li>
        <li><strong>Record the result.</strong> Keep the submitted report and dispatch history. When the city displays its confirmation, capture its actual reference and tracking URL and save them through the authenticated endpoint.</li>
      </ol><p><strong>Recovery:</strong> the phone saves a received city reference locally before synchronizing it. Reopening retries receipt synchronization. A dispatched attempt with no resolved outcome is reconciled before another send. DEMO and indoor obstacle practice never send city requests.</p></section>
      <section className="docs-block" id="operators"><h2>Operator controls</h2><p>The portal is public. Protected management commands use <code>TRIPPIE_ADMIN_PASSWORD</code> from the server environment, targeting <code>https://www.fixitplano.com</code> by default. Set <code>TRIPPIE_PORTAL_URL</code> for another HTTPS origin or local loopback development.</p><pre>{`npm run operator -- status
npm run operator -- mode demo
npm run operator -- mode live
npm run operator -- clear-demo --confirm
npm run verify:cloud`}</pre>
        <p>Changing capture mode affects future captures. Clear DEMO removes its records and registered images, preserves LIVE and advances its generation. It does not cancel or delete a request already sent to the city. The explicit confirmation flag is required for the cleanup command.</p>
        <p><strong>Access:</strong> supported device endpoints use <code>TRIPPIE_DEVICE_TOKEN</code>. Model and Supabase service credentials stay server-side. Approved images are served by the portal; the storage bucket remains private. Both workspaces are publicly viewable, so use appropriate demonstration evidence.</p>
        <p><strong>Cloud verification:</strong> <code>npm run verify:cloud</code> checks migrated observation references, original and SAM assets, supporting photos, case attachments and image hashes without running inference or uploading data.</p>
      </section>
      <section className="docs-block" id="developers"><h2>Developer notes</h2><div className="docs-note-grid">
        <article><h3>Phone setup</h3><p>Build with JDK 21, the Gradle wrapper and Android SDK 35. The app targets SDK 35 and supports API 30+. CameraX uses the rear camera. Android speech recognition supplies partial transcripts and saved missions; model inference runs in the cloud.</p><p><code>node scripts/configure-android.mjs --production</code> configures an installed debug build over an authorized ADB connection, writing the production HTTPS endpoint and device token into app-private storage. Restart the app after configuration; ADB is not required for subsequent networking. The development command without that flag uses loopback and ADB reverse.</p></article>
        <article><h3>Robot control</h3><p>Android sends fresh frames and the mission to <code>/api/navigation</code>. Muse Spark Open returns a bounded next action and local route estimate; Android validates the result and serializes BLE writes. It requests onboard avoidance, executes one native step, stops and takes another view. Voice Stop/Pause, backgrounding and stale or rejected decisions halt continuation.</p><p>The robot connection and physical Stop are distinct from cloud planning. The ten-minute foreground trip bound and one-step execution limit constrain a prototype control loop; a route estimate is not measured distance or an assurance of clearance.</p></article>
        <article><h3>Durable processing</h3><p>Capture uploads queue analysis through Next.js <code>after()</code>. Postgres RPCs enforce worker lease ownership and workspace generation when publishing results or retrying jobs. Completed assessments are reused. Uploads and foreground phone sync continue queue work after interruptions; a dedicated always-on scheduler is a separate deployment concern.</p><p>Provider IDs, model/version, timestamps, source hashes and review decisions stay associated with evidence. Raw provider responses and local source paths are excluded from the public feed.</p></article>
        <article><h3>Runtime and UI</h3><p>Use Node 24.x, matching <code>.nvmrc</code> and <code>package.json</code>. SQLite is the local fallback; production uses Supabase. <code>npm run dev</code> serves port 3015; <code>npm run typecheck</code>, <code>npm test</code> and <code>npm run build</code> validate changes.</p><p>Routes: portal <code>/</code>, presentation <code>/hackathon</code>, documentation <code>/documentation</code>. The portal focuses on the single Pixel Trippie device; stable capture and case IDs prevent duplicate cards. Preserve Leaflet/OpenStreetMap attribution and label sample evidence.</p></article>
      </div></section>
    </div>
  </section></main></div>;
}
