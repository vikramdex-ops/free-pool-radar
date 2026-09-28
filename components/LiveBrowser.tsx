"use client";

import { useMemo, useState } from "react";
import type { OfferWithProvider } from "@/lib/db";
import { OfferLedger } from "./Ledger";

/**
 * The filter set from §21.
 *
 * These are the terms a reader actually decides on, and each one maps to a
 * stored boolean or type rather than a keyword match. Filtering happens on the
 * client because the whole live set is small enough to ship in one page, and a
 * reader comparing terms should not wait on a round trip per click.
 *
 * Filters compose with AND. They are real buttons with aria-pressed, not
 * decorative pills, so the set is keyboard reachable and its state is
 * announced.
 */

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  {
    key: "shared_pool",
    label: "Shared pools",
    test: (o: OfferWithProvider) =>
      o.offer_type === "shared_pool" || o.offer_type === "sponsored_inference",
  },
  { key: "free_tier", label: "Free APIs", test: (o: OfferWithProvider) => o.offer_type === "free_tier" },
  { key: "keyless", label: "Keyless", test: (o: OfferWithProvider) => o.keyless },
  {
    key: "credits",
    label: "Credits",
    test: (o: OfferWithProvider) => o.offer_type === "free_credits",
  },
  {
    key: "frontier",
    label: "Frontier",
    // A proxy for "strong model": the model ids providers use for their
    // headline models. Deliberately explicit, so the label means something
    // checkable rather than implying a ranking.
    test: (o: OfferWithProvider) =>
      FRONTIER.test(o.model_label) || FRONTIER.test(o.model_id_text ?? ""),
  },
  {
    key: "openai",
    label: "OpenAI compatible",
    test: (o: OfferWithProvider) => o.compatibility_openai,
  },
  {
    key: "anthropic",
    label: "Anthropic compatible",
    test: (o: OfferWithProvider) => o.compatibility_anthropic,
  },
  {
    key: "cardless",
    label: "No card",
    test: (o: OfferWithProvider) => !o.card_required,
  },
  {
    key: "subless",
    label: "No subscription",
    test: (o: OfferWithProvider) => !o.access_requires_subscription,
  },
] as const;

const FRONTIER =
  /gpt-6|gpt-5|claude|opus|sonnet|haiku|gemini-3|gemini-2\.5|glm-5|glm-4\.7|kimi-k3|deepseek-v4|qwen3\.8|llama-4|grok-4/i;

export function LiveBrowser({
  offers,
  now,
}: {
  offers: OfferWithProvider[];
  now: number;
}) {
  const [active, setActive] = useState<string[]>(["all"]);

  const filtered = useMemo(() => {
    const chosen = active.filter((k) => k !== "all");
    if (chosen.length === 0) return offers;
    return offers.filter((o) =>
      chosen.every((k) => {
        const f = FILTERS.find((x) => x.key === k);
        return f ? f.test(o) : true;
      }),
    );
  }, [active, offers]);

  const toggle = (key: string) => {
    setActive((prev) => {
      if (key === "all") return ["all"];
      const without = prev.filter((k) => k !== "all" && k !== key);
      // Clicking the only active filter returns to the full set, so there is
      // always a way back to everything without hunting for a reset control.
      if (without.length === prev.length) return [...without, key];
      return without.length === 0 ? ["all"] : without;
    });
  };

  return (
    <div>
      <div
        className="filter-bar"
        role="group"
        aria-label="Filter free access by terms"
      >
        {FILTERS.map((f) => {
          const on = active.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              className="filter"
              aria-pressed={on}
              onClick={() => toggle(f.key)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <p className="annot" style={{ margin: "0.875rem 0 1.5rem" }} aria-live="polite">
        Showing {filtered.length} of {offers.length} currently usable free
        route{offers.length === 1 ? "" : "s"}.
      </p>

      <OfferLedger offers={filtered} now={now} />
    </div>
  );
}
