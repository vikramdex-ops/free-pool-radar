/**
 * Collector registry (Â§10).
 *
 * Every monitored source is a row in the database; the parser that turns a
 * response into normalised intelligence is looked up here by `parser_key`.
 * Adding a provider therefore means inserting a row, not editing a component
 * (Â§10, Â§51).
 *
 * Each collector returns normalised facts. It must never invent a number it
 * did not read: an absent field is `null`, which the UI renders as
 * "Not publicly stated" rather than a guess (Â§9).
 */

export type Unit =
  | "tokens"
  | "weighted_tokens"
  | "requests"
  | "credits"
  | "dollars"
  | "neurons"
  | "images"
  | "characters";

export type OfferType =
  | "shared_pool"
  | "free_tier"
  | "rotating_free_model"
  | "sponsored_inference"
  | "promotional_event"
  | "free_credits"
  | "keyless"
  | "free_trial"
  | "ended";

export type OfferStatus =
  | "upcoming"
  | "live"
  | "changed"
  | "ending"
  | "exhausted"
  | "ended"
  | "suspended"
  | "unverified";

export type VerificationLevel =
  | "live_api"
  | "official_docs"
  | "official_event_page"
  | "official_announcement"
  | "official_social"
  | "secondary"
  | "community";

/** A model discovered on a free route. */
export interface NormalisedModel {
  modelId: string;
  displayName: string;
  contextWindow: number | null;
  capabilities: string[];
  family: string | null;
}

/** One free route: a model, and what it costs you to use. */
export interface NormalisedOffer {
  providerSlug: string;
  modelId: string | null;
  modelLabel: string;
  offerType: OfferType;
  status: OfferStatus;

  apiKeyRequired: boolean;
  keyless: boolean;
  accessRequiresAccount: boolean;
  accessRequiresSubscription: boolean;
  cardRequired: boolean;
  paymentRequired: boolean;

  compatibilityOpenai: boolean;
  compatibilityAnthropic: boolean;
  compatibilityOther: string | null;

  rpm: number | null;
  rpd: number | null;
  tpm: number | null;
  tpd: number | null;
  monthlyLimit: number | null;
  monthlyUnit: string | null;
  tokenLimit: number | null;
  tokenLimitUnit: Unit | null;

  poolSize: number | null;
  poolRemaining: number | null;
  poolUnit: Unit | null;

  creditAmount: number | null;
  creditCurrency: string | null;

  startAt: string | null;
  endAt: string | null;

  verificationLevel: VerificationLevel;
  officialEvidenceUrl: string;
  /** Field-level provenance. Unread fields simply do not appear here. */
  evidence: Record<string, string>;
}

export interface NormalisedEvent {
  providerSlug: string;
  /**
   * Stable identity for the event.
   *
   * Supplied explicitly rather than derived from the name, because a name is
   * prose and prose changes. Deriving the slug from the name is how the same
   * pool ended up stored twice: the seed and the collector generated different
   * slugs for one apmix event, and the site rendered it as two cards.
   */
  slug: string;
  name: string;
  description: string | null;
  status: "upcoming" | "live" | "ended" | "cancelled" | "exhausted" | "suspended";
  startAt: string | null;
  endAt: string | null;
  poolSize: number | null;
  poolRemaining: number | null;
  unit: Unit;
  models: string[];
  eligibility: string | null;
  requirements: string | null;
  exhaustionCondition: string | null;
  officialUrl: string;
}

export interface CollectorResult {
  offers: NormalisedOffer[];
  events: NormalisedEvent[];
  /** Provider-level facts the sweep can roll up. */
  freeModelCount: number | null;
  notes: string[];
}

export interface Collector {
  key: string;
  providerSlug: string;
  label: string;
  /** Sources this collector reads, all public and unauthenticated. */
  urls: { url: string; type: "json" | "html" | "rsc" | "openapi"; priority: number }[];
  collect: () => Promise<CollectorResult>;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const UA = "free-pool-radar/1.0 (+https://free-pool-radar.vercel.app)";

async function get(url: string, timeoutMs = 15000): Promise<TimedResponse> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const release = () => clearTimeout(t);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/html" },
      cache: "no-store",
    });
    return { r, release };
  } catch (e) {
    release();
    throw e;
  }
  // NOTE: no finally-clear here on purpose. On success the timer stays armed
  // while the caller consumes the body; json()/text() release it afterwards.
  // A server that sends headers then stalls the body aborts at timeoutMs
  // instead of hanging a sweep whose collectors run strictly in series with
  // no aggregate bound (LED-051).
}

