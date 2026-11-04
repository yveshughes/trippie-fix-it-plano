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

Open http://127.0.0.1:3015. The repository includes labeled sample observations. Real photos, model responses, city-form drafts, and credentials stay outside the public repository.

```sh
npm run typecheck
npm run build
npm test
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
| `GET /api/media/[id]` | Public, hash-verified approved image |
| `GET /api/evidence/[id]/[asset]` | Serve verified local original/SAM evidence |

New workspace records use SQLite in `private/runtime/trippie.sqlite` locally. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the adapter uses Supabase Postgres and a private evidence bucket. Apply `supabase/migrations/202611030001_trippie.sql` to provision them. The cloud adapter is verified against the connected Supabase project, including private storage access and row-level security.

The current real-photo feed also reads private JSON files; legacy browser observations use IndexedDB. Use `node scripts/migrate-to-supabase.mjs` for a dry run and add `--apply` to migrate imported observations, draft cases, original photos, reviewed SAM highlights, and SQLite workspace records. Migration retains a local SQLite/feed backup, uses insert-only records to preserve cloud edits, and validates originals, SAM highlights, supporting evidence, case attachments and uploaded image hashes. Migrated evidence uses public `/api/media/[id]` URLs for approved images, with source hashes and workspace-generation checks. The portal, evidence, and documentation can be viewed without signing in. The legacy `/api/evidence` file adapter remains localhost-only. Write and reset endpoints require server credentials (`trippie` / `TRIPPIE_ADMIN_PASSWORD` using HTTP Basic headers), or `TRIPPIE_DEVICE_TOKEN` for supported capture endpoints. They do not trigger browser sign-in dialogs. Visitors can switch LIVE/DEMO views locally; only authorized operators can change capture mode or clear DEMO. Use HTTPS for deployment. Keep every credential server-side.

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
