import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Free Pool Radar verifies free AI access: the evidence hierarchy, the rules for what counts as a source, how conflicts are handled, and why a failed source is never reported as a withdrawn offer.",
  alternates: { canonical: "/methodology" },
};

/** §33, §34, §35. The full statement of how the product decides. */
export default function MethodologyPage() {
  return (
    <>
      <main id="main" className="wrap">
        <header className="page-head">
          <p className="label">How we verify</p>
          <h1 className="page-title">Methodology</h1>
          <p className="page-lede">
            &ldquo;Free&rdquo; is not a category. It is a claim, and this is what
            we require before we publish one. Everything below is a rule the
            system enforces, not a description of good intentions.
          </p>
        </header>

        <div className="prose">
          <h2>The evidence hierarchy</h2>
          <p>
            Every factual claim carries a source, and sources are ranked. A
            figure read from a live endpoint outranks a figure read from a
            provider&rsquo;s documentation, which outranks a dated
            announcement, which outranks a social post, which outranks a
            third-party write-up or a community report.
          </p>
          <ul>
            <li>
              <strong>Live API</strong> &mdash; a public models, quota or JSON
              endpoint. Strongest, because it cannot quietly disagree with
              reality.
            </li>
            <li>
              <strong>Official documentation</strong> &mdash; the provider&rsquo;s
              own stated limits and terms.
            </li>
            <li>
              <strong>Official event page</strong> &mdash; a published pool or
              promotion, including its start date and size.
            </li>
            <li>
              <strong>Official announcement</strong> &mdash; a dated blog post
              or changelog entry.
            </li>
            <li>
              <strong>Official social</strong> &mdash; an account belonging to
              the provider.
            </li>
            <li>
              <strong>Secondary source</strong> &mdash; reputable third-party
              reporting. Can discover an offer; cannot verify it.
            </li>
            <li>
              <strong>Community discovery</strong> &mdash; what a reader told
              us. Enters the review queue, never the live list.
            </li>
          </ul>

          <h2>Numbers are never invented</h2>
          <p>
            Every important numeric field stores its value, its source URL, when
            it was observed, and its evidence level. If a provider does not
            publish a limit, we show &ldquo;not publicly stated&rdquo;. We do
            not substitute a zero, we do not infer a rate limit from observed
            behaviour, and we do not carry a figure across from a different
            tier or a different region.
          </p>
          <p>
            Units are reproduced exactly as published. A pool quoted in weighted
            tokens is labelled weighted tokens, not tokens. Requests, tokens,
            credits, dollars, neurons and GPU-seconds are never converted into
            one another, because the conversion is not ours to make.
          </p>

          <h2>One claim, one primary status</h2>
          <p>
            Every offer carries exactly one status: upcoming, live, changed,
            ending, exhausted, ended, suspended or unverified. Access type is
            tracked separately, because an offer can be a shared pool that is
            also rate limited and also requires a card. Collapsing those into a
            single &ldquo;free&rdquo; badge would hide the only information
            anyone actually needs.
          </p>

          <h2>A failed source is not a withdrawn offer</h2>
          <p>
            This is the rule we hold most firmly. When a source cannot be
            reached, we record the failure against the source and leave its
            offers exactly as they were. Their verification time ages, and they
            move through fresh, aging, stale and very stale as it does. Nothing
            is marked ended because a request timed out, returned a 500, or the
            provider changed its CDN.
          </p>
          <p>
            A source that fails repeatedly is shown as failed, alongside the
            time of its last successful verification, so a reader can tell the
            difference between &ldquo;this ended&rdquo; and &ldquo;we have not
            been able to check&rdquo;.
          </p>

          <h2>Conflicts are preserved</h2>
          <p>
            When two official sources disagree, we store both readings and
            display both. A provider documenting 50 requests a day for unfunded
            accounts and 1,000 after ten dollars of lifetime credit is not a
            contradiction; it is two different conditions, and the honest
            rendering is the condition, not a single averaged number.
          </p>

          <h2>History is never deleted</h2>
          <p>
            An offer that ends is retained with its end date, the reason, and
            the evidence. Every sweep appends an observation; nothing is
            overwritten. That history is the reason the site answers questions
            it could not answer when it launched, and deleting it would make the
            product worse the longer it ran.
          </p>

          <h2>Provenance of each row</h2>
          <p>
            Rows carry a provenance marker. An offer confirmed by an automated
            source in the last few hours is one thing; an offer established by
            documented research for a provider we do not yet poll automatically
            is another. Both are published, and both are labelled, because
            presenting one as the other would be the kind of quiet
            overstatement this product exists to avoid.
          </p>

          <h2>What we will not do</h2>
          <ul>
            <li>Rank providers, or publish a quality score.</li>
            <li>Call a time-boxed trial &ldquo;free&rdquo; without saying it ends.</li>
            <li>Present a promotional credit as equivalent to pooled tokens.</li>
            <li>Republish a third-party list without verifying each entry.</li>
            <li>Hide a conflict by picking a side.</li>
            <li>Fill an empty state with invented data.</li>
          </ul>

          <h2>Independent</h2>
          <p>
            Free Pool Radar is an independent information service and is not
            affiliated with, endorsed by, or sponsored by any provider listed.
            We take no payment from providers, accept no affiliate links, and
            have no commercial relationship with any entry in the database.
          </p>
          <p>
            Free access can be withdrawn, rate-limited, modified or exhausted
            without notice. Always review the provider&rsquo;s current terms,
            privacy policy and usage restrictions before sending sensitive or
            production data.
          </p>
        </div>
      </main>
    </>
  );
}
