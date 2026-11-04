# Trippie

Trippie turns a Rugged Robot and an Android phone into a neighborhood inspection prototype. The admin portal brings together a street map, captured photos, SAM highlights, and city case descriptions.

## Run locally

Uses Node.js 24.x locally, in GitHub Actions, and on Vercel. `.nvmrc` and `package.json` select the same major version; runtime checks verify built-in SQLite before install, development and build.

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3015. The repository includes labeled sample observations. Real photos, model responses, city report records, and credentials stay outside the public repository.

```sh
npm run typecheck
npm run build
npm test
node scripts/check-sam-prompt.mjs
node scripts/check-map-location.mjs
```

## What is implemented

- Next.js 16, React 19 and TypeScript admin portal, with shared navigation, a hackathon presentation and documentation.
- Leaflet/OpenStreetMap map focused on the Pixel Trippie, observation search, and a scrollable case feed.
- Original/SAM comparison and a photo modal with a 2–5× magnifier.
- LIVE/DEMO workspaces. Existing observations default to LIVE. Clear DEMO removes its records and registered assets while preserving LIVE; generation checks reject late writes after a reset.
- A local imported-photo workflow using Muse Spark Open on Fireworks, SAM 3.1 through Meta Model API, and City of Plano GIS for estimated street/intersection locations.
- Evidence signatures and review checks that prevent publication of stale or unapproved SAM masks.
- Native Android capture, voice missions, camera-guided Bluetooth commands, and production HTTPS sync.
- City-form research covering the inspection settings, with an Android WebView agent that fills, verifies and submits LIVE Curb Repair reports through the official city form.
- Atomic dispatch reservations, submission history, and durable city-reference synchronization.

The November 3 imported-photo trial analyzed 15 JPEGs, grouped evidence into two report payloads and retained three reviewed SAM highlights. The Android workflow adds phone-owned capture and city-form submission. Real photos, locations, model responses and submission records remain outside the public repository.

## APIs and persistence

| Endpoint | Purpose |
| --- | --- |
| `GET /api/patrols?mode=live` | Observation feed; use `mode=demo` for test records |
| `POST /api/captures` | Device-authenticated JPEG + metadata ingestion, with workspace fencing and duplicate protection |
| `POST /api/patrols` | Save a validated observation with its capture-time mode and generation |
| `GET /api/workspace` | Read active mode and generation |
| `PATCH /api/workspace` | Select LIVE or DEMO |
| `DELETE /api/workspace` | Clear DEMO only |
| `GET /api/analysis?mode=demo` | Read analysis counts without triggering inference |
| `POST /api/analysis` | Authenticated queue processing; operators may request failed-job retry |
| `POST /api/navigation` | Authenticated camera/mission assessment; Android validates the response and executes BLE commands |
| `POST /api/submissions` | Prepare a LIVE Curb Repair payload, reserve one dispatch, or record a city confirmation |
| `GET /api/media/[id]` | Public, hash-verified approved image |
| `GET /api/evidence/[id]/[asset]` | Serve verified local original/SAM evidence |

Without Supabase credentials, workspace records use SQLite in `private/runtime/trippie.sqlite` locally. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the adapter uses Supabase Postgres and a private evidence bucket. Apply all SQL files in `supabase/migrations/` to provision storage, records and analysis leases. The cloud adapter is verified against the connected Supabase project, including private storage access and row-level security.

The local adapter can also read an imported private JSON feed; legacy browser observations use IndexedDB. Use `node scripts/migrate-to-supabase.mjs` for a dry run and add `--apply` to migrate imported observations, case records, original photos, reviewed SAM highlights, and SQLite workspace records. Migration retains a local SQLite/feed backup, uses insert-only records to preserve cloud edits, and validates originals, SAM highlights, supporting evidence, case attachments and uploaded image hashes. Migrated evidence uses public `/api/media/[id]` URLs for approved images, with source hashes and workspace-generation checks. The portal, evidence, and documentation can be viewed without signing in. The legacy `/api/evidence` file adapter remains localhost-only. Write and reset endpoints require server credentials (`trippie` / `TRIPPIE_ADMIN_PASSWORD` using HTTP Basic headers), or `TRIPPIE_DEVICE_TOKEN` for supported capture, analysis, navigation and submission endpoints. They do not trigger browser sign-in dialogs. Visitors can switch LIVE/DEMO views locally; only authorized operators can change capture mode or clear DEMO. Use HTTPS for deployment. Keep model, administrator and Supabase service credentials server-side; only the scoped device token is configured on Android.

## Model and photo workflow

Configure `FIREWORKS_API_KEY` for Muse Spark Open and `MODEL_API_KEY` for Meta SAM. Billing and credits belong to the corresponding provider account; changing a key does not migrate credits between providers.

```sh
npm run process:photos
# Reuse existing model results without paid inference:
npm run process:photos -- --reuse-models
```

The local batch scripts currently use `private/pixel-2026-11-03` for imported captures and `private/pixel-analysis` for analysis. They analyze, resolve locations, group views, segment findings, and publish the private LIVE feed. They do not change the configured capture workspace; authenticated capture producers must read `/api/workspace` and freeze mode/generation before saving new test observations.

SAM is a segmentation tool, not a measurement of defect height. The edge-localization experiment in `scripts/localize-edge-grid.mjs` uses a photo-specific crop and target; applying that approach automatically to new captures requires integration and validation. Publication requires review of the exact segmentation request and image hash.

