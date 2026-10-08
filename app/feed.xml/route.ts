import { getChanges, isConfigured } from "@/lib/db";
import { notConfiguredResponse, readErrorResponse } from "@/lib/publicData";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * GET /feed.xml — an Atom feed of recent changes.
 *
 * The subscription surface: a reader, bot or webhook can be told when a new
 * free pool appears, a quota changes, or a provider withdraws access, without
 * polling the API. See DATASET.md#atom-feed.
 */

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const TYPED = /[^a-z0-9]+/gi;

/** "rate_limit_changed" -> "Rate limit changed" */
function humanise(type: string): string {
  const words = type.split(TYPED).filter(Boolean);
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export async function GET() {
  if (!isConfigured()) return notConfiguredResponse();

  const { data: changes, error } = await getChanges(60);
  if (error) return readErrorResponse("changes");

  const updated =
    changes[0]?.detected_at ?? new Date().toISOString();
  const base = SITE_URL.replace(/\/+$/, "");

  const entries = changes
    .map((c) => {
      const who = c.provider?.name ?? "Provider";
      const what = humanise(c.change_type);
      const subject = c.offer?.model_label ? ` · ${c.offer.model_label}` : "";
      const title = `${who}: ${what}${subject}`;

      const bits: string[] = [];
      if (c.field) bits.push(`${c.field}: ${c.old_value ?? "not stated"} → ${c.new_value ?? "not stated"}`);
      else if (c.old_value !== null || c.new_value !== null)
        bits.push(`${c.old_value ?? "—"} → ${c.new_value ?? "—"}`);
      if (c.evidence) bits.push(c.evidence);
      const summary = bits.join(" — ") || title;

      const link = c.source_url ?? `${base}/timeline`;
      return [
        "  <entry>",
        `    <title>${xml(title)}</title>`,
        `    <id>${xml(`${base}/changes/${c.id}`)}</id>`,
        `    <link href="${xml(link)}"/>`,
        `    <updated>${xml(new Date(c.detected_at).toISOString())}</updated>`,
        `    <category term="${xml(c.change_type)}"/>`,
        `    <summary type="text">${xml(summary)}</summary>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  const doc = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Free Pool Radar — changes</title>
  <subtitle>New free pools, quota changes, new models and withdrawals, with evidence</subtitle>
  <id>${xml(`${base}/feed.xml`)}</id>
  <link href="${xml(`${base}/feed.xml`)}" rel="self"/>
  <link href="${xml(base)}"/>
  <updated>${xml(new Date(updated).toISOString())}</updated>
  <author><name>Free Pool Radar</name></author>
  <rights>Data CC0 1.0 Universal</rights>
${entries}
</feed>
`;

  return new Response(doc, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
