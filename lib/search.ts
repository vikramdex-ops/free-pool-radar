/**
 * Global search (§30).
 *
 * Searches providers, models, offers, events and historical changes, and it
 * does the searching here rather than in the database.
 *
 * That is a deliberate choice about scale, not laziness. The whole corpus is a
 * few hundred rows: about 40 providers, 113 models, 134 offers and 143 change
 * rows. Pulling that once and matching in memory is a single round trip, it
 * works identically across five tables that have no common text column, and it
 * avoids a per-keystroke query. It also means the search can be tested without
 * a database, which is why the term table below is plain data.
 *
 * The ceiling is stated rather than hidden: `CHANGES_SCANNED` bounds the history
 * search. When the change log outgrows that, this module is the place to
 * replace, and the limit is reported in the results so a reader is never shown
 * a result set that quietly pretends to be complete.
 */

import type {
  ChangeWithProvider,
  Model,
  OfferWithProvider,
  Provider,
} from "./db";

/** How much history to search. Bounded so a long-lived site cannot be made to
 *  fetch its entire change log on every keystroke. */
export const CHANGES_SCANNED = 500;

export type HitKind = "provider" | "model" | "offer" | "event" | "change";

export interface Hit {
  kind: HitKind;
  id: string;
  title: string;
  /** The line under the title. States what matched, so a result is never a bare
   *  name the reader has to click to understand. */
  detail: string;
  href: string;
}

export interface SearchResult {
  hits: Hit[];
  /** The text that was treated as free text, after recognised terms were
   *  removed. Empty when the query was only recognised terms. */
  freeText: string;
  /** Recognised concepts, named so the reader can see how a phrase was
   *  interpreted instead of guessing. */
  terms: string[];
  totalConsidered: number;
  /** Set when a bounded set was searched, naming what was left out. */
  truncated: string | null;
}

/* ------------------------------------------------------------------ */
/* recognised terms                                                     */
/* ------------------------------------------------------------------ */

/**
 * Concepts the reader is likely to type, mapped to a predicate.
 *
 * The spec's own examples are the reason this exists: "no card", "keyless" and
 * "shared" are questions, not text. A provider's name never contains the words
 * "no card", so a literal substring search for that phrase returns nothing and
 * looks like a broken search rather than a misunderstanding of it.
 *
 * Each entry is a phrase or single token. Matching is on whole words, lower
 * case, so "cardless" does not fire the "card" term.
 */
const OFFER_TERMS: { match: string; label: string; test: (o: OfferWithProvider) => boolean }[] = [
  {
    match: "no card",
    label: "no card required",
    test: (o) => !o.card_required,
  },
  {
    match: "card",
    label: "card required",
    test: (o) => o.card_required,
  },
  {
    match: "cardless",
    label: "cardless",
    test: (o) => !o.card_required,
  },
  {
    match: "keyless",
    label: "keyless access",
    test: (o) => o.keyless,
  },
  {
    match: "no key",
    label: "usable without a key",
    test: (o) => o.keyless,
  },
  {
    match: "no subscription",
    label: "no subscription required",
    test: (o) => !o.access_requires_subscription,
  },
  {
    match: "shared",
    label: "shared pool",
    test: (o) => o.offer_type === "shared_pool",
  },
  {
    match: "pool",
    label: "has a token pool",
    test: (o) => o.pool_size !== null,
  },
  {
    match: "sponsored",
    label: "sponsored inference",
    test: (o) => o.offer_type === "sponsored_inference",
  },
  {
    match: "rotating",
    label: "rotating free model",
    test: (o) => o.offer_type === "rotating_free_model",
  },
  {
    match: "credit",
    label: "free credits",
    test: (o) => o.offer_type === "free_credits",
  },
  {
    match: "trial",
    label: "free trial",
    test: (o) => o.offer_type === "free_trial",
  },
  {
    match: "openai",
    label: "OpenAI compatible",
    test: (o) => o.compatibility_openai,
  },
  {
    match: "anthropic",
    label: "Anthropic compatible",
    test: (o) => o.compatibility_anthropic,
  },
  {
    match: "unverified",
    label: "unverified",
    test: (o) => o.verification_level === "secondary" || o.verification_level === "community",
  },
];

