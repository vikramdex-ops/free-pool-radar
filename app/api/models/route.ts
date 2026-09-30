import { getModels } from "@/lib/db";
import { envelope, readErrorResponse } from "@/lib/publicData";
import { iso } from "@/lib/format";

export const revalidate = 300;

/** GET /api/models — every model seen on a free route (§37). */
export async function GET() {
  const { data: models, error: modelsError } = await getModels();
  if (modelsError) return readErrorResponse("models");
  return envelope(
    models.map((m) => ({
      id: m.id,
      slug: m.slug,
      modelId: m.model_id,
      displayName: m.display_name,
      family: m.family,
      parameterCount: m.parameter_count,
      contextWindow: m.context_window,
      capabilities: m.capabilities,
      officialModelUrl: m.official_model_url,
      firstSeenAt: iso(m.first_seen_at),
    })),
    { count: models.length },
  );
}
