"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin-db";

/**
 * Records a review decision on a discovery candidate (§52).
 *
 * All four of §52's actions go through here. The interesting work is not the
 * update — it is refusing to do one.
 *
 * A candidate row carrying no URL, or a merge with nothing to merge into, is
 * data that cannot be acted on and cannot be audited later. Worse, a rejected
 * candidate with no recorded reason reads exactly like one that was never
 * examined. So the form is validated here as well as in the function, and the
 * database is still the authority if this check is ever bypassed.
 */
export async function resolveCandidate(formData: FormData): Promise<void> {
  const client = adminClient();
  if (!client) return;

  const id = Number(formData.get("candidate_id"));
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const intoProvider = formData.get("into_provider_id");
  const intoOffer = formData.get("into_offer_id");

  if (!Number.isFinite(id)) return;
  if (!["verified", "rejected", "investigating", "merged"].includes(status)) return;

  // A decision with no reason is not a decision. Verified and rejected require
  // one; investigating does not, because "still looking" is a real answer.
  if ((status === "verified" || status === "rejected") && note === "") return;

  // A merge must name its destination, or it is a claim that something was
  // folded into the registry with no record of what.
  if (status === "merged") {
    const p = intoProvider ? Number(intoProvider) : null;
    const o = intoOffer ? Number(intoOffer) : null;
    if (p === null && o === null) return;
  }

  const { error } = await client.rpc("rpc_resolve_candidate", {
    p_candidate_id: id,
    p_status: status,
    p_note: note || null,
    p_into_provider:
      status === "merged" && intoProvider ? Number(intoProvider) : null,
    p_into_offer: status === "merged" && intoOffer ? Number(intoOffer) : null,
  });

  // A refusal is a normal outcome here, not a crash: the function rejects
  // transitions that contradict themselves. The page reloads either way and
  // shows the queue as it actually stands.
  if (error) {
    revalidatePath("/discovery");
    return;
  }

  revalidatePath("/discovery");
  revalidatePath("/admin");
}
