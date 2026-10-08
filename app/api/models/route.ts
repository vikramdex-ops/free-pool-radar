import { getModels } from "@/lib/db";
import { envelope, readErrorResponse, serialiseModel } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/models — every model seen on a free route (§37). */
export async function GET() {
  const { data: models, error: modelsError } = await getModels();
  if (modelsError) return readErrorResponse("models");
  return envelope(models.map(serialiseModel), { count: models.length });
}
