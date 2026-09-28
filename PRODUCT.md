# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Indie hackers and solo builders. They land on this page while trying to stretch a
free AI tier as far as it will go, usually mid-project and under time pressure.
Their job is to find a working provider, understand its actual ceiling, and get a
key working in their tool. Secondary audience: developers auditing every option
before committing, and researchers checking whether a claim about the free-AI
landscape is still true.

## Product Purpose

An index of every provider giving away LLM API access with no card, no
subscription, and no expiry — including the ones that have been switched off.
It exists because the free-tier landscape changes weekly and published guides
go stale silently. Success means a reader can tell a live offer from a dead one
within seconds, and can trust that the numbers shown were read rather than
copied.

## Positioning

The mechanism is live polling plus an explicit withdrawn list. Seven public
provider APIs are read every five hours, and every refresh diffs the live
catalogues against a fixed baseline so a model that has been pulled is reported
as withdrawn rather than quietly dropped. Providers whose own documentation
contradicts third-party guides are named, with the conflict left visible.

## Operating Context

Readers arrive from a search result or a shared link, usually with an editor
open in another window. The page is read once, acted on, and left open in a
background tab while they wire something up. That last detail is why the page
must stay readable when it is not the focused tab.

## Capabilities and Constraints

- Page rebuilds server-side every 5 hours via ISR; data must never require a
  redeploy to stay current.
- `app/api/snapshot` is force-dynamic and backs a manual re-poll control.
- All polling uses public endpoints, no provider keys held server-side.
- Where a provider no longer publishes a limit, the page says so rather than
  substituting a third-party number.
- Commercial, privacy, and data-training positions are part of the content and
  must not be softened.
- Light theme is the default; dark is available as a toggle.

## Brand Commitments

Name is Free Pool Radar. Voice is direct and corrective: it names what is
overstated rather than hedging, and treats a withdrawn offer as a feature of the
page rather than an embarrassment. Not affiliated with any provider listed.

## Evidence on Hand

Live: 113 free model ids across 7 polled providers; 12/12 adapters answering;
apmix community event pool (10B weighted tokens, `gpt-6-luna-free`); sponsored/tokens
sponsor pool balance; FreeTheAI lifetime token counters. Curated and dated to
28 September 2026: 51 offers, each with exact quota figures, card requirement,
start date, privacy position, and key steps. `lib/baseline.json` is the diff
baseline. No customer logos, testimonials, or revenue figures exist and none may
be invented.

## Product Principles

1. Show the ceiling, not just the offer. A free tier without its real limit is
   a trap, and the limit is the reason a reader is here.
2. Never launder a third-party number. Unverified stays unverified, on screen.
3. Withdrawn is content. Naming what died is what makes today's list credible.
4. Cardless or it is not free. That distinction is the page's whole filter.
5. Respect the reader's attention. Data first; the page earns motion in exactly
   one place.

## Accessibility & Inclusion

Keyboard-operable registry filters and search. Visible focus states. The theme
toggle must work from the keyboard and announce its state. Motion respects
`prefers-reduced-motion`. Body and secondary text must hold at least 4.5:1
contrast in both themes.
