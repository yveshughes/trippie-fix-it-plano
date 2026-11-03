import type { Observation } from "@/lib/data";
import { list, put, workspace } from "@/server/store.mjs";
import { adminAuth, deviceAuth, authResponse } from "@/server/auth.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validObservations } from "@/lib/storage";
import { canReadLocalEvidence } from "@/lib/local-evidence";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get("mode") || "live";
    if (!["live", "demo"].includes(mode)) return Response.json({ error: "Invalid workspace" }, { status: 400 });
    if (mode === "demo" && !adminAuth(request)) return authResponse();
    const current = await workspace(mode);
    const stored = (await list("observation", mode)).filter((row: {generation: number}) => row.generation === current.generation).map((row: {observation: Observation}) => ({ ...row.observation, mode }));
    if (mode === "demo") return Response.json(stored, { headers: { "Cache-Control": "no-store", "X-Workspace-Generation": String(current.generation) } });
    const observations: unknown = JSON.parse(await readFile(path.join(process.cwd(), "data/patrols.json"), "utf8"));
    if (!(Array.isArray(observations) && (observations.length === 0 || validObservations(observations)))) throw new Error("Invalid observation data");
    let field: unknown = [];
    if (canReadLocalEvidence(request)) {
      try { field = JSON.parse(await readFile(path.join(process.cwd(), "private/pixel-analysis/feed.json"), "utf8")); }
      catch(error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (!(Array.isArray(field) && (field.length === 0 || validObservations(field)))) throw new Error("Invalid field data");
    }
    return Response.json([...(observations as Record<string, unknown>[]).map(row => ({...row, mode: "live"})), ...(field as Record<string, unknown>[]).map(row => ({...row, mode: "live"})), ...stored], { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Observation feed unavailable" }, { status: 503 });
  }
}

// Capture producers must freeze mode + generation at capture time, never at job completion.
export async function POST(request: Request) {
  if (!adminAuth(request) && !deviceAuth(request)) return authResponse();
  try {
    const { mode, generation, observation } = await request.json();
    if (!["live", "demo"].includes(mode) || !Number.isInteger(generation) || !validObservations([observation]))
      return Response.json({ error: "Valid observation, mode and generation required" }, { status: 400 });
    if ((await workspace(mode)).generation !== generation)
      return Response.json({ error: "Workspace was cleared; capture again" }, { status: 409 });
    await put("observation", { id: `${mode}:${observation.id}`, mode, generation, observation: {...observation, mode} });
    return Response.json({ saved: true, mode }, { status: 201 });
  } catch { return Response.json({ error: "Observation could not be saved" }, { status: 409 }); }
}
