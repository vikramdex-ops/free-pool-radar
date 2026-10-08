import { datasetPayload } from "@/lib/publicData";

export const revalidate = 300;

/**
 * GET /api/dataset — the entire public dataset in one document (CC0).
 *
 * The download that makes the project reusable: one request returns every
 * offer, provider, model and event, in the same shapes the endpoints use, so a
 * consumer does not have to stitch seven calls together. See DATASET.md.
 */
export async function GET() {
  return datasetPayload();
}
