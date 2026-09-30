"use client";

import { useMemo, useState } from "react";
import type { ChangeWithProvider, OfferWithProvider } from "@/lib/db";
import { OfferLedger } from "./Ledger";

/**
 * The filter and sort system (§31, §32).
 *
 * Two decisions shape this.
 *
 * Filters compose with AND, and each one maps to a stored boolean or value
 * rather than a keyword match. A reader who ticks "keyless" and "no card" is
 * describing one offer, and the two must both hold.
 *
 * Sorting is a *view order*, never a judgement. §3 forbids ranking providers
 * and §32 says so explicitly, so the options are named for what they sort by —
 * "recently verified", "largest pool" — and never "best" or "top". The default
 * order is newest verification first, because that is the order in which stale
 * claims surface themselves, not the order in which the strongest offer leads.
 *
 * Everything runs on the client: the live set is a few hundred rows and ships
 * with the page, so a reader comparing terms should not wait on a round trip
 * per click.
 */

type SortKey =
  | "recently_verified"
  | "recently_discovered"
  | "starting_soon"
  | "largest_pool"
  | "most_models"
  | "recently_changed"
  | "recently_ended";

/** Named for the ordering, never for a quality. See §3 and §32. */
const SORTS: { key: SortKey; label: string; hint: string }[] = [
  {
    key: "recently_verified",
    label: "Recently verified",
    hint: "Newest confirmation first. Stale claims drift to the end.",
  },
  {
    key: "recently_discovered",
    label: "Recently discovered",
    hint: "Newest addition first.",
  },
  {
    key: "starting_soon",
    label: "Starting soon",
    hint: "Offers with the nearest start date.",
  },
  {
    key: "largest_pool",
    label: "Largest pool",
    hint: "Biggest published pool first. Offers with no pool go last.",
  },
  {
    key: "most_models",
    label: "Most models",
    hint: "Providers with the most free models first.",
  },
  {
    key: "recently_changed",
    label: "Recently changed",
    hint: "Most recently altered first.",
  },
  {
    key: "recently_ended",
    label: "Recently ended",
    hint: "Most recently withdrawn first.",
  },
];

/* ------------------------------------------------------------------ */
/* quick filters                                                       */
/* ------------------------------------------------------------------ */

const FRONTIER =
  /gpt-6|gpt-5|claude|opus|sonnet|haiku|gemini-3|gemini-2\.5|glm-5|glm-4\.7|kimi-k3|deepseek-v4|qwen3\.8|llama-4|grok-4/i;

/** The terms a reader decides on in one click. */
const PILLS = [
  {
    key: "shared_pool",
    label: "Shared pools",
    test: (o: OfferWithProvider) =>
      o.offer_type === "shared_pool" || o.offer_type === "sponsored_inference",
  },
  {
    key: "free_tier",
    label: "Free APIs",
    test: (o: OfferWithProvider) => o.offer_type === "free_tier",
  },
  {
    key: "keyless",
    label: "Keyless",
    test: (o: OfferWithProvider) => o.keyless,
  },
  {
    key: "credits",
    label: "Credits",
    test: (o: OfferWithProvider) => o.offer_type === "free_credits",
  },
  {
    key: "frontier",
    label: "Frontier",
    // A proxy for "a strong model": the ids providers use for headline models.
    // Deliberately explicit so the label means something checkable rather than
    // implying a ranking we do not make.
    test: (o: OfferWithProvider) =>
      FRONTIER.test(o.model_label) || FRONTIER.test(o.model_id_text ?? ""),
  },
  { key: "cardless", label: "No card", test: (o: OfferWithProvider) => !o.card_required },
  {
    key: "subless",
    label: "No subscription",
    test: (o: OfferWithProvider) => !o.access_requires_subscription,
  },
  { key: "openai", label: "OpenAI", test: (o: OfferWithProvider) => o.compatibility_openai },
  {
    key: "anthropic",
    label: "Anthropic",
    test: (o: OfferWithProvider) => o.compatibility_anthropic,
  },
  {
    key: "pooled",
    label: "Has a pool",
    test: (o: OfferWithProvider) => o.pool_size !== null,
  },
  {
    key: "temporary",
    label: "Temporary",
    test: (o: OfferWithProvider) => o.end_at !== null || o.exhaustion_condition !== null,
  },
] as const;

type PillKey = (typeof PILLS)[number]["key"];

/* ------------------------------------------------------------------ */
/* select filters (§31)                                                */
/* ------------------------------------------------------------------ */

const ACCESS_TYPES = [
  "shared_pool",
  "free_tier",
  "rotating_free_model",
  "sponsored_inference",
  "promotional_event",
  "free_credits",
  "keyless",
  "free_trial",
] as const;