## City reporting and robot integration

`lib/reporting-forms.ts` maps inspection targets to audited city form requirements. Raw research is retained in `research/`. Muse Spark Open prepares factual report fields; the Android app operates the official Fix It Plano form in `CitySubmissionActivity` using `city-agent.js`. The current send adapter supports **LIVE Curb Repair**. Other eligible forms have structured report preparation and audited routing; they do not automatically use the Curb Repair adapter.

The phone selects the city form, enters GPS and Location (R), triggers address lookup, checks visible map placement, verifies the original photo hash and attaches that JPEG. The native Submit action reserves one dispatch before the DOM adapter sends the official form and follows the city's anonymous reporting option. The reporting transport is the city's form; Trippie does not directly post to the researched vendor REST API.

The dispatch reservation records the send attempt; **Submitted** is stored separately as the case’s workflow status. City references are optional and stored only when returned. Received, In Progress and Completed require supporting city information; no automatic city-status polling is implemented. The submission reservation remains after an unresolved response, preventing an automatic resend. The phone writes a returned reference locally before cloud synchronization and retries that synchronization on reopening.

Android provides the animated face, CameraX capture, fresh GPS metadata, phone orientation, optional interval capture, voice transcripts and saved missions. Captures freeze LIVE/DEMO identity and upload to production over HTTPS using `node scripts/configure-android.mjs --production`; no development laptop or USB forwarding is required for that configuration. Model calls run server-side: Muse Spark Open on Fireworks, SAM 3.1 on the Meta Model API, and Plano GIS road lookup. The phone displays actual processing stages and an original/SAM toggle.

Camera-guided driving is a separate loop: a fresh frame and mission go to `/api/navigation`, Muse Spark Open recommends a bounded action, Android validates it and sends one serialized BLE command, then stops and reobserves. It requests onboard obstacle avoidance. This is prototype control with physical-stop and fresh-view checks, not a demonstrated autonomous outdoor patrol. See [Android setup](android/README.md) for control limits and hardware checks.

## Source layout

- `app/`, `components/`, `lib/`: portal, presentation, documentation and form mappings.
- `server/`, `supabase/`: workspace authentication, persistence, storage and schema.
- `scripts/`: local photo analysis, GIS resolution, grouping, segmentation and publication.
- `tests/`: workspace isolation and reset regressions.
- `public/`: robot SVG and labeled sample illustration.

OpenStreetMap attribution stays visible. The prototype uses the standard OSM tile service without prefetching; select a suitable tile provider for production usage under its usage policy.

The dismissible banner across the app states: “This is not affiliated with the City of Plano (but we can hope).” Its dismissal lasts for the browser tab session.

## Operator commands

Public browsing has no sign-in. Operator commands use `TRIPPIE_ADMIN_PASSWORD` from `.env.local` and target `https://www.fixitplano.com`. Set `TRIPPIE_PORTAL_URL` to another HTTPS origin or HTTP loopback for development. Credentials are not printed or passed as command arguments.

```sh
npm run operator -- status
npm run operator -- mode demo
npm run operator -- mode live
npm run operator -- clear-demo --confirm
npm run verify:cloud
```

`mode` changes the capture workspace; visitors only change their own view. `clear-demo` deletes DEMO records and registered assets, preserves LIVE, and requires `--confirm`. It never retries automatically. Both workspaces expose approved evidence, location and model provenance publicly; raw provider responses and local source paths stay out of the public feed.

`verify:cloud` is read-only: it checks all migrated original/SAM/supporting references and case-photo attachments against approved workspace assets, then downloads referenced images to verify their hashes. It requires the local imported feed plus server-side Supabase credentials. An inaccessible network or missing input fails the check explicitly.

## Android analysis jobs

`POST /api/captures` saves the original and queues a job. Next.js `after()` starts bounded processing; foreground Android sync continues the queue every 12 seconds. Jobs and model assessments are durable in the selected database. Completed jobs are reused. Provider failures require an authorized retry; saved assessment checkpoints avoid repeating completed model steps. This setup relies on new uploads or foreground phone sync to continue a queue after a server interruption; an always-on worker/scheduler is a separate deployment step.

Apply all SQL migrations in `supabase/migrations/` for cloud operation. Analysis publication and retries use conditional database transactions/RPCs checking worker token, lease expiry and workspace generation. Clearing DEMO cannot be undone by a late worker.

Automatic report preparation supports Curb Repair, Pothole Report, Sidewalk Repair Request, ADA Access Issues and Tree/Shrub Issue. A mapped location, factual description and resolved required fields are needed. Other findings retain routing/follow-up status. Nearby evidence is merged only when Muse Spark Open sees matching landmarks in supplied candidate images; uncertain or inaccurate GPS does not establish a match. SAM masks are published only after target-point containment and a positive semantic review. This is model quality checking, not physical hazard measurement or city acceptance.

Indoor/screen images can complete as `no_issue` without generating cases. A real outdoor curb capture exercised Muse Spark Open interpretation, GIS lookup, verified SAM highlighting and the Android form adapter. Regression checks cover capture metadata, analysis publication, routing, mask decisions, one-shot dispatch and recognition of the city’s actual confirmation modal. Submission diagnostics and reconciliation history remain in private records.
