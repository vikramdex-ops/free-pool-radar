import { datasetPayload } from "@/lib/publicData";

export const revalidate = 300;

/**
 * GET /data/latest.json — the combined latest snapshot, identical to
 * /api/dataset. Both call the same builder, so the two URLs cannot disagree.
 */
export async function GET() {
  return datasetPayload();
}
