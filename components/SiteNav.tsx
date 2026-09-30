import Link from "next/link";

/** Primary navigation. Collapses to a horizontally scrollable strip on
 *  mobile rather than a hamburger, so every destination stays one tap away
 *  and the page needs no client-side menu state (§42).
 *
 *  The strip deliberately hides its scrollbar (PRI-001), so the scroll
 *  affordance is a neutral edge fade (`.nav-scroll::after`) instead — never
 *  a state colour. The list itself is focusable (`tabIndex={0}`) with an
 *  accessible name, so keyboard users can arrow-scroll it: without that, a
 *  scroll container is not keyboard-operable (WCAG 2.1.1) and five of the
 *  eight destinations would be unreachable by keyboard on narrow screens.
 *
 *  "Live" points at the full filterable set rather than the landing section,
 *  because that is where the §31 filter and §32 sort controls live. The
 *  landing page's own sections — starting soon, new, changed, ended — are one
 *  scroll away and are linked from within it, so they do not need a slot here. */
export function SiteNav() {
  const items = [
    { href: "/live", label: "Live" },
    { href: "/events", label: "Events" },
    { href: "/providers", label: "Providers" },
    { href: "/models", label: "Models" },
    { href: "/compare", label: "Compare" },
    { href: "/timeline", label: "Timeline" },
    { href: "/search", label: "Search" },
    { href: "/methodology", label: "Methodology" },
  ];

  return (
    <nav className="nav" aria-label="Primary">
      <div className="wrap nav-inner">
        <Link href="/" className="nav-brand">
          <span className="dot dot-live" aria-hidden="true" />
          FREE POOL RADAR
        </Link>
        <div className="nav-scroll">
          <ul
            className="nav-list"
            tabIndex={0}
            role="region"
            aria-label="Primary destinations"
          >
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="nav-link">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
