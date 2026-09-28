import Link from "next/link";

/**
 * How we verify (§33, §34, §35).
 *
 * This section is load-bearing rather than decorative. The product's whole
 * claim is that "free" is a verified claim rather than a category, so the
 * rules for what counts as evidence have to be visible, including the
 * uncomfortable parts: conflicts are preserved rather than resolved, and a
 * monitoring failure is never reported as a withdrawal.
 */
export function Methodology() {
  return (
    <section id="methodology" className="sect">
      <div className="sect-head">
        <h2 className="sect-title">How we verify</h2>
        <Link href="/methodology" className="link-ev">
          Full methodology
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <ol className="method">
        {[
          {
            n: "01",
            t: "Live API first",
            d: "A public models or quota endpoint is the strongest evidence there is, because it cannot go stale without us noticing. Twelve of our sources are read this way.",
          },
          {
            n: "02",
            t: "Official documentation second",
            d: "Where a provider publishes its own rate limits and terms, that is the figure we store. We never infer a limit from behaviour.",
          },
          {
            n: "03",
            t: "Official announcements third",
            d: "A dated provider post is good evidence for a start date, an end date, or a retirement — especially for the offers we keep as history.",
          },
          {
            n: "04",
            t: "Secondary sources discover, they do not verify",
            d: "Community and third-party sources can put an offer on our radar. They cannot promote it to verified. Those candidates sit in a review queue until official evidence appears.",
          },
          {
            n: "05",
            t: "Every important number is evidence-backed",
            d: "Each field records where it was read and when. A number the provider does not publish is shown as not publicly stated — never as zero, and never as a guess.",
          },
          {
            n: "06",
            t: "Conflicts are preserved, not resolved",
            d: "When two official sources disagree — OpenRouter's 50 versus 1,000 requests a day, for instance — both readings are stored and shown. Picking one silently would be a fabrication.",
          },
          {
            n: "07",
            t: "A failed source is not an ended offer",
            d: "If monitoring cannot reach a source we record the failure and leave its offers exactly as they were. Those offers go stale on a timer. Nothing is withdrawn because a request timed out.",
          },
        ].map((s) => (
          <li key={s.n} className="method-row">
            <span className="mono method-n">{s.n}</span>
            <div>
              <h3 className="method-t">{s.t}</h3>
              <p className="annot">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="panel trust">
        <p className="label">Confidence vocabulary</p>
        <p className="annot" style={{ marginTop: "0.5rem" }}>
          We use a named evidence level rather than a numerical trust score,
          because a score invites false precision. An offer is{" "}
          <strong>verified from a live API</strong>, <strong>verified from
          official documentation</strong>, <strong>stale</strong>, or{" "}
          <strong>unverified</strong> &mdash; and unverified offers are never
          displayed beside verified ones without saying so.
        </p>
      </div>
    </section>
  );
}
