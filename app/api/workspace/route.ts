import { adminAuth, authResponse } from "@/server/auth.mjs";
import { get, put, workspace, clearDemo } from "@/server/store.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const settings = await get("settings", "capture-mode");
    return Response.json({ canManage: adminAuth(request), mode: settings?.activeMode || "live", generation: (await workspace(settings?.activeMode || "live")).generation, demo: await workspace("demo") }, { headers });
  } catch { return Response.json({ error: "Workspace unavailable" }, { status: 503, headers }); }
}
export async function PATCH(request: Request) {
  if (!adminAuth(request)) return authResponse();
  try {
    const body = await request.json();
    if (!["live", "demo"].includes(body.mode)) return Response.json({ error: "Choose LIVE or DEMO" }, { status: 400 });
    await put("settings", { id: "capture-mode", mode: "live", generation: 0, activeMode: body.mode });
    return Response.json({ mode: body.mode, generation: (await workspace(body.mode)).generation, demo: await workspace("demo") }, { headers });
  } catch { return Response.json({ error: "Could not change workspace" }, { status: 503, headers }); }
}
export async function DELETE(request: Request) {
  if (!adminAuth(request)) return authResponse();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (body.mode !== "demo") return Response.json({ error: "Only DEMO data can be cleared" }, { status: 400 });
  try { return Response.json(await clearDemo(), { headers }); }
  catch { return Response.json({ error: "Could not clear demo data" }, { status: 503, headers }); }
}