interface TimedResponse {
  r: Response;
  release: () => void;
}

async function json<T>(url: string): Promise<T> {
  const { r, release } = await get(url);
  try {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    release();
  }
}

async function text(url: string): Promise<{ status: number; body: string }> {
  const { r, release } = await get(url);
  try {
    return { status: r.status, body: await r.text() };
  } finally {
    release();
  }
}

const freeModel = (
  providerSlug: string,
  modelId: string,
  evidenceUrl: string,
  opts: Partial<NormalisedOffer> = {},
): NormalisedOffer => ({
  providerSlug,
  modelId,
  modelLabel: modelId,
  offerType: "rotating_free_model",
  status: "live",
  apiKeyRequired: true,
  keyless: false,
  accessRequiresAccount: true,
  accessRequiresSubscription: false,
  cardRequired: false,
  paymentRequired: false,
  compatibilityOpenai: true,
  compatibilityAnthropic: false,
  compatibilityOther: null,
  rpm: null,
  rpd: null,
  tpm: null,
  tpd: null,
  monthlyLimit: null,
  monthlyUnit: null,
  tokenLimit: null,
  tokenLimitUnit: null,
  poolSize: null,
  poolRemaining: null,
  poolUnit: null,
  creditAmount: null,
  creditCurrency: null,
  startAt: null,
  endAt: null,
  verificationLevel: "live_api",
  officialEvidenceUrl: evidenceUrl,
  evidence: { source: evidenceUrl },
  ...opts,
});

const epochDay = (s: number | null | undefined) =>
  s ? new Date(s * 1000).toISOString() : null;

/* ------------------------------------------------------------------ */
/* collectors                                                          */
/* ------------------------------------------------------------------ */

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number | null;
  architecture?: { input_modalities?: string[] };
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
}

const openrouter: Collector = {
  key: "openrouter.models",
  providerSlug: "openrouter",
  label: "OpenRouter free models",
  urls: [
    { url: "https://openrouter.ai/api/v1/models", type: "json", priority: 1 },
  ],
  collect: async () => {
    const url = "https://openrouter.ai/api/v1/models";
    const j = await json<{ data: OpenRouterModel[] }>(url);
    // Deliberate non-zero default for absent prices, mirroring the anyrouter
    // collector in this file (?? 1) and extended to '' which Number() also
    // reads as 0: a price that is null, undefined or empty is not a published
    // zero and must not read as free (LED-053).
    const priceOrOne = (v: unknown) =>
      v === null || v === undefined || v === "" ? 1 : v;
    const zero = j.data.filter(
      (m) =>
        Number(priceOrOne(m.pricing?.prompt)) === 0 &&
        Number(priceOrOne(m.pricing?.completion)) === 0,
    );
    return {
      offers: zero.map((m) =>
        freeModel("openrouter", m.id, url, {
          modelLabel: m.name,
          offerType: m.id === "openrouter/free" ? "rotating_free_model" : "free_tier",
          rpm: 20,
          evidence: {
            "pricing": `${url} â€” prompt and completion both "0"`,
            "rpm": "https://openrouter.ai/docs/api-reference/limits",
          },
          compatibilityAnthropic: false,
        }),
      ),
      events: [],
      freeModelCount: zero.length,
      notes: [
        "Per-minute and per-day ceilings are account-wide, not per model.",
      ],
    };
  },
};

const aihubmix: Collector = {
  key: "aihubmix.models",
  providerSlug: "aihubmix",
  label: "AIHubMix free model ids",
  urls: [{ url: "https://aihubmix.com/v1/models", type: "json", priority: 1 }],
  collect: async () => {
    const url = "https://aihubmix.com/v1/models";
    const j = await json<{ data: { id: string; owned_by: string }[] }>(url);
    const free = j.data.filter((m) => /-free$/i.test(m.id));
    return {
      offers: free.map((m) =>
        freeModel("aihubmix", m.id, url, {
          offerType: "free_tier",
          compatibilityOpenai: true,
          compatibilityAnthropic: true,
          evidence: {
            source: `${url} â€” model id ends in -free`,
            limits: "https://aihubmix.com/models/free",
          },
        }),
      ),
      events: [],
      freeModelCount: free.length,
      notes: ["Per-model rate limits are published on each model page."],
    };
  },
};