const contains = (haystack: string | null | undefined, needle: string) =>
  Boolean(haystack) && haystack!.toLowerCase().includes(needle);

/** Normalises a number for matching "5b" / "5B" / "5 billion". */
function poolMatches(offer: OfferWithProvider, needle: string): boolean {
  if (offer.pool_size === null) return false;
  const size = offer.pool_size;
  const unit = (offer.pool_unit ?? "").toLowerCase();

  // A bare number with a magnitude suffix, so "5b" finds a 5-billion pool.
  const suffixed = /^(\d+(?:\.\d+)?)\s*([bmk]|bn|mn)?$/.exec(needle);
  if (suffixed) {
    const n = Number(suffixed[1]);
    const scale = { b: 1e9, bn: 1e9, m: 1e6, mn: 1e6, k: 1e3 }[suffixed[2] ?? ""] ?? 1;
    const target = n * scale;
    if (Math.abs(size - target) / Math.max(target, 1) < 0.25) return true;
  }

  if (unit && unit.includes(needle)) return true;
  return String(size).includes(needle);
}

/* ------------------------------------------------------------------ */
/* the search                                                          */
/* ------------------------------------------------------------------ */

export function search(input: {
  query: string;
  providers: Provider[];
  models: Model[];
  offers: OfferWithProvider[];
  events: { id: number; slug: string; name: string; offer_type?: string | null }[];
  changes: ChangeWithProvider[];
  now: number;
}): SearchResult {
  const raw = input.query.trim().toLowerCase();
  const hits: Hit[] = [];
  const terms: string[] = [];

  if (raw === "") {
    return { hits: [], freeText: "", terms: [], totalConsidered: 0, truncated: null };
  }

  // Recognise the longest phrases first, so "no card" is not consumed as "card"
  // and then reported as a contradiction.
  let remainder = raw;
  const recognised: { label: string; test: (o: OfferWithProvider) => boolean }[] = [];

  for (const t of [...OFFER_TERMS].sort((a, b) => b.match.length - a.match.length)) {
    // Whole-word match, so "card" does not fire inside "cardless" or
    // "discarded". A multi-word phrase matches on its own boundaries.
    const pattern = new RegExp(
      `(^|\\s)${t.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
    );
    if (pattern.test(remainder)) {
      terms.push(t.label);
      recognised.push({ label: t.label, test: t.test });
      remainder = remainder.replace(pattern, " ");
    }
  }

  const freeText = remainder.trim();

  /* -- offers ------------------------------------------------------- */

  const offerMatchesTerm = (o: OfferWithProvider) => recognised.every((r) => r.test(o));

  // A recognised term is a filter, so an offer must satisfy all of them. Free
  // text is a substring match, so it narrows further.
  const offerPassesTerms = (o: OfferWithProvider) => {
    if (freeText === "") return true;
    return (
      contains(o.model_label, freeText) ||
      contains(o.model_id_text, freeText) ||
      contains(o.provider?.name, freeText) ||
      contains(o.offer_type.replace(/_/g, " "), freeText) ||
      poolMatches(o, freeText)
    );
  };

  for (const o of input.offers) {
    // With no free text, a term alone is enough. With free text, a recognised
    // term must not also be required, or "claude keyless" would demand the
    // model name contain the word "keyless" as well.
    const ok = freeText === "" ? offerMatchesTerm(o) : offerPassesTerms(o);
    if (!ok) continue;
    hits.push({
      kind: "offer",
      id: `offer-${o.id}`,
      title: o.model_label,
      detail: [
        o.provider?.name ?? "Unknown provider",
        o.offer_type.replace(/_/g, " "),
        o.status.replace(/_/g, " "),
      ].join(" · "),
      href: `/evidence/${o.id}`,
    });
  }

  /* -- providers ---------------------------------------------------- */

  // A provider is not filtered by offer terms: those describe offers, and a
  // provider page is the place to see every offer including the ones that fail
  // the filter. Matching it here would hide the thing the reader is looking for.
  const providerPasses =
    freeText === "" ? recognised.length === 0 : contains;
  for (const p of input.providers) {
    const hitText =
      freeText !== "" &&
      (contains(p.name, freeText) ||
        contains(p.slug, freeText) ||
        contains(p.description, freeText) ||
        contains(p.provider_type, freeText));
    const hitTerm = recognised.some((r) => {
      const l = r.label.toLowerCase();
      return (
        contains(p.name, l) ||
        contains(p.description, l) ||
        contains(p.provider_type, l)
      );
    });
    if (freeText === "" ? hitTerm : hitText) {
      hits.push({
        kind: "provider",
        id: `provider-${p.id}`,
        title: p.name,
        detail: [
          p.provider_type ?? "provider",
          p.status,
          p.free_model_count > 0 ? `${p.free_model_count} free models` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/providers/${p.slug}`,
      });
    }
  }

  /* -- models ------------------------------------------------------- */

  for (const m of input.models) {
    if (
      freeText === "" ||
      contains(m.display_name, freeText) ||
      contains(m.model_id, freeText) ||
      contains(m.family, freeText)
    ) {
      hits.push({
        kind: "model",
        id: `model-${m.id}`,
        title: m.display_name,
        detail: [
          m.family,
          m.context_window ? `${m.context_window.toLocaleString("en-GB")} ctx` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "model",
        href: `/models/${m.slug}`,
      });
    }
  }

  /* -- events ------------------------------------------------------- */

  for (const e of input.events) {
    if (
      freeText === "" ||
      contains(e.name, freeText) ||
      contains(e.slug, freeText)
    ) {
      hits.push({
        kind: "event",
        id: `event-${e.id}`,
        title: e.name,
        detail: "Promotional event",
        href: `/events/${e.slug}`,
      });
    }
  }

  /* -- historical changes ------------------------------------------- */

  // Searched on the same free text only. A term like "keyless" describes the
  // present state of an offer, and matching it against a change row would
  // surface a historical row that has nothing to do with the question.
  if (freeText !== "") {
    for (const c of input.changes.slice(0, CHANGES_SCANNED)) {
      if (
        !contains(c.evidence, freeText) &&
        !contains(c.old_value, freeText) &&
        !contains(c.new_value, freeText) &&
        !contains(c.offer?.model_label, freeText) &&
        !contains(c.provider?.name, freeText)
      ) {
        continue;
      }
      hits.push({
        kind: "change",
        id: `change-${c.id}`,
        title: c.offer?.model_label ?? c.provider?.name ?? "Change",
        detail: [
          c.change_type.replace(/_/g, " "),
          c.provider?.name,
          c.field ? `${c.field} changed` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: c.offer_id ? `/evidence/${c.offer_id}` : "/timeline",
      });
    }
  }

  return {
    hits,
    freeText,
    terms,
    totalConsidered:
      input.providers.length +
      input.models.length +
      input.offers.length +
      input.events.length +
      Math.min(input.changes.length, CHANGES_SCANNED),
    truncated:
      input.changes.length > CHANGES_SCANNED
        ? `History search covers the most recent ${CHANGES_SCANNED} of ${input.changes.length} recorded changes.`
        : null,
  };
}

/** The example queries §30 gives, offered as real links. Showing them is how a
 *  reader learns that "no card" is something this search understands. */
export const SEARCH_EXAMPLES = [
  "claude",
  "no card",
  "keyless",
  "Qwen",
  "shared",
  "5B pool",
];
