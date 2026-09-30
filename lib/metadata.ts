/**
 * Shared metadata helpers (§40).
 *
 * SERP snippets truncate past ~155 characters, so descriptions are
 * capped there. Static copy is written to fit; database-sourced copy
 * (provider/event descriptions) is truncated at a word boundary with
 * an ellipsis so a long stored description cannot blow the tag out.
 */

const MAX_DESCRIPTION = 155;

/** Caps a description at 155 characters for SERP display. */
export function truncateDescription(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= MAX_DESCRIPTION) return t;
  const cut = t.slice(0, MAX_DESCRIPTION - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > 80 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}