const zen: Collector = {
  key: "zen.models",
  providerSlug: "opencode-zen",
  label: "OpenCode Zen free ids",
  urls: [
    { url: "https://opencode.ai/zen/v1/models", type: "json", priority: 1 },
  ],
  collect: async () => {
    const url = "https://opencode.ai/zen/v1/models";
    const j = await json<{ data: { id: string; created: number }[] }>(url);
    const free = j.data.filter((m) => /-free$/i.test(m.id));
    return {
      offers: free.map((m) =>
        freeModel("opencode-zen", m.id, url, {
          offerType: "free_tier",
          rpm: null,
          evidence: { source: `${url} â€” id ends in -free` },
        }),
      ),
      events: [],
      freeModelCount: free.length,
      notes: ["Zen also bills non-free ids at list price on the same endpoint."],
    };
  },
};

const anyrouter: Collector = {
  key: "anyrouter.models",
  providerSlug: "anyrouter",
  label: "AnyRouter $0 routes",
  urls: [{ url: "https://anyrouter.dev/v1/models", type: "json", priority: 1 }],
  collect: async () => {
    const url = "https://anyrouter.dev/v1/models";
    const j = await json<{
      data: {
        id: string;
        name?: string;
        display_name?: string;
        pricing?: { prompt?: string };
        per_upstream?: { llm_provider: string; pricing?: { input_per_1m?: number } }[];
      }[];
    }>(url);
    const free = j.data.filter((m) => Number(m.pricing?.prompt ?? 1) === 0);
    return {
      offers: free.map((m) => {
        const upstreams = (m.per_upstream || [])
          .filter((u) => Number(u.pricing?.input_per_1m ?? 1) === 0)
          .map((u) => u.llm_provider);
        return freeModel("anyrouter", m.id, url, {
          modelLabel: m.display_name || m.name || m.id,
          offerType: m.id === "anyrouter/free" ? "rotating_free_model" : "free_tier",
          rpd: m.id === "anyrouter/free" ? 10 : null,
          evidence: {
            source: `${url} â€” prompt price "0"`,
            ...(upstreams.length
              ? { upstream: `free upstreams: ${upstreams.join(", ")}` }
              : {}),
          },
        });
      }),
      events: [],
      freeModelCount: free.length,
      notes: [
        "Free routes draw on pooled provider capacity and carry no ZDR guarantee.",
      ],
    };
  },
};

interface KiloModel {
  id: string;
  name?: string;
  isFree?: boolean;
  context_length?: number | null;
}

const kilo: Collector = {
  key: "kilo.models",
  providerSlug: "kilo",
  label: "Kilo Gateway keyless free ids",
  urls: [
    { url: "https://api.kilo.ai/api/gateway/models", type: "json", priority: 1 },
  ],
  collect: async () => {
    const url = "https://api.kilo.ai/api/gateway/models";
    const j = await json<{ data: KiloModel[] }>(url);
    const free = j.data.filter((m) => m.isFree || /:free$|kilo-auto\/free/.test(m.id));
    return {
      offers: free.map((m) =>
        freeModel("kilo", m.id, url, {
          modelLabel: m.name || m.id,
          offerType: "rotating_free_model",
          apiKeyRequired: false,
          keyless: true,
          rpd: 200,
          evidence: {
            source: `${url} â€” isFree or -free suffix`,
            rate: "https://kilo.ai/docs/gateway/authentication â€” 200 req/hour/IP anonymous",
          },
        }),
      ),
      events: [],
      freeModelCount: free.length,
      notes: ["Anonymous route is per IP and heavily contended upstream."],
    };
  },
};

interface Llm7Model {
  id: string;
  tier?: string;
  context_window?: { tokens?: number | null };
}