const STATUSES = [
  "upcoming",
  "live",
  "changed",
  "ending",
  "exhausted",
  "ended",
  "suspended",
  "unverified",
] as const;

/** Freshness bands from §14, named so the filter reads as a question. */
const FRESHNESS = [
  { key: "fresh", label: "Verified in the last 6 hours" },
  { key: "aging", label: "Verified in the last 24 hours" },
  { key: "stale", label: "Verified over 24 hours ago" },
  { key: "any", label: "Any age" },
] as const;

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export function LiveBrowser({
  offers,
  changes,
  now,
}: {
  offers: OfferWithProvider[];
  changes: ChangeWithProvider[];
  now: number;
}) {
  const [pills, setPills] = useState<PillKey[]>([]);
  const [status, setStatus] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [access, setAccess] = useState<string>("");
  const [fresh, setFresh] = useState<string>("any");
  const [quota, setQuota] = useState<string>("any");
  const [sort, setSort] = useState<SortKey>("recently_verified");

  // The newest change timestamp per offer. Needed for "recently changed", which
  // cannot be derived from the offer row alone — the row holds current state,
  // not when it last moved.
  const lastChange = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of changes) {
      if (c.offer_id === null) continue;
      const t = new Date(c.detected_at).getTime();
      const cur = m.get(c.offer_id) ?? 0;
      if (t > cur) m.set(c.offer_id, t);
    }
    return m;
  }, [changes]);

  const { providers, models } = useMemo(() => {
    const p = new Set<string>();
    const m = new Set<string>();
    for (const o of offers) {
      if (o.provider) p.add(`${o.provider.name}||${o.provider.slug}`);
      m.add(o.model_label);
    }
    return {
      providers: [...p].sort().map((s) => {
        const [name, slug] = s.split("||");
        return { name: name ?? "", slug: slug ?? "" };
      }),
      models: [...m].sort(),
    };
  }, [offers]);

  const hoursSince = (iso: string | null) =>
    iso === null ? Infinity : (now - new Date(iso).getTime()) / 3_600_000;

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      for (const p of PILLS) {
        if (pills.includes(p.key) && !p.test(o)) return false;
      }
      if (status && o.status !== status) return false;
      if (provider && o.provider?.slug !== provider) return false;
      if (model && o.model_label !== model) return false;
      if (access && o.offer_type !== access) return false;

      // §14 bands, applied here so the filter and the badge cannot disagree.
      if (fresh !== "any") {
        const h = hoursSince(o.last_verified_at);
        if (fresh === "fresh" && !(h <= 6)) return false;
        if (fresh === "aging" && !(h > 6 && h <= 24)) return false;
        if (fresh === "stale" && !(h > 24)) return false;
      }

      if (quota !== "any") {
        const hasPool = o.pool_size !== null;
        const hasRate =
          o.rpm !== null || o.rpd !== null || o.tpm !== null || o.tpd !== null;
        const hasTokens = o.token_limit !== null;
        if (quota === "pool" && !hasPool) return false;
        if (quota === "rate" && !hasRate) return false;
        if (quota === "tokens" && !hasTokens) return false;
        if (quota === "unstated" && (hasPool || hasRate || hasTokens)) return false;
      }

      return true;
    });
  }, [offers, pills, status, provider, model, access, fresh, quota, now]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    // Untyped on purpose. The null check is applied to timestamps and to
    // figures alike, and a helper typed for numbers would not accept a date
    // string. Nulls sort last in every order below: a route with no published
    // figure must not appear as though it had the smallest one.
    const missing = (v: unknown) => v === null || v === undefined;

    switch (sort) {
      case "recently_verified":
        return out.sort(
          (a, b) => hoursSince(b.last_verified_at) - hoursSince(a.last_verified_at),
        );
      case "recently_discovered":
        return out.sort(
          (a, b) =>
            new Date(b.first_discovered_at).getTime() -
            new Date(a.first_discovered_at).getTime(),
        );
      case "starting_soon":
        return out.sort((a, b) => {
          // Offers with no start date are not "soon", so they go to the end.
          if (missing(a.start_at)) return missing(b.start_at) ? 0 : 1;
          if (missing(b.start_at)) return -1;
          return new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime();
        });
      case "largest_pool":
        return out.sort((a, b) => {
          if (missing(a.pool_size)) return missing(b.pool_size) ? 0 : 1;
          if (missing(b.pool_size)) return -1;
          return (b.pool_size ?? 0) - (a.pool_size ?? 0);
        });
      case "most_models":
        return out.sort(
          (a, b) => (b.provider?.free_model_count ?? 0) - (a.provider?.free_model_count ?? 0),
        );
      case "recently_changed":
        return out.sort(
          (a, b) => (lastChange.get(b.id) ?? 0) - (lastChange.get(a.id) ?? 0),
        );
      case "recently_ended":
        return out.sort((a, b) => {
          if (missing(a.ended_at)) return missing(b.ended_at) ? 0 : 1;
          if (missing(b.ended_at)) return -1;
          return new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime();
        });
      default:
        return out;
    }
  }, [filtered, sort, lastChange, now]);

  const togglePill = (key: PillKey) =>
    setPills((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const activeCount =
    pills.length +
    (status ? 1 : 0) +
    (provider ? 1 : 0) +
    (model ? 1 : 0) +
    (access ? 1 : 0) +
    (fresh !== "any" ? 1 : 0) +
    (quota !== "any" ? 1 : 0);

  const reset = () => {
    setPills([]);
    setStatus("");
    setProvider("");
    setModel("");
    setAccess("");
    setFresh("any");
    setQuota("any");
  };

  const sortMeta = SORTS.find((s) => s.key === sort)!;

  return (
    <div>
      {/* Quick terms. Real buttons with aria-pressed, so the set is keyboard
          reachable and its state is announced. */}
      <div className="filter-bar" role="group" aria-label="Filter by access term">
        {PILLS.map((p) => {
          const on = pills.includes(p.key);
          // No card and No subscription currently match every tracked route.
          // They stay as controls (and narrow again the moment a gated route
          // exists) but are labelled as the standing fact they are, so
          // selecting one never implies it narrowed anything (VIS-012).
          const fact =
            p.key === "cardless" || p.key === "subless"
              ? "True of every tracked route at present"
              : undefined;
          return (
            <button
              key={p.key}
              type="button"
              className="filter"
              aria-pressed={on}
              onClick={() => togglePill(p.key)}
              title={fact}
              aria-label={fact ? `${p.label} (${fact.toLowerCase()})` : p.label}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <p className="annot" style={{ marginTop: "0.5rem" }}>
        No card and No subscription currently match every tracked route. They
        confirm the market as it stands rather than narrowing it.
      </p>

      {/* The §31 filter set, as selects. Grouped so the shape of the question is
          visible: what it is, who offers it, what it needs, how fresh it is. */}
      <div className="filters">
        <div className="filters-group">
          <p className="label">What</p>
          <label className="sr-only" htmlFor="f-status">Status</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-access">Access type</label>
          <select id="f-access" value={access} onChange={(e) => setAccess(e.target.value)}>
            <option value="">Any access type</option>
            {ACCESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-quota">Published limit</label>
          <select id="f-quota" value={quota} onChange={(e) => setQuota(e.target.value)}>
            <option value="any">Any limit published</option>
            <option value="pool">Has a token pool</option>
            <option value="rate">Has a rate limit</option>
            <option value="tokens">Has a token limit</option>
            <option value="unstated">Nothing published</option>
          </select>
        </div>

        <div className="filters-group">
          <p className="label">Who</p>
          <label className="sr-only" htmlFor="f-provider">Provider</label>
          <select id="f-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">Any provider</option>
            {providers.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-model">Model</label>
          <select id="f-model" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Any model</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="filters-group">
          <p className="label">How fresh</p>
          <label className="sr-only" htmlFor="f-fresh">Freshness</label>
          <select id="f-fresh" value={fresh} onChange={(e) => setFresh(e.target.value)}>
            {FRESHNESS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* §32 sorting. The hint under the control says what the order means, so
            "largest pool" is never read as "best". */}
        <div className="filters-group">
          <p className="label">Order</p>
          <label className="sr-only" htmlFor="f-sort">Sort by</label>
          <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="annot filters-hint">{sortMeta.hint}</p>
        </div>
      </div>

      <p className="annot filters-count" aria-live="polite">
        Showing {sorted.length} of {offers.length} free route
        {offers.length === 1 ? "" : "s"}
        {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} active` : ""}
        {activeCount > 0 ? (
          <>
            {" · "}
            <button type="button" className="link-ev" onClick={reset}>
              Clear
            </button>
          </>
        ) : null}
      </p>

      {sorted.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No route matches every filter</p>
          <p>
            Filters combine, so a combination with no result usually means one
            requirement is rarer than expected.{" "}
            <button type="button" className="link-ev" onClick={reset}>
              Clear the filters
            </button>{" "}
            to see the full set again.
          </p>
        </div>
      ) : (
        <OfferLedger offers={sorted} now={now} />
      )}
    </div>
  );
}
