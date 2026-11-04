import { createHash } from "node:crypto";
import { get, assetBytes, workspace } from "@/server/store.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const asset = await get("asset", id);
    if (!asset || !asset.approved || !["image/jpeg", "image/png", "image/webp"].includes(asset.mime) || asset.generation !== (await workspace(asset.mode)).generation)
      return new Response("Not found", { status: 404 });
    const bytes = await assetBytes(asset);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
      return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": asset.mime, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin"
    } });
  } catch { return new Response("Not found", { status: 404 }); }
}