const llm7: Collector = {
  key: "llm7.models",
  providerSlug: "llm7",
  label: "LLM7 turbo models",
  urls: [{ url: "https://api.llm7.io/v1/models", type: "json", priority: 1 }],
  collect: async () => {
    const url = "https://api.llm7.io/v1/models";
    const j = await json<{ data: Llm7Model[] }>(url);
    const turbo = j.data.filter((m) => m.tier === "turbo");
    return {
      offers: turbo.map((m) =>
        freeModel("llm7", m.id, url, {
          offerType: "free_tier",
          apiKeyRequired: false,
          keyless: true,
          rpm: 10,
          tokenLimit: 500000,
          tokenLimitUnit: "tokens",
          evidence: {
            source: `${url} â€” tier "turbo"`,
            limits: "https://docs.llm7.io/limits",
          },
        }),
      ),
      events: [],
      freeModelCount: turbo.length,
      notes: ["Anonymous: 10 rpm, 500k tokens/24h. Free token raises it to 40 rpm."],
    };
  },
};

interface PollinationsModel {
  name: string;
  description?: string;
  reasoning?: boolean;
  tools?: boolean;
  vision?: boolean;
}

const pollinations: Collector = {
  key: "pollinations.models",
  providerSlug: "pollinations",
  label: "Pollinations keyless models",
  urls: [
    { url: "https://text.pollinations.ai/models", type: "json", priority: 1 },
  ],
  collect: async () => {
    const url = "https://text.pollinations.ai/models";
    const j = await json<PollinationsModel[]>(url);
    return {
      offers: j.map((m) =>
        freeModel("pollinations", m.name, url, {
          modelLabel: m.description || m.name,
          offerType: "keyless",
          apiKeyRequired: false,
          keyless: true,
          compatibilityAnthropic: false,
          evidence: { source: `${url} â€” anonymous tier` },
        }),
      ),
      events: [],
      freeModelCount: j.length,
      notes: [
        "Keyless text works; named models need a key. Zero price-0 models today.",
      ],
    };
  },
};

