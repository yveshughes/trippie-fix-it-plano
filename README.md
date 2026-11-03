# Trippie

Trippie turns a Rugged Robot and an Android phone into a neighborhood inspection prototype. The admin portal brings together a street map, captured photos, SAM highlights, and city case descriptions.

## Run locally

Requires Node.js 22.13 or newer, with `node:sqlite` available.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3015. The repository includes labeled sample observations. Real photos, model responses, city-form drafts, and credentials stay outside the public repository.

```sh
npm run typecheck
npm run build
node --test tests/workspace.test.mjs
node scripts/check-sam-prompt.mjs
node scripts/check-map-location.mjs
```

## What is implemented

- Next.js 16, React 19 and TypeScript admin portal, with shared navigation, a hackathon presentation and documentation.
- Leaflet/OpenStreetMap map, fleet selection, observation search, and a scrollable case feed.
- Original/SAM comparison and a photo modal with a 2–5× magnifier.
- LIVE/DEMO workspaces. Existing observations default to LIVE. Clear DEMO removes its records and registered assets while preserving LIVE; generation checks reject late writes after a reset.
- A local imported-photo workflow using Muse Spark Open on Fireworks, SAM 3.1 through Meta Model API, and City of Plano GIS for estimated street/intersection locations.
- Evidence signatures and review checks that prevent publication of stale or unapproved SAM masks.
- City-form research covering all 17 inspection targets, plus prepared report descriptions and original-photo attachments.

The local Pixel trial analyzed 15 JPEGs and grouped them into two draft cases. Three reviewed SAM highlights are available in the private workspace. City forms were filled for inspection; final Submit was not pressed. These private results are not bundled with the source.

## APIs and persistence

| Endpoint | Purpose |
| --- | --- |
| `GET /api/patrols?mode=live` | Observation feed; use `mode=demo` for test records |
| `POST /api/patrols` | Save a validated observation with its capture-time mode and generation |
| `GET /api/workspace` | Read active mode and generation |
| `PATCH /api/workspace` | Select LIVE or DEMO |
| `DELETE /api/workspace` | Clear DEMO only |
| `GET /api/evidence/[id]/[asset]` | Serve verified local original/SAM evidence |

New workspace records use SQLite in `private/runtime/trippie.sqlite` locally. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the adapter uses Supabase Postgres and a private evidence bucket. Apply `supabase/migrations/202611030001_trippie.sql` to provision them. The cloud adapter has not been tested against a provisioned project.

The current real-photo feed also reads private JSON files; legacy browser observations use IndexedDB. Those existing files and images need migration before a deployed portal can display the local Pixel evidence. Evidence endpoints currently enforce localhost access. Cloud workspace administration uses HTTP Basic authentication with username `trippie` and `TRIPPIE_ADMIN_PASSWORD`; capture producers use `TRIPPIE_DEVICE_TOKEN` as a bearer token. Use HTTPS for deployment. Keep every credential server-side.

## Model and photo workflow

Configure `FIREWORKS_API_KEY` for Muse Spark Open and `MODEL_API_KEY` for Meta SAM. Billing and credits belong to the corresponding provider account; changing a key does not migrate credits between providers.

```sh
npm run process:photos
# Reuse existing model results without paid inference:
npm run process:photos -- --reuse-models
```

The local batch scripts currently use `private/pixel-2026-11-03` for imported captures and `private/pixel-analysis` for analysis. They analyze, resolve locations, group views, segment findings, and publish the private LIVE feed. They do not use the portal's DEMO toggle; authenticated capture producers must read `/api/workspace` and freeze mode/generation before saving new test observations.

SAM is a segmentation tool, not a measurement of defect height. The edge-localization experiment in `scripts/localize-edge-grid.mjs` uses a photo-specific crop and target; applying that approach automatically to new captures requires integration and validation. Publication requires review of the exact segmentation request and image hash.

## City reporting and robot integration

`lib/reporting-forms.ts` maps inspection targets to observed city form requirements. Public form snapshots are in `research/`. Report posts show the request type, location, description, original and SAM comparison, plus Trippie's High/Medium/Low estimate and public workflow labels. No city status synchronization or submission endpoint is implemented.

Android camera/GPS ingestion, a product-owned reporting agent, and autonomous Bluetooth navigation remain implementation work. The hardware baseline was a replacement Rugged Robot travelling five forward steps straight through its official app, in Mode 2 with avoidance off. That test does not validate autonomous navigation. The `android/` directory has no application source yet.

## Source layout

- `app/`, `components/`, `lib/`: portal, presentation, documentation and form mappings.
- `server/`, `supabase/`: workspace authentication, persistence, storage and schema.
- `scripts/`: local photo analysis, GIS resolution, grouping, segmentation and publication.
- `tests/`: workspace isolation and reset regressions.
- `public/`: robot SVG and labeled sample illustration.

OpenStreetMap attribution stays visible. The prototype uses the standard OSM tile service without prefetching; select a suitable tile provider for production usage under its usage policy.
