import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canReadLocalEvidence } from "@/lib/local-evidence";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string; asset: string }> }) {
  if (!canReadLocalEvidence(request)) return new Response("Not found", { status: 404 });
  const { id, asset } = await params;
  if (!/^[a-f0-9]{16}$/.test(id) || !["original", "sam"].includes(asset)) return new Response("Not found", { status: 404 });
  try {
    const file = asset === "original" ? "original-view.jpg" : "sam-highlight.jpg";
    const image = await readFile(path.join(process.cwd(), "private/pixel-analysis", id, file));
    if (asset === "sam") {
      const folder = path.join(process.cwd(), "private/pixel-analysis", id);
      const [segmentationText, reviewText] = await Promise.all([readFile(path.join(folder, "segmentation.json"), "utf8"), readFile(path.join(folder, "segmentation-review.json"), "utf8")]);
      const segmentation = JSON.parse(segmentationText), review = JSON.parse(reviewText);
      const revision = new URL(request.url).searchParams.get("rev");
      const hash = createHash("sha256").update(image).digest("hex");
      if (!revision || revision !== segmentation.requestId || revision !== review.requestId || review.status !== "approved" || review.imageSha256 !== hash) return new Response("Not found", { status: 404 });
    }
    return new Response(image, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