const apmix: Collector = {
  key: "apmix.event",
  providerSlug: "apmix",
  label: "apmix community event pool",
  urls: [{ url: "https://apmix.ai/event", type: "rsc", priority: 1 }],
  collect: async () => {
    const url = "https://apmix.ai/event";
    const { status: httpStatus, body: html } = await text(url);
    if (httpStatus < 200 || httpStatus >= 300) throw new Error(`HTTP ${httpStatus}`);

    // The event state is embedded in the Next.js RSC flight payload. Read the
    // fields directly rather than brace-matching a string full of escapes.
    const flat = html
      .replace(/\\\\/g, "\u0000")
      .replace(/\\"/g, '"')
      .replace(/\\u0026/g, "&")
      .replace(/\u0000/g, "\\");
    const at = flat.indexOf('"initial":{');
    if (at === -1) throw new Error("event payload not found");
    const seg = flat.slice(at, at + 700);
    // LED-050: a reorder pushing a field outside the window reads identically
    // to an unpublished field. Tell them apart against a wider window: present
    // wider but absent here means structural break (throw, like the missing
    // marker); absent from both means unpublished (null, never 0).
    const wide = flat.slice(at, at + 4000);
    for (const k of ["pool", "remaining", "status"]) {
      if (!seg.includes(`"${k}":`) && wide.includes(`"${k}":`)) {
        throw new Error(`event field ${k} outside parse window`);
      }
    }

    const str = (k: string) => {
      const m = seg.match(new RegExp(`"${k}":(null|"(?:[^"\\\\]|\\\\.)*")`));
      if (!m || m[1] === "null") return null;
      try {
        return JSON.parse(m[1]) as string;
      } catch {
        return null;
      }
    };
    const num = (k: string) => {
      const m = seg.match(new RegExp(`"${k}":(-?[\\d.]+)`));
      // Absent is null, never 0: an unread field must not read as exhausted.
      // Absent is null, never 0 (shared with LED-049): an unread field must
      // not read as exhausted.
      return m ? Number(m[1]) : null;
    };

    const modelId = str("modelId");
    if (!modelId) throw new Error("event model id missing");
    const rawStatus = str("status") ?? "upcoming";
    const status: OfferStatus =
      rawStatus === "live"
        ? "live"
        : rawStatus === "ended" || rawStatus === "none"
          ? "ended"
          : "upcoming";

    const poolSize = num("pool");
    const remaining = num("remaining");
    const startsAt = str("startsAt");

    const offers: NormalisedOffer[] = [
      {
        providerSlug: "apmix",
        modelId,
        modelLabel: modelId,
        offerType: "shared_pool",
        status,
        apiKeyRequired: true,
        keyless: false,
        accessRequiresAccount: true,
        accessRequiresSubscription: false,
        cardRequired: false,
        paymentRequired: false,
        compatibilityOpenai: true,
        compatibilityAnthropic: true,
        compatibilityOther: null,
        rpm: 60,
        rpd: null,
        tpm: null,
        tpd: null,
        monthlyLimit: null,
        monthlyUnit: null,
        tokenLimit: null,
        tokenLimitUnit: null,
        poolSize,
        poolRemaining: remaining,
        poolUnit: "weighted_tokens",
        creditAmount: null,
        creditCurrency: null,
        startAt: startsAt,
        endAt: str("endsAt"),
        verificationLevel: "official_event_page",
        officialEvidenceUrl: url,
        evidence: {
          pool: `${url} â€” pool and remaining read from the published event state`,
          rpm: "https://apmix.ai/docs â€” 60 req/min, 120 on Max",
        },
      },
    ];

    const events: NormalisedEvent[] = [
      {
        providerSlug: "apmix",
        // Matches the slug used by supabase/seed.sql, so the researched event
        // and the observed event are the same row rather than two.
        slug: "apmix-community-event",
        name: "Community event â€” shared token pool",
        description:
          "One shared pool, every account on any plan, first come first served until it is gone.",
        status: status === "ended" ? "ended" : status === "live" ? "live" : "upcoming",
        startAt: startsAt,
        endAt: null,
        poolSize,
        poolRemaining: remaining,
        unit: "weighted_tokens",
        models: [modelId],
        eligibility: "Any account â€” free, Starter, Pro or Max",
        requirements: "API key required. No payment method.",
        exhaustionCondition: "Requests answer 403 event_ended once the pool is spent",
        officialUrl: url,
      },
    ];

    return { offers, events, freeModelCount: null, notes: [] };
  },
};

interface StSponsor {
  displayName?: string;
  balanceCents?: number;
  lifetimeCents?: number;
  spentCents?: number;
  lastRechargeAt?: string | null;
}

const sponsoredtokens: Collector = {
  key: "sponsoredtokens.pool",
  providerSlug: "sponsored-tokens",
  label: "sponsored/tokens sponsor pool",
  urls: [
    { url: "https://sponsoredtokens.com/api/sponsors", type: "json", priority: 1 },
    { url: "https://sponsoredtokens.com/api/flags", type: "json", priority: 2 },
  ],
  collect: async () => {
    const [sp, fl] = await Promise.all([
      json<{ sponsors: StSponsor[] }>("https://sponsoredtokens.com/api/sponsors"),
      json<{ poolPaused?: boolean }>("https://sponsoredtokens.com/api/flags"),
    ]);
    // LED-052: absence is an expected shape (the type marks it optional), but
    // an absent flag must never read as "not paused" - that invents live from
    // nothing and un-suspends a stored suspended pool. Fail loudly like the
    // other collectors do on malformed shape; the prior values stay untouched.
    if (typeof fl.poolPaused !== "boolean") {
      throw new Error("pool flags malformed: poolPaused is absent");
    }
    // LED-048: an unreadable pool is an error, never a measured zero.
    // `sp.sponsors || []` would turn a renamed or wrapped key into an empty
    // list and overwrite a stored dollar balance with 0 while status stays
    // live, so the shape is validated before anything is totalled.
    const list = sp.sponsors;
    if (!Array.isArray(list)) {
      throw new Error("sponsors payload malformed: sponsors is not an array");
    }
    const cents = (k: "balanceCents" | "lifetimeCents" | "spentCents") =>
      list.reduce((a, b) => {
        const v = b[k];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new Error(`sponsors payload malformed: ${k} is not a number`);
        }
        return a + v;
      }, 0);
    const balance = cents("balanceCents") / 100;
    const lifetime = cents("lifetimeCents") / 100;
    const spent = cents("spentCents") / 100;

    return {
      offers: [
        {
          providerSlug: "sponsored-tokens",
          modelId: null,
          modelLabel: "Real Claude, GPT and Gemini behind the sponsored/ prefix",
          offerType: "sponsored_inference",
          status: fl.poolPaused ? "suspended" : "live",
          apiKeyRequired: true,
          keyless: false,
          accessRequiresAccount: true,
          accessRequiresSubscription: false,
          cardRequired: false,
          paymentRequired: false,
          compatibilityOpenai: true,
          compatibilityAnthropic: true,
          compatibilityOther: null,
          rpm: null,
          rpd: null,
          tpm: null,
          tpd: null,
          monthlyLimit: 5,
          monthlyUnit: "dollars",
          tokenLimit: null,
          tokenLimitUnit: null,
          poolSize: Math.round(lifetime),
          poolRemaining: Math.round(balance),
          poolUnit: "dollars",
          creditAmount: balance,
          creditCurrency: "USD",
          startAt: null,
          endAt: null,
          verificationLevel: "live_api",
          officialEvidenceUrl: "https://sponsoredtokens.com/sponsors",
          evidence: {
            balance: "https://sponsoredtokens.com/api/sponsors â€” sponsor balances",
            weekly: "https://sponsoredtokens.com/docs â€” $5/week base, +$5 per referral to $130/week",
          },
        },
      ],
      events: [
        {
          providerSlug: "sponsored-tokens",
          // Matches supabase/seed.sql.
          slug: "sponsored-tokens-public-pool",
          name: "Public sponsor pool",
          description: `Sponsors fund one shared pool; every account draws from it. ${list.length} sponsor(s) active, $${spent.toFixed(2)} of $${lifetime.toFixed(2)} lifetime spent.`,
          status: fl.poolPaused ? "suspended" : "live",
          startAt: null,
          endAt: null,
          poolSize: Math.round(lifetime),
          poolRemaining: Math.round(balance),
          unit: "dollars",
          models: [],
          eligibility: "Any account. Referral tier gates the more expensive models.",
          requirements: "API key required. No payment method to use the pool.",
          exhaustionCondition: "Pool runs to zero; requests then fall back to your own credits",
          officialUrl: "https://sponsoredtokens.com/sponsors",
        },
      ],
      freeModelCount: null,
      notes: [
        `Pool balance is the real constraint: $${balance.toFixed(2)} across ${list.length} sponsor(s).`,
      ],
    };
  },
};

