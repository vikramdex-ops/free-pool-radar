import { getProviders } from "@/lib/db";
import { envelope, readErrorResponse, serialiseProvider } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/providers — the provider registry (§37). */
export async function GET() {
  const { data: providers, error: providersError } = await getProviders();
  if (providersError) return readErrorResponse("providers");
  return envelope(providers.map(serialiseProvider), { count: providers.length });
}