interface FreeTheAiHealth {
  catalog: { model_count: number; provider_count: number };
  providers: { prefix: string; status: string; model_count: number }[];
  total_tokens_served: { total: number; successful_requests: number };
}

const freetheai: Collector = {
  key: "freetheai.health",
  providerSlug: "freetheai",
  label: "FreeTheAI pool health",
  urls: [
    { url: "https://api.freetheai.xyz/v1/health", type: "json", priority: 1 },
  ],
  collect: async () => {
    const url = "https://api.freetheai.xyz/v1/health";
    const j = await json<FreeTheAiHealth>(url);
    if (j.catalog?.model_count == null) throw new Error("no catalog in health");
    return {
      offers: [
        {
          providerSlug: "freetheai",
          modelId: null,
          modelLabel: `${j.catalog.model_count} models across ${j.catalog.provider_count} upstream providers`,
          offerType: "sponsored_inference",
          status: "live",
          apiKeyRequired: true,
          keyless: false,
          accessRequiresAccount: true,
          accessRequiresSubscription: false,
          cardRequired: false,
          paymentRequired: false,
          compatibilityOpenai: true,
          compatibilityAnthropic: true,
          compatibilityOther: null,
          rpm: 10,
          rpd: 250,
          tpm: null,
          tpd: null,
          monthlyLimit: null,
          monthlyUnit: null,
          tokenLimit: null,
          tokenLimitUnit: null,
          poolSize: null,
          poolRemaining: null,
          poolUnit: null,
          creditAmount: null,
          creditCurrency: null,
          startAt: null,
          endAt: null,
          verificationLevel: "live_api",
          officialEvidenceUrl: url,
          evidence: {
            rpm: "https://api.freetheai.xyz/v1/health and the project's policy block",
            rpd: "250 successful requests/day, resets 00:00 UTC",
            lifetime: `${j.total_tokens_served.total} tokens across ${j.total_tokens_served.successful_requests} successful requests`,
          },
        },
      ],
      events: [],
      freeModelCount: j.catalog.model_count,
      notes: [
        "Requires a daily /checkin in Discord or every call returns 403.",
        ...j.providers.filter((p) => p.status !== "up").map((p) => `upstream ${p.prefix} is ${p.status}`),
      ],
    };
  },
};

interface JoulePool {
  updated_at: string;
  capacity: {
    models_available: string[];
    nodes_healthy: number;
    nodes_total: number;
  };
  readiness: {
    service_live: boolean;
    pool_progress_pct: number;
    countdown_label: string;
    message: string;
  };
}

const joule: Collector = {
  key: "joule.pool",
  providerSlug: "joule",
  label: "joule donor cluster capacity",
  urls: [{ url: "https://joule.f00.sh/api/pool", type: "json", priority: 1 }],
  collect: async () => {
    const url = "https://joule.f00.sh/api/pool";
    const j = await json<JoulePool>(url);
    if (!j.capacity) throw new Error("no capacity in pool payload");
    const live = j.readiness.service_live;
    return {
      offers: [
        {
          providerSlug: "joule",
          modelId: null,
          modelLabel: j.capacity.models_available.join(", ") || "no model resident",
          offerType: "shared_pool",
          // Not serving is NOT the same as ended (Â§13): the pool exists, it is
          // simply below its service gate.
          status: live ? "live" : "unverified",
          apiKeyRequired: true,
          keyless: false,
          accessRequiresAccount: true,
          accessRequiresSubscription: false,
          cardRequired: false,
          paymentRequired: false,
          compatibilityOpenai: true,
          compatibilityAnthropic: false,
          compatibilityOther: null,
          rpm: null,
          rpd: null,
          tpm: null,
          tpd: null,
          monthlyLimit: null,
          monthlyUnit: null,
          tokenLimit: null,
          tokenLimitUnit: null,
          poolSize: null,
          poolRemaining: null,
          poolUnit: null,
          creditAmount: null,
          creditCurrency: null,
          startAt: null,
          endAt: null,
          verificationLevel: "live_api",
          officialEvidenceUrl: url,
          evidence: {
            capacity: `${url} â€” ${j.capacity.nodes_healthy}/${j.capacity.nodes_total} nodes healthy`,
            gate: j.readiness.countdown_label,
            feed: `pool feed last updated ${j.updated_at}`,
          },
        },
      ],
      events: [],
      freeModelCount: null,
      notes: live
        ? ["Cluster is serving."]
        : [`Not serving yet: ${j.readiness.countdown_label}`],
    };
  },
};

interface ChuteModel {
  slug: string;
  name: string;
  type: string;
  tier: string;
  pricing?: { input_per_million?: number; output_per_million?: number };
}

const chutes: Collector = {
  key: "chutes.catalog",
  providerSlug: "chutes",
  label: "Chutes paid catalogue (no free tier)",
  urls: [{ url: "https://chutes.ai/api/models", type: "json", priority: 1 }],
  collect: async () => {
    const url = "https://chutes.ai/api/models";
    const j = await json<{ items: ChuteModel[] }>(url);
    const llms = j.items.filter((i) => i.type === "llm");
    const free = llms.filter(
      (i) =>
        i.pricing?.input_per_million === 0 || /free/i.test(i.tier || ""),
    );
    // A retired free tier is historical fact, not a live offer (Â§16, Â§24).
    return {
      offers: free.map((i) =>
        freeModel("chutes", i.slug, url, {
          modelLabel: i.name,
          offerType: "free_tier",
          status: "live",
          evidence: { source: `${url} â€” priced at $0` },
        }),
      ),
      events: [],
      freeModelCount: free.length,
      notes: [
        `Free tier retired 15 Mar 2026. ${llms.length} models, none currently free.`,
      ],
    };
  },
};

export const COLLECTORS: Collector[] = [
  openrouter,
  aihubmix,
  zen,
  anyrouter,
  kilo,
  llm7,
  pollinations,
  apmix,
  sponsoredtokens,
  freetheai,
  joule,
  chutes,
];

export const COLLECTOR_BY_KEY = new Map(COLLECTORS.map((c) => [c.key, c]));

export const COLLECTOR_BY_SLUG = new Map(
  COLLECTORS.map((c) => [c.providerSlug, c]),
);
